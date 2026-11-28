// VolunteerBackend on Supabase: help_requests and messages (supabase/migrations/20261117010000_help_requests_chat.sql),
// and ratings / problem reports after help in help_feedback (20261118010000_reports_feedback.sql).
// A stand-in for real matching: the visitor opens a request, every free volunteer sees it, and the
// first to Accept gets it (accept_help_request is atomic). Changes arrive over Realtime; if the
// channel doesn't reach SUBSCRIBED (e.g. the local mock server has no Realtime), it polls every 2 s.
//
// The database calls sit behind `HelpDb`, so tests drive the same backend with an in-memory fake:
//   createSupabaseBackend(supabase)            the app
//   createLiveBackend(fakeDb)                  tests
import type { SupabaseClient } from '@supabase/supabase-js';

import { chatLanguage } from '@/features/translate/languages';
import { languageName } from '@/features/profile/options';

import { abortError, AlreadyHelpingError, AlreadyTakenError, NotVerifiedError, RequestClosedError, type VolunteerBackend } from './backend';
import { HELP_TYPES } from './mock';
import type {
  Assignment, ChatMessage, ClosedStatus, Feedback, HelpRequest, HelpTypeId, IncomingRequest, Match, ProblemReport, SkillCode, Volunteer,
} from './types';

export type RequestStatusRow = 'open' | 'matched' | 'cancelled' | 'done';

/** A help_requests row, as PostgREST returns it. */
export interface RequestRow {
  id: string;
  visitor_id: string;
  visitor_name: string;
  venue_id: string;
  spot: string | null;
  help_types: string[];
  note: string;
  language: string;
  status: RequestStatusRow;
  volunteer_id: string | null;
  volunteer_name: string | null;
  volunteer_languages: string[] | null;
  volunteer_trainings: string[] | null;
  closed_by: string | null;
  created_at: string;
  /** When it last opened: created_at, or when a volunteer handed it back. The open list's window counts from it. */
  opened_at: string;
  matched_at: string | null;
  closed_at: string | null;
}

/** A row from open_help_requests(): an open request and its age by the server's clock, e.g. 210 (3½ min). */
export type OpenRequestRow = RequestRow & { age_seconds: number };

/** What the visitor's app inserts; the database fills in the rest (visitor_id from the session). */
export type NewRequestRow = Pick<RequestRow, 'id' | 'visitor_name' | 'venue_id' | 'spot' | 'help_types' | 'note' | 'language'>;

export interface MessageRow {
  id: string;
  request_id: string;
  sender_id: string;
  text: string;
  language: string | null;
  created_at: string;
}

export type NewMessageRow = Pick<MessageRow, 'request_id' | 'text' | 'language'>;

/**
 * What the visitor's app inserts into help_feedback after help: stars ('rating') or "Report a
 * problem" ('problem'). The database fills in the author (the session) and time.
 */
export interface NewFeedbackRow {
  request_id: string;
  kind: 'rating' | 'problem';
  /** 1–5 for a rating, null for a problem report. */
  stars: number | null;
  tags: string[];
  /** e.g. 'no_show' for a problem report, null for a rating. */
  problem: string | null;
  note: string;
}

/** help_feedback.note's limit. */
export const FEEDBACK_NOTE_MAX = 1000;

export type WatchSpec = { table: 'help_requests'; filter?: string } | { table: 'messages'; filter: string };

/** The few database calls the backend makes. supabaseHelpDb() is the real one. */
export interface HelpDb {
  /** The signed-in user's id; rejects when signed out. */
  me(): Promise<string>;
  /** Inserts a request; an id that's already there (a search resumed after a restart) is fine. */
  insertRequest(row: NewRequestRow): Promise<void>;
  getRequest(id: string): Promise<RequestRow | null>;
  /** open_help_requests(): requests opened in the last 5 minutes by the server's clock, newest first. */
  openRequests(): Promise<OpenRequestRow[]>;
  /** The matched request `volunteerId` accepted most recently, if any. */
  activeAssignment(volunteerId: string): Promise<RequestRow | null>;
  /**
   * accept_help_request; rejects with AlreadyTakenError (another volunteer has it), RequestClosedError
   * (cancelled or finished) or AlreadyHelpingError (this volunteer already has a matched request).
   */
  accept(id: string): Promise<RequestRow>;
  close(id: string, status: ClosedStatus): Promise<void>;
  /**
   * withdraw_open_request: cancels the request only while it's still open, and returns it either
   * way ('matched' when a volunteer took it first); null when it isn't the caller's.
   */
  withdraw(id: string): Promise<RequestRow | null>;
  /** release_help_request: the matched volunteer hands the request back, and it's open again. */
  release(id: string): Promise<void>;
  /** The messages on a request you may read, oldest first; with `sinceIso`, only those created at or after it. */
  messages(requestId: string, sinceIso?: string): Promise<MessageRow[]>;
  sendMessage(row: NewMessageRow): Promise<void>;
  /** Saves a rating or problem report; a rating already saved for this request (a retried Submit) is fine. */
  insertFeedback(row: NewFeedbackRow): Promise<void>;
  /**
   * Realtime changes to `spec`'s rows: `onRow` gets the new row (null for a delete), `onLive` whether
   * the channel is subscribed (true) or failed / closed (false). Returns a function that leaves.
   */
  subscribe<Row>(spec: WatchSpec, onRow: (row: Row | null) => void, onLive: (live: boolean) => void): () => void;
}

