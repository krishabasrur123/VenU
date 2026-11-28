// The live (Supabase) backend against an in-memory stand-in for the database, shared by a visitor's
// and volunteers' "devices": mapping rows to the app's shapes, open → matched → done / cancelled,
// the accept race, Realtime and the polling fallback.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import * as backendModule from '../backend';
import { AlreadyTakenError, createMockBackend } from '../backend';
import { createDeskStore } from '../desk-store';
import { createRequestStore, reduce, SEARCH_TIMEOUT_MS, type NewRequest } from '../request-store';
import {
  CONNECT_GRACE_MS,
  createLiveBackend,
  OPEN_REFRESH_MS,
  POLL_MS,
  randomUuid,
  requestToRow,
  rowToAssignment,
  rowToIncoming,
  rowToMatch,
  rowToMessage,
  supabaseHelpDb,
  type HelpDb,
  type MessageRow,
  type NewFeedbackRow,
  type RequestRow,
  type WatchSpec,
} from '../supabase-backend';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

interface Profile {
  role: 'visitor' | 'volunteer';
  first_name: string;
  languages: string[];
  main_language: string;
  trainings: string[];
  gender: string | null;
  /** False: LA28 hasn't verified them yet (accept_help_request refuses). Missing means verified. */
  verified?: boolean;
}

const PROFILES: Record<string, Profile> = {
  rosa: { role: 'visitor', first_name: 'Rosa', languages: ['es'], main_language: 'es', trainings: [], gender: null },
  sam: { role: 'volunteer', first_name: 'Sam', languages: ['es', 'en'], main_language: 'en', trainings: ['first_aid', 'sighted_guide'], gender: 'man' },
  ana: { role: 'volunteer', first_name: 'Ana', languages: ['en'], main_language: 'en', trainings: [], gender: 'woman' },
  lee: { role: 'visitor', first_name: 'Lee', languages: ['en'], main_language: 'en', trainings: [], gender: null },
  kim: { role: 'volunteer', first_name: 'Kim', languages: ['en'], main_language: 'en', trainings: [], gender: 'woman', verified: false },
};

/** Errors added with the review fixes, looked up at run time so these tests also run (and fail) without them. */
const errorClass = (name: string): new () => Error =>
  (backendModule as unknown as Record<string, (new () => Error) | undefined>)[name] ?? class extends Error { constructor() { super(name); } };
const AlreadyHelpingError = errorClass('AlreadyHelpingError');
const RequestClosedError = errorClass('RequestClosedError');
const NotVerifiedError = errorClass('NotVerifiedError');

/** How long an open request stays on volunteers' lists (open_help_requests in the migration). */
const OPEN_WINDOW_S = 5 * 60;

interface Sub {
  viewer: string;
  spec: WatchSpec;
  onRow: (row: unknown) => void;
}

/**
 * The tables and rules of the migration, in memory. `realtime: false` makes every channel fail, as
 * against the local mock server, so the backend has to poll.
 */
function fakeServer({ realtime = true } = {}) {
  const requests = new Map<string, RequestRow>();
  const messages: MessageRow[] = [];
  /** help_feedback rows, with the author the database would set. */
  const feedback: (NewFeedbackRow & { author_id: string })[] = [];
  const subs = new Set<Sub>();
  /** The server's clock, which tests move with advance(); the device clock (Date.now) is separate. */
  let clock = Date.parse('2026-11-17T18:00:00Z');
  const now = () => new Date((clock += 1000)).toISOString();
  /** Test switch: message inserts fail (offline, or refused by RLS). */
  const control = { rejectSends: false };

  const isVolunteer = (id: string) => PROFILES[id]?.role === 'volunteer';
  const canSee = (r: RequestRow, who: string) => r.visitor_id === who || r.volunteer_id === who || (r.status === 'open' && isVolunteer(who));
  const party = (requestId: string, who: string) => {
    const r = requests.get(requestId);
    return !!r && (r.visitor_id === who || r.volunteer_id === who);
  };
  /**
   * can_read_message: the visitor and the current volunteer read what either of them wrote since
   * that volunteer accepted, so a volunteer who takes over never sees the previous one's chat.
   */
  const canRead = (m: MessageRow, who: string) => {
    const r = requests.get(m.request_id);
    if (!r || !r.matched_at || m.created_at < r.matched_at) return false;
    const parties = [r.visitor_id, r.volunteer_id];
    return parties.includes(who) && parties.includes(m.sender_id);
  };
  const matches = (filter: string | undefined, row: Record<string, unknown>) => {
    if (!filter) return true;
    const [col, value] = filter.split('=eq.');
    return String(row[col!]) === value;
  };

  function changed(row: RequestRow) {
    for (const s of subs) if (s.spec.table === 'help_requests' && matches(s.spec.filter, row as never) && canSee(row, s.viewer)) s.onRow({ ...row });
  }
  function posted(row: MessageRow) {
    for (const s of subs) if (s.spec.table === 'messages' && matches(s.spec.filter, row as never) && canRead(row, s.viewer)) s.onRow({ ...row });
  }

  /** One user's connection. */
  function dbFor(who: string): HelpDb {
    return {
      me: async () => who,
      async insertRequest(row) {
        await Promise.resolve();
        if (requests.has(row.id)) return;
        const at = now();
        const full: RequestRow = {
          ...row, visitor_id: who, status: 'open', volunteer_id: null, volunteer_name: null, volunteer_languages: null,
          volunteer_trainings: null, closed_by: null, created_at: at, opened_at: at, matched_at: null, closed_at: null,
        };
        requests.set(row.id, full);
        changed(full);
      },
      getRequest: async id => {
        const r = requests.get(id);
        return r && canSee(r, who) ? { ...r } : null;
      },
      // open_help_requests(): the window and the age come from the server's clock.
      openRequests: async () =>
        [...requests.values()]
          .filter(r => r.status === 'open' && canSee(r, who) && clock - Date.parse(r.opened_at) <= OPEN_WINDOW_S * 1000)
          .reverse()
          .map(r => ({ ...r, age_seconds: Math.floor((clock - Date.parse(r.opened_at)) / 1000) })),
      activeAssignment: async id => [...requests.values()].find(r => r.volunteer_id === id && r.status === 'matched') ?? null,
      async accept(id) {
        await Promise.resolve(); // both volunteers' calls are in flight before either lands
        const p = PROFILES[who];
        const r = requests.get(id);
        if (!p || p.role !== 'volunteer') throw new Error('not_a_volunteer');
        if (p.verified === false) throw new NotVerifiedError();
        if ([...requests.values()].some(x => x.volunteer_id === who && x.status === 'matched')) throw new AlreadyHelpingError();
        if (!r || r.status === 'cancelled' || r.status === 'done') throw new RequestClosedError();
        if (r.status !== 'open' || r.visitor_id === who) throw new AlreadyTakenError();
        const next: RequestRow = {
          ...r, status: 'matched', volunteer_id: who, volunteer_name: p.first_name,
          volunteer_languages: [p.main_language, ...p.languages.filter(l => l !== p.main_language)],
          volunteer_trainings: p.trainings, matched_at: now(),
        };
        requests.set(id, next);
        changed(next);
        return { ...next };
      },
      async close(id, status) {
        const r = requests.get(id);
        if (!r || (r.status !== 'open' && r.status !== 'matched')) return;
        if (r.visitor_id !== who && !(r.volunteer_id === who && r.status === 'matched' && status === 'done')) return;
        const next: RequestRow = { ...r, status, closed_by: who, closed_at: now() };
        requests.set(id, next);
        changed(next);
      },
      // withdraw_open_request: cancels only while open; the row either way, null when not yours.
      async withdraw(id) {
        await Promise.resolve();
        const r = requests.get(id);
        if (!r || r.visitor_id !== who) return null;
        if (r.status !== 'open') return { ...r };
        const next: RequestRow = { ...r, status: 'cancelled', closed_by: who, closed_at: now() };
        requests.set(id, next);
        changed(next);
        return { ...next };
      },
      async release(id) {
        const r = requests.get(id);
        if (!r || r.status !== 'matched' || r.volunteer_id !== who) return;
        const next: RequestRow = {
          ...r, status: 'open', volunteer_id: null, volunteer_name: null, volunteer_languages: null, volunteer_trainings: null,
          matched_at: null, opened_at: now(),
        };
        requests.set(id, next);
        changed(next);
      },
      messages: async (requestId, sinceIso) =>
        messages.filter(m => m.request_id === requestId && canRead(m, who) && (!sinceIso || m.created_at >= sinceIso)).map(m => ({ ...m })),
      async sendMessage(row) {
        await Promise.resolve();
        if (control.rejectSends || !party(row.request_id, who) || requests.get(row.request_id)?.status !== 'matched') throw new Error('row-level security');
        const full: MessageRow = { ...row, id: randomUuid(), sender_id: who, created_at: now() };
        messages.push(full);
        posted(full);
      },
      // help_feedback's insert policy: a party to a matched or finished request; one rating each.
      async insertFeedback(row) {
        await Promise.resolve();
        const r = requests.get(row.request_id);
        if (!party(row.request_id, who) || (r?.status !== 'matched' && r?.status !== 'done')) throw new Error('row-level security');
        if (row.kind === 'rating' && feedback.some(f => f.kind === 'rating' && f.request_id === row.request_id && f.author_id === who)) return; // 23505
        feedback.push({ ...row, author_id: who });
      },
      subscribe<Row>(spec: WatchSpec, onRow: (row: Row | null) => void, onLive: (live: boolean) => void) {
        const sub: Sub = { viewer: who, spec, onRow: onRow as (row: unknown) => void };
        if (realtime) subs.add(sub);
        queueMicrotask(() => onLive(realtime));
        return () => { subs.delete(sub); };
      },
    };
  }

  return { requests, messages, feedback, subs, dbFor, control, advance: (ms: number) => { clock += ms; } };
}

const rosaNeedsHelp: NewRequest = {
  visitorName: 'Rosa',
  helpTypes: ['physical', 'directions'],
  note: 'Near the ramp',
  photoUri: null,
  language: 'es',
  location: { venueId: 'sofi', facilityId: 'entry-4' },
};

/** Lets the fake's promises and any due timers run. */
async function settle(ms = 0) {
  await jest.advanceTimersByTimeAsync(ms);
  await jest.advanceTimersByTimeAsync(0);
}

function devices(server: ReturnType<typeof fakeServer>) {
  const visitor = createRequestStore(createLiveBackend(server.dbFor('rosa')));
  visitor.setLanguage('es');
  const sam = createDeskStore(createLiveBackend(server.dbFor('sam')));
  sam.setLanguage('en');
  const ana = createDeskStore(createLiveBackend(server.dbFor('ana')));
  return { visitor, sam, ana };
}