/** Poll this often while Realtime isn't subscribed. */
export const POLL_MS = 2000;
/** Wait this long for Realtime to subscribe before polling. */
export const CONNECT_GRACE_MS = 3000;
/**
 * Refetch the open list this often even with Realtime on: a request that's taken or cancelled stops
 * being visible to other volunteers (RLS), so Realtime never tells them; this also keeps "3 min ago" fresh.
 */
export const OPEN_REFRESH_MS = 5000;
/**
 * Changes to help_requests within this long refresh the open list once, so a burst of requests
 * (or a busy venue) costs one fetch instead of one each.
 */
export const CHANGE_BATCH_MS = 300;
// Requests opened more than 5 minutes ago aren't listed (the visitor's app gives up after 2:
// SEARCH_TIMEOUT_MS). The server applies that window by its own clock: open_help_requests().

// ---- mapping

/** A v4 UUID for a new request (the table's id column is a uuid). */
export function randomUuid(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function requestToRow(r: HelpRequest): NewRequestRow {
  return {
    id: r.id,
    visitor_name: r.visitorName.slice(0, 40),
    venue_id: r.location.venueId,
    spot: r.location.facilityId,
    help_types: r.helpTypes,
    note: r.note.slice(0, 500),
    language: r.language,
  };
}

const SKILLS: SkillCode[] = ['wheelchair', 'first_aid', 'asl'];

function helpTypes(values: string[]): HelpTypeId[] {
  const known = values.filter((v): v is HelpTypeId => (HELP_TYPES as string[]).includes(v));
  return known.length ? known : ['other'];
}

/**
 * The volunteer on an accepted request, from the snapshot accept_help_request took of their profile.
 * e.g. { volunteer_name: 'Sam', volunteer_languages: ['en','es'], volunteer_trainings: ['first_aid'] }
 *   → Sam, tags First aid (green), English, Español (yellow), no rating yet.
 */
export function rowToVolunteer(row: RequestRow): Volunteer {
  const name = row.volunteer_name?.trim() || '?';
  const languages = row.volunteer_languages ?? [];
  const skills = (row.volunteer_trainings ?? []).filter((s): s is SkillCode => (SKILLS as string[]).includes(s));
  return {
    id: row.volunteer_id ?? '',
    name,
    firstName: name,
    // The profile promises gender is never shown, so a live match never says his or her.
    possessive: 'their',
    languages,
    rating: null,
    tags: [
      ...skills.map(skill => ({ label: skill, skill, tone: 'success' as const })),
      ...languages.map(code => ({ label: languageName(code), tone: 'warning' as const })),
    ],
  };
}

export function rowToMatch(row: RequestRow): Match {
  const volunteer = rowToVolunteer(row);
  return { volunteer, language: chatLanguage(volunteer.languages), etaMinutes: null, distanceFeet: null };
}

/** "3 min ago" comes from the server's count of seconds, so a phone with its clock off still shows it right. */
export function rowToIncoming(row: OpenRequestRow): IncomingRequest {
  return {
    id: row.id,
    visitorName: row.visitor_name,
    helpType: helpTypes(row.help_types)[0]!,
    location: { venueId: row.venue_id, facilityId: row.spot },
    language: row.language,
    minutesAgo: Math.max(0, Math.floor(row.age_seconds / 60)),
    distanceFeet: null,
    note: row.note,
  };
}

export function rowToAssignment(row: RequestRow): Assignment {
  return {
    id: row.id,
    visitorName: row.visitor_name,
    helpTypes: helpTypes(row.help_types),
    note: row.note,
    language: row.language,
    location: { venueId: row.venue_id, facilityId: row.spot },
    createdAt: Date.parse(row.created_at),
  };
}

export function rowToMessage(row: MessageRow, me: string): ChatMessage {
  return {
    id: row.id,
    from: row.sender_id === me ? 'me' : 'them',
    text: row.text,
    sentAt: Date.parse(row.created_at),
    ...(row.language ? { lang: row.language } : {}),
  };
}

const isClosed = (s: RequestStatusRow): s is ClosedStatus => s === 'cancelled' || s === 'done';

/** e.g. 4 stars, ['patient'], ' Thanks ' → { kind: 'rating', stars: 4, tags: ['patient'], problem: null, note: 'Thanks' }. */
export function feedbackToRow(f: Feedback): NewFeedbackRow {
  return { request_id: f.requestId, kind: 'rating', stars: f.stars, tags: f.tags, problem: null, note: f.note.trim().slice(0, FEEDBACK_NOTE_MAX) };
}

export function problemToRow(r: ProblemReport): NewFeedbackRow {
  return { request_id: r.requestId, kind: 'problem', stars: null, tags: [], problem: r.kind, note: r.note.trim().slice(0, FEEDBACK_NOTE_MAX) };
}

// ---- live updates

/**
 * Keeps `refresh` running against the database: once now, on every Realtime change (`onRow`), once
 * more when the channel subscribes (to catch anything missed while connecting), and every POLL_MS
 * while it isn't subscribed. `everyMs` refreshes on a timer even while subscribed. Returns a stop function.
 */
export function watch<Row>(
  db: HelpDb,
  spec: WatchSpec,
  onRow: (row: Row | null) => void,
  refresh: () => void,
  everyMs?: number,
): () => void {
  let stopped = false;
  /** null until the channel first reports. */
  let live: boolean | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  const startPolling = () => { if (!poll && !stopped) poll = setInterval(refresh, POLL_MS); };
  const stopPolling = () => { if (poll) clearInterval(poll); poll = null; };
  const grace = setTimeout(() => { if (live !== true) startPolling(); }, CONNECT_GRACE_MS);
  const steady = everyMs ? setInterval(() => { if (live) refresh(); }, everyMs) : null;
  const leave = db.subscribe<Row>(
    spec,
    row => { if (!stopped) onRow(row); },
    isLive => {
      if (stopped || isLive === live) return;
      live = isLive;
      if (isLive) {
        stopPolling();
        refresh();
      } else startPolling();
    },
  );
  refresh();
  return () => {
    stopped = true;
    clearTimeout(grace);
    if (steady) clearInterval(steady);
    stopPolling();
    leave();
  };
}

// ---- the backend

export function createLiveBackend(db: HelpDb): VolunteerBackend {
  /** Inserts in flight, so a cancel that races its insert waits for the row to exist first. */
  const inserting = new Map<string, Promise<void>>();

  async function close(requestId: string, status: ClosedStatus) {
    await inserting.get(requestId)?.catch(() => {});
    await db.close(requestId, status);
  }

  /** Runs `start` once the user id is known; the returned stop works before that too. */
  function withMe(start: (me: string) => () => void): () => void {
    let stop: (() => void) | null = null;
    let stopped = false;
    db.me().then(
      me => { if (!stopped) stop = start(me); },
      () => {},
    );
    return () => {
      stopped = true;
      stop?.();
    };
  }

  /** One watch per request row, shared by onClosed and onReleased: one channel and one poll, not two. */
  const rowWatches = new Map<string, { listeners: Set<(row: RequestRow) => void>; stop: () => void }>();

  function watchRow(requestId: string, listener: (row: RequestRow) => void): () => void {
    let entry = rowWatches.get(requestId);
    if (entry) {
      // Joining a watch that's already running: catch up on the row now, not at the next change.
      const joined = entry;
      db.getRequest(requestId).then(row => { if (row && joined.listeners.has(listener)) listener(row); }, () => {});
    } else {
      const listeners = new Set<(row: RequestRow) => void>();
      const deliver = (row: RequestRow | null) => {
        if (row?.id === requestId) listeners.forEach(l => l(row));
      };
      const stop = watch<RequestRow>(db, { table: 'help_requests', filter: `id=eq.${requestId}` }, deliver, () => {
        db.getRequest(requestId).then(deliver, () => {});
      });
      entry = { listeners, stop };
      rowWatches.set(requestId, entry);
    }
    const mine = entry;
    mine.listeners.add(listener);
    return () => {
      mine.listeners.delete(listener);
      if (mine.listeners.size || rowWatches.get(requestId) !== mine) return;
      rowWatches.delete(requestId);
      mine.stop();
    };
  }

  return {
    newRequestId: randomUuid,

    findVolunteer(request, signal) {
      return new Promise<Match>((resolve, reject) => {
        if (signal.aborted) return reject(abortError());
        let settled = false;
        let stop = () => {};
        const finish = (settle: () => void) => {
          if (settled) return;
          settled = true;
          stop();
          settle();
        };
        const check = (row: RequestRow | null) => {
          if (!row || row.id !== request.id) return;
          if (row.status === 'matched') finish(() => resolve(rowToMatch(row)));
          else if (isClosed(row.status)) finish(() => reject(new Error(`Request ${row.status}`)));
        };
        signal.addEventListener('abort', () => finish(() => reject(abortError())), { once: true });

        const insert = db.insertRequest(requestToRow(request));
        inserting.set(request.id, insert);
        insert.then(
          () => {
            inserting.delete(request.id);
            if (settled) return;
            stop = watch<RequestRow>(db, { table: 'help_requests', filter: `id=eq.${request.id}` }, check, () => {
              db.getRequest(request.id).then(check, () => {});
            });
          },
          e => {
            inserting.delete(request.id);
            finish(() => reject(e));
          },
        );
      });
    },

    cancelRequest: requestId => close(requestId, 'cancelled'),
    endHelp: requestId => close(requestId, 'done'),

    async withdrawRequest(requestId) {
      await inserting.get(requestId)?.catch(() => {});
      const row = await db.withdraw(requestId);
      return row?.status === 'matched' ? rowToMatch(row) : null;
    },

    async sendMessage(requestId, text, lang) {
      await db.sendMessage({ request_id: requestId, text, language: lang ?? null });
    },

    onMessage(requestId, listener, since) {
      return withMe(me => {
        const seen = new Set<string>();
        // Each fetch asks only for messages from the newest one seen on (inclusive, as several can
        // share a timestamp; `seen` drops the repeats), as the server wrote its time.
        let cursor = since != null ? new Date(since).toISOString() : undefined;
        let cursorMs = since ?? -Infinity;
        const deliver = (rows: MessageRow[]) => {
          for (const row of rows) {
            if (row.request_id !== requestId || seen.has(row.id)) continue;
            seen.add(row.id);
            const at = Date.parse(row.created_at);
            if (at >= cursorMs) {
              cursorMs = at;
              cursor = row.created_at;
            }
            if (row.sender_id !== me) listener(rowToMessage(row, me));
          }
        };
        return watch<MessageRow>(db, { table: 'messages', filter: `request_id=eq.${requestId}` }, row => row && deliver([row]), () => {
          db.messages(requestId, cursor).then(deliver, () => {});
        });
      });
    },

    onClosed(requestId, listener) {
      return withMe(me => {
        let told = false;
        return watchRow(requestId, row => {
          if (told || !isClosed(row.status)) return;
          told = true;
          listener({ status: row.status, byMe: row.closed_by === me, bySystem: row.closed_by == null });
        });
      });
    },

    onReleased(requestId, volunteerId, listener) {
      let told = false;
      return watchRow(requestId, row => {
        // Open again, or (handed back while this app was closed) someone else already took it.
        const released = row.status === 'open' || (row.status === 'matched' && row.volunteer_id !== volunteerId);
        if (told || !released) return;
        told = true;
        listener();
      });
    },

    async submitFeedback(feedback) {
      await db.insertFeedback(feedbackToRow(feedback));
    },
    async reportProblem(report) {
      await db.insertFeedback(problemToRow(report));
    },

    watchOpenRequests(listener) {
      let latest = 0;
      let batch: ReturnType<typeof setTimeout> | null = null;
      const refresh = () => {
        if (batch) clearTimeout(batch);
        batch = null;
        const call = ++latest;
        db.openRequests().then(
          rows => { if (call === latest) listener(rows.filter(r => r.status === 'open').map(rowToIncoming)); },
          () => {},
        );
      };
      // A change only schedules a refresh; the ones that follow within CHANGE_BATCH_MS share it.
      const soon = () => { batch ??= setTimeout(refresh, CHANGE_BATCH_MS); };
      const stop = watch<RequestRow>(db, { table: 'help_requests' }, soon, refresh, OPEN_REFRESH_MS);
      return () => {
        if (batch) clearTimeout(batch);
        latest += 1;
        stop();
      };
    },

    async acceptRequest(requestId) {
      return rowToAssignment(await db.accept(requestId));
    },

    releaseRequest: requestId => db.release(requestId),

    async currentAssignment() {
      const row = await db.activeAssignment(await db.me());
      return row ? rowToAssignment(row) : null;
    },

    async loadMessages(requestId) {
      const [me, rows] = await Promise.all([db.me(), db.messages(requestId)]);
      return rows.map(r => rowToMessage(r, me));
    },
  };
}

// ---- the real database

let channelSeq = 0;

export function supabaseHelpDb(client: SupabaseClient): HelpDb {
  const fail = (error: unknown): never => { throw error; };
  return {
    async me() {
      const { data } = await client.auth.getSession();
      const id = data.session?.user.id;
      if (!id) throw new Error('Not signed in');
      return id;
    },
    async insertRequest(row) {
      const { error } = await client.from('help_requests').insert(row);
      if (error && error.code !== '23505') fail(error); // 23505: already inserted before a restart
    },
    async getRequest(id) {
      const { data, error } = await client.from('help_requests').select('*').eq('id', id).maybeSingle();
      if (error) fail(error);
      return (data as RequestRow | null) ?? null;
    },
    async openRequests() {
      const { data, error } = await client.rpc('open_help_requests');
      if (error) fail(error);
      return (data as OpenRequestRow[] | null) ?? [];
    },
    async activeAssignment(volunteerId) {
      const { data, error } = await client
        .from('help_requests')
        .select('*')
        .eq('volunteer_id', volunteerId)
        .eq('status', 'matched')
        .order('matched_at', { ascending: false })
        .limit(1);
      if (error) fail(error);
      return ((data as RequestRow[] | null) ?? [])[0] ?? null;
    },
    async accept(id) {
      const { data, error } = await client.rpc('accept_help_request', { p_request_id: id });
      if (error) {
        if (/not_verified/.test(error.message)) throw new NotVerifiedError();
        if (/already_helping/.test(error.message)) throw new AlreadyHelpingError();
        if (/request_closed/.test(error.message)) throw new RequestClosedError();
        if (/already_taken/.test(error.message)) throw new AlreadyTakenError();
        fail(error);
      }
      return data as RequestRow;
    },
    async close(id, status) {
      const { error } = await client.rpc('close_help_request', { p_request_id: id, p_status: status });
      if (error) fail(error);
    },
    async withdraw(id) {
      const { data, error } = await client.rpc('withdraw_open_request', { p_request_id: id });
      if (error) fail(error);
      // A function returning a row type answers a null row as an object of nulls.
      const row = data as RequestRow | null;
      return row?.id ? row : null;
    },
    async release(id) {
      const { error } = await client.rpc('release_help_request', { p_request_id: id });
      if (error) fail(error);
    },
    async messages(requestId, sinceIso) {
      let query = client.from('messages').select('*').eq('request_id', requestId);
      if (sinceIso) query = query.gte('created_at', sinceIso);
      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) fail(error);
      return (data as MessageRow[] | null) ?? [];
    },
    async sendMessage(row) {
      const { error } = await client.from('messages').insert(row);
      if (error) fail(error);
    },
    async insertFeedback(row) {
      // No .select(): problem reports can't be read back (insert-only), so ask for nothing back.
      const { error } = await client.from('help_feedback').insert(row);
      if (error && !(error.code === '23505' && row.kind === 'rating')) fail(error); // 23505: rated already
    },
    subscribe<Row>(spec: WatchSpec, onRow: (row: Row | null) => void, onLive: (live: boolean) => void) {
      const filter = spec.filter ? { filter: spec.filter } : {};
      const channel = client
        .channel(`venu-${spec.table}-${(channelSeq += 1)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: spec.table, ...filter }, payload => {
          const row = payload.new as Record<string, unknown> | undefined;
          onRow(row && Object.keys(row).length ? (row as Row) : null);
        })
        .subscribe(status => onLive(status === 'SUBSCRIBED'));
      return () => { void client.removeChannel(channel); };
    },
  };
}

export function createSupabaseBackend(client: SupabaseClient): VolunteerBackend {
  return createLiveBackend(supabaseHelpDb(client));
}