/** Rosa asks; Sam sees it and accepts. */
async function matched(server = fakeServer()) {
  const d = devices(server);
  await d.sam.setUser('sam');
  d.sam.watchOpen();
  void d.visitor.sendRequest(rosaNeedsHelp);
  await settle();
  const id = d.visitor.getState().request!.id;
  expect(await d.sam.accept(id)).toBe(true);
  await settle();
  return { ...d, id, server };
}

describe('mapping rows', () => {
  const row: RequestRow = {
    id: 'r1', visitor_id: 'rosa', visitor_name: 'Rosa', venue_id: 'sofi', spot: 'entry-4', help_types: ['quiet', 'nonsense'],
    note: 'Too loud', language: 'es', status: 'matched', volunteer_id: 'sam', volunteer_name: 'Sam',
    volunteer_languages: ['en', 'es'], volunteer_trainings: ['first_aid', 'sighted_guide'],
    closed_by: null, created_at: '2026-11-17T18:00:00Z', opened_at: '2026-11-17T18:00:00Z', matched_at: '2026-11-17T18:01:00Z', closed_at: null,
  };

  it('sends a request as a row, ids for places', () => {
    expect(requestToRow({ ...rosaNeedsHelp, id: 'r9', createdAt: 0, location: { venueId: 'sofi', facilityId: null } })).toEqual({
      id: 'r9', visitor_name: 'Rosa', venue_id: 'sofi', spot: null, help_types: ['physical', 'directions'], note: 'Near the ramp', language: 'es',
    });
  });

  it('turns the accepted volunteer into a match: name, trainings it knows, languages, no rating or ETA', () => {
    const m = rowToMatch(row);
    expect(m.volunteer).toMatchObject({ id: 'sam', name: 'Sam', firstName: 'Sam', possessive: 'their', languages: ['en', 'es'], rating: null });
    expect(m.volunteer.tags).toEqual([
      { label: 'first_aid', skill: 'first_aid', tone: 'success' },
      { label: 'English', tone: 'warning' },
      { label: 'Español', tone: 'warning' },
    ]);
    expect(m).toMatchObject({ language: 'en', etaMinutes: null, distanceFeet: null });
    // Gender is never shown, so a live match is always "on their way".
    expect(m.volunteer.possessive).toBe('their');
  });

  it('shows an open request with how long ago it came in (the server’s count), skipping help types it does not know', () => {
    const r = rowToIncoming({ ...row, age_seconds: 210 });
    expect(r).toEqual({
      id: 'r1', visitorName: 'Rosa', helpType: 'quiet', location: { venueId: 'sofi', facilityId: 'entry-4' },
      language: 'es', minutesAgo: 3, distanceFeet: null, note: 'Too loud',
    });
    expect(rowToIncoming({ ...row, help_types: ['nonsense'], age_seconds: 0 }).helpType).toBe('other');
    expect(rowToAssignment(row)).toMatchObject({ id: 'r1', visitorName: 'Rosa', helpTypes: ['quiet'], language: 'es', createdAt: Date.parse('2026-11-17T18:00:00Z') });
  });

  it('tells your messages from theirs and keeps the language they were written in', () => {
    const m: MessageRow = { id: 'm1', request_id: 'r1', sender_id: 'sam', text: 'Hi', language: 'en', created_at: '2026-11-17T18:02:00Z' };
    expect(rowToMessage(m, 'rosa')).toEqual({ id: 'm1', from: 'them', text: 'Hi', sentAt: Date.parse('2026-11-17T18:02:00Z'), lang: 'en' });
    expect(rowToMessage({ ...m, language: null }, 'sam')).toEqual({ id: 'm1', from: 'me', text: 'Hi', sentAt: Date.parse('2026-11-17T18:02:00Z') });
  });

  it('makes v4 UUIDs for request ids', () => {
    expect(randomUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomUuid()).not.toBe(randomUuid());
  });
});

describe('live help requests', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('stores the request as open and shows it to a volunteer with Accept', async () => {
    const server = fakeServer();
    const { visitor, sam } = devices(server);
    expect(sam.live).toBe(true);
    await sam.setUser('sam');
    sam.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    expect(visitor.getState().status).toBe('searching');
    expect(server.requests.get(id)).toMatchObject({ status: 'open', visitor_id: 'rosa', spot: 'entry-4', help_types: ['physical', 'directions'] });
    expect(sam.getState().open).toEqual([expect.objectContaining({ id, visitorName: 'Rosa', helpType: 'physical', language: 'es' })]);
  });

  it('open → matched: the visitor sees the volunteer’s real name, and chat flows both ways with languages', async () => {
    const { visitor, sam, id, server } = await matched();
    expect(server.requests.get(id)).toMatchObject({ status: 'matched', volunteer_id: 'sam' });
    expect(visitor.getState().status).toBe('matched');
    expect(visitor.getState().match?.volunteer.firstName).toBe('Sam');
    expect(sam.getState()).toMatchObject({ assignment: { id, visitorName: 'Rosa' }, open: [] });

    visitor.sendMessage('Estoy en la rampa');
    await settle();
    expect(sam.getState().messages).toEqual([expect.objectContaining({ from: 'them', text: 'Estoy en la rampa', lang: 'es' })]);
    expect(sam.getState().unread).toBe(1);

    sam.sendMessage("I'm on my way");
    await settle();
    expect(visitor.getState().messages.map(m => [m.from, m.text, m.lang])).toEqual([
      ['me', 'Estoy en la rampa', 'es'],
      ['them', "I'm on my way", 'en'],
    ]);
    // Each side has the message once, though Realtime also reports their own.
    expect(sam.getState().messages.map(m => m.from)).toEqual(['them', 'me']);
  });

  it('matched → done by the visitor: the volunteer is told and goes back to the list', async () => {
    const { visitor, sam, id, server } = await matched();
    visitor.endHelp();
    await settle();
    expect(visitor.getState().status).toBe('done');
    expect(server.requests.get(id)).toMatchObject({ status: 'done', closed_by: 'rosa' });
    expect(sam.getState()).toMatchObject({ assignment: null, notice: { key: 'done', params: { name: 'Rosa' } } });
  });

  it('matched → cancelled by the visitor: the volunteer is told', async () => {
    const { visitor, sam, id, server } = await matched();
    visitor.cancel();
    await settle();
    expect(server.requests.get(id)?.status).toBe('cancelled');
    expect(sam.getState()).toMatchObject({ assignment: null, notice: { key: 'cancelled', params: { name: 'Rosa' } } });
  });

  it('the volunteer ending the chat moves the visitor to feedback', async () => {
    const { visitor, sam, id, server } = await matched();
    sam.endChat();
    expect(sam.getState()).toMatchObject({ assignment: null, notice: { key: 'ended' } });
    await settle();
    expect(server.requests.get(id)).toMatchObject({ status: 'done', closed_by: 'sam' });
    expect(visitor.getState().status).toBe('done');
    expect(visitor.getState().match?.volunteer.firstName).toBe('Sam');
  });

  it('saves the visitor’s rating to help_feedback, once, then thanks them', async () => {
    const { visitor, id, server } = await matched();
    visitor.endHelp();
    await settle();
    await visitor.submitFeedback(4, ['patient', 'helpful'], '  Found me a seat  ');
    expect(server.feedback).toEqual([
      { request_id: id, kind: 'rating', stars: 4, tags: ['patient', 'helpful'], problem: null, note: 'Found me a seat', author_id: 'rosa' },
    ]);
    expect(visitor.getState()).toMatchObject({ status: 'idle', notice: { key: 'thanks', params: { name: 'Sam' } } });
  });

  it('saves a problem report with its kind, and a refused insert reaches the screen', async () => {
    const { visitor, id, server } = await matched();
    visitor.endHelp();
    await settle();
    await visitor.reportProblem('no_show', ' Waited 20 minutes ');
    expect(server.feedback).toEqual([
      { request_id: id, kind: 'problem', stars: null, tags: [], problem: 'no_show', note: 'Waited 20 minutes', author_id: 'rosa' },
    ]);
    // Someone who isn't on the request (RLS refuses): the error reaches feedback-view's "Couldn't send".
    const lee = createLiveBackend(server.dbFor('lee'));
    await expect(lee.reportProblem({ requestId: id, volunteerId: 'sam', kind: 'rude', note: '' })).rejects.toThrow('row-level security');
    expect(server.feedback).toHaveLength(1);
  });

  it('open → cancelled while searching: it leaves the volunteer’s list on the next refresh', async () => {
    const server = fakeServer();
    const { visitor, sam } = devices(server);
    await sam.setUser('sam');
    sam.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    expect(sam.getState().open).toHaveLength(1);
    visitor.cancel();
    // RLS hides the cancelled row from volunteers, so Realtime can't tell them; the timed refresh does.
    await settle(OPEN_REFRESH_MS);
    expect(sam.getState().open).toEqual([]);
  });

  it('a cancel right after sending waits for the insert, so the request never stays open', async () => {
    const server = fakeServer();
    const { visitor } = devices(server);
    void visitor.sendRequest(rosaNeedsHelp);
    const id = visitor.getState().request!.id;
    visitor.cancel(); // before the insert has landed
    await settle();
    expect(server.requests.get(id)?.status).toBe('cancelled');
  });

  it('the accept race: exactly one of two volunteers gets it; the other hears it was taken', async () => {
    const server = fakeServer();
    const { visitor, sam, ana } = devices(server);
    await sam.setUser('sam');
    await ana.setUser('ana');
    sam.watchOpen();
    ana.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    expect(ana.getState().open.map(r => r.id)).toEqual([id]);

    const [samGot, anaGot] = await Promise.all([sam.accept(id), ana.accept(id)]);
    await settle();
    expect([samGot, anaGot]).toEqual([true, false]);
    expect(server.requests.get(id)?.volunteer_id).toBe('sam');
    expect(ana.getState()).toMatchObject({ assignment: null, notice: { tone: 'error', key: 'taken' } });
    expect(ana.getState().open).toEqual([]);
    expect(visitor.getState().match?.volunteer.firstName).toBe('Sam');
  });

  it('only volunteers can accept', async () => {
    const server = fakeServer();
    const { visitor } = devices(server);
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const rosaAsVolunteer = createDeskStore(createLiveBackend(server.dbFor('rosa')));
    expect(await rosaAsVolunteer.accept(visitor.getState().request!.id)).toBe(false);
    expect(rosaAsVolunteer.getState().notice?.key).toBe('acceptFailed');
  });

  it('an unverified volunteer sees the request but can’t take it; it stays open for others', async () => {
    const server = fakeServer();
    const { visitor, sam } = devices(server);
    const kim = createDeskStore(createLiveBackend(server.dbFor('kim')));
    await kim.setUser('kim');
    kim.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    expect(kim.getState().open.map(r => r.id)).toEqual([id]);
    expect(await kim.accept(id)).toBe(false);
    expect(kim.getState()).toMatchObject({ assignment: null, notice: { tone: 'error', key: 'notVerified' } });
    // Still listed (it isn't gone, Kim just can't take it), and Sam can.
    expect(kim.getState().open.map(r => r.id)).toEqual([id]);
    expect(server.requests.get(id)?.status).toBe('open');
    await sam.setUser('sam');
    expect(await sam.accept(id)).toBe(true);
  });

  it('polls every 2 s when Realtime never subscribes (the local mock server)', async () => {
    const server = fakeServer({ realtime: false });
    const { visitor, sam } = devices(server);
    await sam.setUser('sam');
    sam.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    expect(server.subs.size).toBe(0);
    await settle(POLL_MS);
    expect(sam.getState().open.map(r => r.id)).toEqual([id]);

    expect(await sam.accept(id)).toBe(true);
    expect(visitor.getState().status).toBe('searching');
    await settle(POLL_MS);
    expect(visitor.getState().status).toBe('matched');

    visitor.sendMessage('Hola');
    await settle(POLL_MS);
    expect(sam.getState().messages.map(m => m.text)).toEqual(['Hola']);
    sam.endChat();
    await settle(POLL_MS);
    expect(visitor.getState().status).toBe('done');
  });

  it('starts polling if Realtime takes too long to answer', async () => {
    const server = fakeServer();
    const db = server.dbFor('sam');
    const silent: HelpDb = { ...db, subscribe: () => () => {} }; // never reports a status
    const openRequests = jest.spyOn(silent, 'openRequests');
    const desk = createDeskStore(createLiveBackend(silent));
    desk.watchOpen();
    await settle();
    expect(openRequests).toHaveBeenCalledTimes(1);
    await settle(CONNECT_GRACE_MS + POLL_MS);
    expect(openRequests).toHaveBeenCalledTimes(2);
  });

  it('a volunteer restarting the app gets back the request they accepted, with its chat', async () => {
    const { visitor, id, server } = await matched();
    visitor.sendMessage('Hola');
    await settle();
    const again = createDeskStore(createLiveBackend(server.dbFor('sam')));
    await again.setUser('sam');
    await settle();
    expect(again.getState().assignment?.id).toBe(id);
    expect(again.getState().messages.map(m => [m.from, m.text])).toEqual([['them', 'Hola']]);
    expect(again.isRestored()).toBe(true);
  });

  it('a visitor’s chat keeps one copy of messages the live service sends again on resubscribing', async () => {
    const { visitor, sam } = await matched();
    sam.sendMessage('On my way');
    await settle();
    const state = visitor.getState();
    const again = reduce(state, { type: 'receive', requestId: state.request!.id, message: state.messages.at(-1)! });
    expect(again).toBe(state);
  });

  it('signing out of the desk drops the chat and the list', async () => {
    const { sam } = await matched();
    await sam.setUser(null);
    expect(sam.getState()).toEqual(expect.objectContaining({ assignment: null, messages: [], open: [] }));
  });
});

/** Another visitor's open request, straight into the fake database. */
function leeRequest(id: string) {
  return { id, visitor_name: 'Lee', venue_id: 'sofi', spot: null, help_types: ['lost'], note: '', language: 'en' };
}

describe('review fixes', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('a volunteer signing out mid-chat hands the request back: the visitor searches again, told why, and the next volunteer starts a clean chat', async () => {
    const { visitor, sam, ana, id, server } = await matched();
    visitor.sendMessage('Estoy en la rampa');
    sam.sendMessage('On my way');
    await settle();
    server.advance(10 * 60 * 1000); // long past the open list's window: it's back on the list anyway
    await sam.endSession();
    await sam.setUser(null);
    await settle();

    expect(server.requests.get(id)).toMatchObject({ status: 'open', volunteer_id: null, volunteer_name: null, matched_at: null, closed_by: null });
    // Not "help finished": no feedback screen, back to searching with a note.
    expect(visitor.getState()).toMatchObject({ status: 'searching', match: null, messages: [], unread: 0, notice: { tone: 'error', key: 'volunteerLeft' } });

    await ana.setUser('ana');
    ana.watchOpen();
    await settle();
    expect(ana.getState().open.map(r => r.id)).toEqual([id]);
    expect(await ana.accept(id)).toBe(true);
    await settle();
    expect(visitor.getState()).toMatchObject({ status: 'matched', match: { volunteer: { firstName: 'Ana' } }, notice: null });
    // The earlier chat stays between Rosa and Sam.
    expect(ana.getState().messages).toEqual([]);
    expect(await server.dbFor('ana').messages(id)).toEqual([]);
    visitor.sendMessage('Hola Ana');
    await settle();
    expect(ana.getState().messages.map(m => m.text)).toEqual(['Hola Ana']);
    expect(await server.dbFor('sam').messages(id)).toEqual([]);
  });

  it('a second Accept while already helping is refused, and the desk shows the request it already has', async () => {
    const { sam, id, server } = await matched();
    // Sam's tablet never heard about the first Accept.
    const tablet = createDeskStore(createLiveBackend(server.dbFor('sam')));
    tablet.watchOpen();
    await server.dbFor('lee').insertRequest(leeRequest('lee-1'));
    await settle();
    expect(await tablet.accept('lee-1')).toBe(false);
    await settle();
    expect(server.requests.get('lee-1')?.status).toBe('open');
    expect(tablet.getState().assignment?.id).toBe(id);
    expect(sam.getState().assignment?.id).toBe(id);
  });

  it('a restore that fails (offline) tries again until it gets the accepted request back, and stops on sign-out', async () => {
    const { id, server } = await matched();
    const db = server.dbFor('sam');
    let failures = 2;
    const flaky: HelpDb = {
      ...db,
      activeAssignment: async who => {
        if (failures-- > 0) throw new Error('offline');
        return db.activeAssignment(who);
      },
    };
    const again = createDeskStore(createLiveBackend(flaky));
    await again.setUser('sam');
    expect(again.isRestored()).toBe(true);
    expect(again.getState().assignment).toBeNull();
    await settle(60_000);
    expect(again.getState().assignment?.id).toBe(id);

    failures = 1;
    const leaving = createDeskStore(createLiveBackend(flaky));
    await leaving.setUser('sam');
    await leaving.setUser(null);
    await settle(60_000);
    expect(leaving.getState().assignment).toBeNull();
  });

  it('the open list goes by the server’s clock, not the phone’s', async () => {
    jest.setSystemTime(Date.parse('2031-03-01T00:00:00Z')); // the phone's clock is years ahead
    const server = fakeServer();
    const { visitor, sam } = devices(server);
    await sam.setUser('sam');
    sam.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    expect(sam.getState().open.map(r => [r.id, r.minutesAgo])).toEqual([[id, 0]]);
    server.advance(3 * 60 * 1000 + 30 * 1000);
    await settle(OPEN_REFRESH_MS);
    expect(sam.getState().open.map(r => r.minutesAgo)).toEqual([3]);
    server.advance(2 * 60 * 1000);
    await settle(OPEN_REFRESH_MS);
    expect(sam.getState().open).toEqual([]); // past the 5-minute window
  });

  it('a message that fails to send is marked, and retrying sends it', async () => {
    const { visitor, sam, server } = await matched();
    server.control.rejectSends = true;
    sam.sendMessage('On my way');
    visitor.sendMessage('Estoy en la rampa');
    await settle();
    const samMsg = sam.getState().messages.at(-1)!;
    const rosaMsg = visitor.getState().messages.at(-1)!;
    expect(samMsg).toMatchObject({ from: 'me', text: 'On my way', failed: true });
    expect(rosaMsg).toMatchObject({ from: 'me', text: 'Estoy en la rampa', failed: true });

    server.control.rejectSends = false;
    sam.retryMessage(samMsg.id);
    visitor.retryMessage(rosaMsg.id);
    expect(sam.getState().messages.at(-1)?.failed).toBeFalsy(); // sending again
    await settle();
    expect(sam.getState().messages.map(m => [m.from, m.text, !!m.failed])).toEqual([['me', 'On my way', false], ['them', 'Estoy en la rampa', false]]);
    expect(visitor.getState().messages.map(m => [m.from, m.text, !!m.failed])).toEqual([['me', 'Estoy en la rampa', false], ['them', 'On my way', false]]);
    expect(server.messages.map(m => m.text).sort()).toEqual(['Estoy en la rampa', 'On my way']);
  });

  it('history loaded when the desk joins isn’t counted as unread, even when a poll answers before it', async () => {
    const { visitor, id, server } = await matched();
    visitor.sendMessage('Hola');
    visitor.sendMessage('Estoy en la rampa');
    await settle();
    const db = server.dbFor('sam');
    let calls = 0;
    const slowFirst: HelpDb = {
      ...db,
      // The first fetch, whoever makes it, is slow, so a later one answers first.
      messages: (requestId, since) =>
        calls++ === 0 ? new Promise(r => setTimeout(r, 1000)).then(() => db.messages(requestId, since)) : db.messages(requestId, since),
      subscribe: (_spec, _onRow, onLive) => {
        queueMicrotask(() => onLive(false));
        return () => {};
      },
    };
    const again = createDeskStore(createLiveBackend(slowFirst));
    await again.setUser('sam');
    await settle(1000);
    await settle(POLL_MS);
    expect(again.getState().assignment?.id).toBe(id);
    expect(again.getState().messages.map(m => m.text)).toEqual(['Hola', 'Estoy en la rampa']);
    expect(again.getState().unread).toBe(0);
    visitor.sendMessage('¿Dónde estás?');
    await settle(POLL_MS);
    expect(again.getState().unread).toBe(1);
  });

  it('a visitor’s restored chat doesn’t count messages it already had as unread', async () => {
    const server = fakeServer();
    const data = new Map<string, string>();
    const persist = {
      key: 'venu.volunteer.request',
      storage: { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v); }, removeItem: async (k: string) => { data.delete(k); } },
    };
    const visitor = createRequestStore(createLiveBackend(server.dbFor('rosa')), persist);
    await visitor.setUser('rosa');
    const sam = createDeskStore(createLiveBackend(server.dbFor('sam')));
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    expect(await sam.accept(visitor.getState().request!.id)).toBe(true);
    await settle();
    sam.sendMessage('On my way');
    await settle();
    expect(visitor.getState().unread).toBe(1);
    visitor.markRead();
    await settle();

    const restarted = createRequestStore(createLiveBackend(server.dbFor('rosa')), persist);
    await restarted.setUser('rosa');
    await settle(POLL_MS);
    expect(restarted.getState()).toMatchObject({ status: 'matched', unread: 0 });
    expect(restarted.getState().messages.map(m => m.text)).toEqual(['On my way']);
  });

  it('accepting a request the visitor withdrew says so, not that someone else took it', async () => {
    const server = fakeServer();
    const { visitor, sam } = devices(server);
    await sam.setUser('sam');
    sam.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    visitor.cancel();
    await settle();
    expect(sam.getState().open.map(r => r.id)).toEqual([id]); // the list hasn't refreshed yet
    expect(await sam.accept(id)).toBe(false);
    expect(sam.getState()).toMatchObject({ assignment: null, notice: { tone: 'error', key: 'withdrawn' }, open: [] });
  });

  it('polling fetches only messages newer than the last one seen', async () => {
    const server = fakeServer({ realtime: false });
    const db = server.dbFor('sam');
    const fetches = jest.spyOn(db, 'messages');
    const visitor = createRequestStore(createLiveBackend(server.dbFor('rosa')));
    const sam = createDeskStore(createLiveBackend(db));
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    expect(await sam.accept(id)).toBe(true);
    await settle(POLL_MS);
    expect(visitor.getState().status).toBe('matched');
    visitor.sendMessage('Hola');
    await settle(POLL_MS);
    expect(sam.getState().messages.map(m => m.text)).toEqual(['Hola']);
    await settle(POLL_MS);
    expect(fetches.mock.calls.at(-1)).toEqual([id, server.messages[0]!.created_at]);
  });

  it('a burst of request changes refreshes the open list once', async () => {
    const server = fakeServer();
    const db = server.dbFor('sam');
    const fetches = jest.spyOn(db, 'openRequests');
    const sam = createDeskStore(createLiveBackend(db));
    sam.watchOpen();
    await settle();
    const before = fetches.mock.calls.length;
    for (let i = 0; i < 5; i++) await server.dbFor('lee').insertRequest(leeRequest(`lee-${i}`));
    await settle(300);
    expect(fetches.mock.calls.length - before).toBe(1);
    expect(sam.getState().open).toHaveLength(5);
  });
});

describe('the Supabase calls', () => {
  it('maps the accept function’s errors to the app’s', async () => {
    const failing = (message: string) => ({ rpc: async () => ({ data: null, error: { message, code: 'P0001' } }) }) as unknown as SupabaseClient;
    await expect(supabaseHelpDb(failing('already_taken')).accept('r1')).rejects.toBeInstanceOf(AlreadyTakenError);
    await expect(supabaseHelpDb(failing('request_closed')).accept('r1')).rejects.toBeInstanceOf(RequestClosedError);
    await expect(supabaseHelpDb(failing('already_helping')).accept('r1')).rejects.toBeInstanceOf(AlreadyHelpingError);
    await expect(supabaseHelpDb(failing('not_verified')).accept('r1')).rejects.toBeInstanceOf(NotVerifiedError);
  });

  it('lists open requests and hands a request back through the database functions', async () => {
    const rpc = jest.fn(async () => ({ data: [], error: null }));
    const db = supabaseHelpDb({ rpc } as unknown as SupabaseClient);
    await db.openRequests();
    await db.release('r1');
    expect(rpc.mock.calls).toEqual([['open_help_requests'], ['release_help_request', { p_request_id: 'r1' }]]);
  });

  it('inserts ratings and problem reports into help_feedback without reading them back', async () => {
    const insert = jest.fn(async (_row: unknown) => ({ error: null as null | { code: string; message: string } }));
    const from = jest.fn((_table: string) => ({ insert }));
    const backend = createLiveBackend(supabaseHelpDb({ from } as unknown as SupabaseClient));
    await backend.submitFeedback({ requestId: 'r1', volunteerId: 'sam', stars: 5, tags: ['fast'], note: ' Great ' });
    await backend.reportProblem({ requestId: 'r1', volunteerId: 'sam', kind: 'unsafe', note: 'x'.repeat(1200) });
    expect(from.mock.calls).toEqual([['help_feedback'], ['help_feedback']]);
    expect(insert.mock.calls[0]![0]).toEqual({ request_id: 'r1', kind: 'rating', stars: 5, tags: ['fast'], problem: null, note: 'Great' });
    expect(insert.mock.calls[1]![0]).toMatchObject({ request_id: 'r1', kind: 'problem', stars: null, tags: [], problem: 'unsafe' });
    expect((insert.mock.calls[1]![0] as { note: string }).note).toHaveLength(1000);
  });

  it('a rating saved before (23505, a retried Submit) counts as sent; other errors throw', async () => {
    const failing = (code: string) => ({ from: () => ({ insert: async () => ({ error: { code, message: code } }) }) }) as unknown as SupabaseClient;
    const rating = { request_id: 'r1', kind: 'rating' as const, stars: 5, tags: [], problem: null, note: '' };
    await expect(supabaseHelpDb(failing('23505')).insertFeedback(rating)).resolves.toBeUndefined();
    await expect(supabaseHelpDb(failing('42501')).insertFeedback(rating)).rejects.toMatchObject({ code: '42501' });
    await expect(supabaseHelpDb(failing('23505')).insertFeedback({ ...rating, kind: 'problem', stars: null, problem: 'rude' }))
      .rejects.toMatchObject({ code: '23505' });
  });

  it('withdraws through withdraw_open_request and reads a null row (all nulls) as none', async () => {
    const row = { id: 'r1', status: 'matched' };
    const rpc = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: null }>>()
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: { id: null, status: null }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const db = supabaseHelpDb({ rpc } as unknown as SupabaseClient);
    expect(await db.withdraw('r1')).toEqual(row);
    expect(await db.withdraw('r1')).toBeNull();
    expect(await db.withdraw('r1')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('withdraw_open_request', { p_request_id: 'r1' });
  });
});

// Found by the two-browser test on 2026-11-18 (findings-visitor F3/F16/F18, findings-volunteer F5/F11/F14/F23).
describe('help request lifecycle', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('a search timer that fires late, after a volunteer accepted, shows the match and leaves the volunteer’s chat alone', async () => {
    const server = fakeServer();
    // The visitor's phone is asleep: its polls and Realtime never see the Accept.
    const asleep: HelpDb = { ...server.dbFor('rosa'), subscribe: () => () => {}, getRequest: () => new Promise(() => {}) };
    const visitor = createRequestStore(createLiveBackend(asleep));
    const sam = createDeskStore(createLiveBackend(server.dbFor('sam')));
    await sam.setUser('sam');
    sam.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    await settle(SEARCH_TIMEOUT_MS - 5000);
    expect(await sam.accept(id)).toBe(true); // 1:55 in
    await settle(5000); // the visitor's 2-minute timer fires: too late to withdraw it

    expect(server.requests.get(id)).toMatchObject({ status: 'matched', volunteer_id: 'sam', closed_by: null });
    expect(visitor.getState()).toMatchObject({ status: 'matched', match: { volunteer: { firstName: 'Sam' } } });
    expect(sam.getState()).toMatchObject({ assignment: { id }, notice: null });
    // And they can talk.
    sam.sendMessage('On my way');
    await settle(POLL_MS);
    expect(sam.getState().assignment?.id).toBe(id);
  });

  it('a search nobody took is withdrawn on time: off the list, and a late Accept hears it was withdrawn', async () => {
    const server = fakeServer();
    const { visitor, sam } = devices(server);
    await sam.setUser('sam');
    sam.watchOpen();
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    await settle(SEARCH_TIMEOUT_MS);
    expect(visitor.getState().status).toBe('notFound');
    expect(server.requests.get(id)).toMatchObject({ status: 'cancelled', closed_by: 'rosa' });
    expect(await sam.accept(id)).toBe(false);
    expect(sam.getState().notice?.key).toBe('withdrawn');
  });

  it('“Can’t make it” hands the request back: the visitor searches again (no rating), and another volunteer takes it', async () => {
    const { visitor, sam, ana, id, server } = await matched();
    expect(await sam.handBack()).toBe(true);
    expect(sam.getState()).toMatchObject({ assignment: null, notice: { tone: 'success', key: 'handedBack', params: { name: 'Rosa' } } });
    await settle();
    expect(server.requests.get(id)).toMatchObject({ status: 'open', volunteer_id: null, closed_by: null });
    expect(visitor.getState()).toMatchObject({ status: 'searching', match: null, notice: { key: 'volunteerLeft' } });
    // Not back on Sam's own list; Ana gets it.
    await settle(OPEN_REFRESH_MS);
    expect(sam.getState().open.map(r => r.id)).not.toContain(id);
    await ana.setUser('ana');
    ana.watchOpen();
    await settle();
    expect(await ana.accept(id)).toBe(true);
    await settle();
    expect(visitor.getState()).toMatchObject({ status: 'matched', match: { volunteer: { firstName: 'Ana' } } });
  });

  it('a hand-back that fails (offline) keeps the request on the card', async () => {
    const server = fakeServer();
    const flaky: HelpDb = { ...server.dbFor('sam'), release: async () => { throw new Error('offline'); } };
    const visitor = createRequestStore(createLiveBackend(server.dbFor('rosa')));
    const sam = createDeskStore(createLiveBackend(flaky));
    await sam.setUser('sam');
    void visitor.sendRequest(rosaNeedsHelp);
    await settle();
    const id = visitor.getState().request!.id;
    expect(await sam.accept(id)).toBe(true);
    expect(await sam.handBack()).toBe(false);
    expect(sam.getState().assignment?.id).toBe(id);
    expect(server.requests.get(id)?.status).toBe('matched');
  });

  it('the volunteer ending the chat tells the visitor who ended it, above the rating', async () => {
    const { visitor, sam } = await matched();
    sam.endChat();
    await settle();
    expect(visitor.getState()).toMatchObject({ status: 'done', notice: { tone: 'success', key: 'volunteerEnded', params: { name: 'Sam' } } });
    visitor.skipFeedback();
    expect(visitor.getState()).toMatchObject({ status: 'idle', notice: null });
  });

  it('marking help as done yourself shows no “ended the chat” note', async () => {
    const { visitor } = await matched();
    visitor.endHelp();
    await settle();
    expect(visitor.getState()).toMatchObject({ status: 'done', notice: null });
  });

  it('a request called off by neither person (account deleted) doesn’t blame the visitor', async () => {
    const server = fakeServer({ realtime: false });
    const { visitor, sam, id } = await matched(server);
    void visitor;
    // 20261118030000_account_deletion.sql: cancelled with no closed_by.
    server.requests.set(id, { ...server.requests.get(id)!, status: 'cancelled', closed_at: new Date().toISOString(), visitor_id: null as never });
    await settle(POLL_MS);
    expect(sam.getState()).toMatchObject({ assignment: null, notice: { key: 'closed', params: { name: 'Rosa' } } });
  });
});

describe('local mode', () => {
  it('the mock backend has no volunteer side, so the volunteer home keeps its examples', async () => {
    const desk = createDeskStore(createMockBackend());
    expect(desk.live).toBe(false);
    expect(await desk.accept('in-1')).toBe(false);
    await desk.setUser('sam');
    expect(desk.getState().assignment).toBeNull();
    expect(desk.isRestored()).toBe(true);
  });
});
