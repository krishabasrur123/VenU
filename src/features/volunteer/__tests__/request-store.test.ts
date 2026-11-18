import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import i18n from '@/i18n';

import { createMockBackend, mockVolunteerFor, type VolunteerBackend } from '../backend';
import { createRequestStore, INITIAL_STATE, parseSaved, reduce, SEARCH_TIMEOUT_MS, type KeyValueStorage, type NewRequest } from '../request-store';
import type { HelpRequest, Match, MeetPoint, RequestState } from '../types';
import { formatClock, formatDayTime, formatDistance, needsSeparator } from '../format';

// The app's store (created when the module loads) saves to AsyncStorage; tests pass their own.
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const KEY = 'venu.volunteer.request';

/** In-memory storage, standing in for AsyncStorage across an "app restart". */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async k => data.get(k) ?? null,
    setItem: async (k, v) => { data.set(k, v); },
    removeItem: async k => { data.delete(k); },
  };
}

/** Waiting at SoFi's Entry 4. */
const AT_ENTRY_4: MeetPoint = { venueId: 'sofi', facilityId: 'entry-4' };

const TIMING = { search: 1000, greeting: 500, reply: 800 };

const rosaNeedsHelp: NewRequest = {
  visitorName: 'Rosa',
  helpTypes: ['physical'],
  note: 'Stuck near ramp 2',
  photoUri: null,
  language: 'en',
  location: AT_ENTRY_4,
};

function setup() {
  return createRequestStore(createMockBackend(TIMING));
}

/** Runs timers and lets the awaited promises settle. */
async function advance(ms: number) {
  await jest.advanceTimersByTimeAsync(ms);
}

describe('volunteer request store', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('goes idle → searching → matched, then the volunteer says hello', async () => {
    const store = setup();
    const done = store.sendRequest(rosaNeedsHelp);
    expect(store.getState().status).toBe('searching');
    expect(store.getState().request?.helpTypes).toEqual(['physical']);

    await advance(TIMING.search);
    await done;
    const matched = store.getState();
    expect(matched.status).toBe('matched');
    expect(matched.match?.volunteer.name).toBe('Daniel K.');
    expect(matched.unread).toBe(0);

    await advance(TIMING.greeting);
    expect(store.getState().messages.map(m => m.from)).toEqual(['them']);
    expect(store.getState().messages[0]!.text).toBe(
      "Hi Rosa! I'm Daniel, your LA28 volunteer. I'm heading to you now. Meeting point: Entry 4.",
    );
    expect(store.getState().unread).toBe(1);

    store.markRead();
    expect(store.getState().unread).toBe(0);
  });

  it('matches someone who speaks the requested language', async () => {
    const store = setup();
    const done = store.sendRequest({ ...rosaNeedsHelp, language: 'ko' });
    await advance(TIMING.search);
    await done;
    expect(store.getState().match?.volunteer.languages).toContain('ko');
  });

  it('adds my message, then a mock reply', async () => {
    const store = setup();
    const done = store.sendRequest(rosaNeedsHelp);
    await advance(TIMING.search + TIMING.greeting);
    await done;

    store.sendMessage('  I am by the blue sign  ');
    store.sendMessage('   '); // ignored
    expect(store.getState().messages.at(-1)).toMatchObject({ from: 'me', text: 'I am by the blue sign' });

    await advance(TIMING.reply);
    const { messages } = store.getState();
    expect(messages.map(m => m.from)).toEqual(['them', 'me', 'them']);
  });

  it('shows the volunteer typing while a reply is on its way', async () => {
    const store = setup();
    const done = store.sendRequest(rosaNeedsHelp);
    await advance(TIMING.search);
    await done;
    expect(store.getState().typing).toBe(true); // the greeting is coming
    await advance(TIMING.greeting);
    expect(store.getState().typing).toBe(false);

    store.sendMessage('Where are you?');
    await advance(0);
    expect(store.getState().typing).toBe(true);
    await advance(TIMING.reply);
    expect(store.getState().typing).toBe(false);
    expect(store.getState().messages.at(-1)?.from).toBe('them');

    store.sendMessage('Thanks');
    await advance(0);
    store.endHelp();
    expect(store.getState().typing).toBe(false);
  });

  it('cancelling while searching drops the late match', async () => {
    const store = setup();
    const done = store.sendRequest(rosaNeedsHelp);
    store.cancel();
    expect(store.getState()).toEqual(INITIAL_STATE);
    await advance(TIMING.search * 2);
    await done;
    expect(store.getState().status).toBe('idle');
  });

  it('cancelling a match stops its messages', async () => {
    const store = setup();
    const done = store.sendRequest(rosaNeedsHelp);
    await advance(TIMING.search);
    await done;
    store.cancel();
    await advance(TIMING.greeting + TIMING.reply);
    expect(store.getState()).toEqual(INITIAL_STATE);
  });

  it('ending help asks for feedback; submitting returns home with a thank-you', async () => {
    const store = setup();
    const done = store.sendRequest(rosaNeedsHelp);
    await advance(TIMING.search);
    await done;

    store.endHelp();
    expect(store.getState().status).toBe('done');
    await advance(TIMING.greeting); // the greeting arrives after the help ended: ignored
    expect(store.getState().messages).toEqual([]);

    await store.submitFeedback(5, ['patient', 'helpful'], ' Thank you ');
    expect(store.getState().status).toBe('idle');
    // Kept as a key + values, so the banner words it in whatever language is on screen when it shows.
    expect(store.getState().notice).toEqual({ tone: 'success', key: 'thanks', params: { name: 'Daniel' } });

    store.dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  it('a failed search returns to the form with an error', async () => {
    const backend = createMockBackend(TIMING);
    backend.findVolunteer = () => Promise.reject(new Error('offline'));
    const store = createRequestStore(backend);
    await store.sendRequest(rosaNeedsHelp);
    expect(store.getState().status).toBe('idle');
    expect(store.getState().notice).toEqual({ tone: 'error', key: 'searchFailed' });
  });

  it('keeps the form draft through a failed search and a cancel, and clears it once help ends', async () => {
    const backend = createMockBackend(TIMING);
    const find = backend.findVolunteer;
    backend.findVolunteer = () => Promise.reject(new Error('offline'));
    const store = createRequestStore(backend);
    store.setUser('rosa');
    store.editDraft({ helpTypes: ['physical', 'language'], note: 'By the ramp', language: 'es' });
    store.editDraft({ photoUri: 'file:///ramp.jpg' });
    const draft = { helpTypes: ['physical', 'language'], note: 'By the ramp', photoUri: 'file:///ramp.jpg', language: 'es' };

    await store.sendRequest(rosaNeedsHelp);
    expect(store.getState().notice?.tone).toBe('error');
    expect(store.getState().draft).toEqual(draft);

    backend.findVolunteer = find;
    void store.sendRequest(rosaNeedsHelp);
    expect(store.getState().draft).toEqual(draft); // still there while searching
    store.cancel();
    expect(store.getState().draft).toEqual(draft);

    const done = store.sendRequest(rosaNeedsHelp);
    await advance(TIMING.search);
    await done;
    store.endHelp();
    expect(store.getState().draft).toBeNull();
  });

  it('signing out calls off the request and clears it, so the next user starts fresh', async () => {
    const backend = createMockBackend(TIMING);
    const cancelRequest = jest.spyOn(backend, 'cancelRequest');
    const store = createRequestStore(backend);
    store.setUser('rosa');
    const done = store.sendRequest(rosaNeedsHelp);
    await advance(TIMING.search + TIMING.greeting);
    await done;
    store.sendMessage('I am by the blue sign');
    const requestId = store.getState().request!.id;

    store.setUser(null);
    expect(store.getState()).toEqual(INITIAL_STATE);
    expect(cancelRequest).toHaveBeenCalledWith(requestId);
    await advance(TIMING.reply * 2); // the pending reply never lands
    expect(store.getState()).toEqual(INITIAL_STATE);

    store.setUser('sam');
    expect(store.getState()).toEqual(INITIAL_STATE);
  });

  it('ignores a draft edit that lands after sign-out, so the next user never sees the note', async () => {
    const storage = memoryStorage();
    const store = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
    await store.setUser('rosa');
    store.editDraft({ note: 'Near gate 2' });
    expect(store.getState().draft?.note).toBe('Near gate 2');

    await store.setUser(null);
    // The request form unmounts after sign-out and dictation saves its last words.
    store.editDraft({ note: 'Near gate 2, by the blue sign' });
    expect(store.getState().draft).toBeNull();

    await store.setUser('sam');
    expect(store.getState()).toEqual(INITIAL_STATE);
    expect(storage.data.has(KEY)).toBe(false);
  });

  it('another user signing in drops a search in progress', async () => {
    const store = setup();
    store.setUser('rosa');
    const done = store.sendRequest(rosaNeedsHelp);
    store.setUser('sam');
    expect(store.getState()).toEqual(INITIAL_STATE);
    await advance(TIMING.search * 2);
    await done;
    expect(store.getState().status).toBe('idle');
  });

  it('the same user loading again keeps the request', async () => {
    const store = setup();
    store.setUser('rosa');
    const done = store.sendRequest(rosaNeedsHelp);
    await advance(TIMING.search);
    await done;
    store.setUser('rosa');
    expect(store.getState().status).toBe('matched');
  });

  describe('saving across a restart', () => {
    it('brings back a matched request with its chat, and the chat keeps working', async () => {
      const storage = memoryStorage();
      const before = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await before.setUser('rosa');
      const done = before.sendRequest(rosaNeedsHelp);
      await advance(TIMING.search + TIMING.greeting);
      await done;
      before.sendMessage('I am by the blue sign');
      await advance(0);
      const saved = before.getState();

      // A reload: a fresh store and backend over the same storage.
      const after = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      expect(after.isRestored()).toBe(false);
      await after.setUser('rosa');
      expect(after.isRestored()).toBe(true);
      expect(after.getState()).toMatchObject({ status: 'matched', match: saved.match, messages: saved.messages, request: saved.request });

      after.sendMessage('Are you close?');
      await advance(TIMING.reply);
      expect(after.getState().messages.map(m => m.from)).toEqual(['them', 'me', 'me', 'them']);
    });

    it('keeps the volunteer writing in their language, tagged, after a restart in another UI language', async () => {
      const storage = memoryStorage();
      const before = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await before.setUser('rosa');
      const done = before.sendRequest({ ...rosaNeedsHelp, language: 'es' });
      await advance(TIMING.search + TIMING.greeting);
      await done;
      expect(before.getState().match?.language).toBe('en');

      await i18n.changeLanguage('es');
      try {
        const after = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
        await after.setUser('rosa');
        expect(after.getState().match?.language).toBe('en');
        after.sendMessage('¿Estás cerca?');
        await advance(TIMING.reply);
        expect(after.getState().messages.at(-1)).toMatchObject({ from: 'them', text: "Got it, thanks! I'll be there in a couple of minutes.", lang: 'en' });
      } finally {
        await i18n.changeLanguage('en');
      }
    });

    it('fills in the volunteer’s language for a request saved before it was stored', async () => {
      const storage = memoryStorage();
      const before = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await before.setUser('rosa');
      const done = before.sendRequest(rosaNeedsHelp);
      await advance(TIMING.search);
      await done;
      const raw = JSON.parse(storage.data.get(KEY)!);
      delete raw.state.match.language;
      expect(parseSaved(JSON.stringify(raw), 'rosa')?.match?.language).toBe('en');
    });

    it('turns a meet point saved as translated text into ids, keeping the venue', async () => {
      const storage = memoryStorage();
      const before = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await before.setUser('rosa');
      const done = before.sendRequest(rosaNeedsHelp);
      await advance(TIMING.search);
      await done;
      const raw = JSON.parse(storage.data.get(KEY)!);

      // How the request was saved before meet points were ids (text in the language of the day).
      raw.state.request.location = { spot: 'Cerca de la rampa de la Puerta 2', venue: 'Crypto.com Arena' };
      expect(parseSaved(JSON.stringify(raw), 'rosa')?.request?.location).toEqual({ venueId: 'crypto-arena', facilityId: null });
      raw.state.request.location = { spot: 'Near Gate 2 Ramp', venue: 'Somewhere else' };
      expect(parseSaved(JSON.stringify(raw), 'rosa')?.request?.location).toEqual({ venueId: 'sofi', facilityId: null });
      // Ids that no longer exist fall back the same way; good ids come back as they were.
      raw.state.request.location = { venueId: 'sofi', facilityId: 'gate-2' };
      expect(parseSaved(JSON.stringify(raw), 'rosa')?.request?.location).toEqual({ venueId: 'sofi', facilityId: null });
      raw.state.request.location = { venueId: 'intuit-dome', facilityId: 'main-entrance' };
      expect(parseSaved(JSON.stringify(raw), 'rosa')?.request?.location).toEqual({ venueId: 'intuit-dome', facilityId: 'main-entrance' });
      delete raw.state.request.location;
      expect(parseSaved(JSON.stringify(raw), 'rosa')?.request?.location).toEqual({ venueId: 'sofi', facilityId: null });

      // The restored request still works: a reloaded store shows it and keeps matching.
      raw.state.request.location = { spot: 'Near Gate 2 Ramp', venue: 'SoFi Stadium' };
      storage.data.set(KEY, JSON.stringify(raw));
      const after = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await after.setUser('rosa');
      expect(after.getState()).toMatchObject({ status: 'matched', request: { location: { venueId: 'sofi', facilityId: null } } });
    });

    it('resumes a search that was in progress', async () => {
      const storage = memoryStorage();
      const before = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await before.setUser('rosa');
      void before.sendRequest(rosaNeedsHelp);
      await advance(0);

      const after = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await after.setUser('rosa');
      expect(after.getState().status).toBe('searching');
      await advance(TIMING.search);
      expect(after.getState().status).toBe('matched');
    });

    it('does not give one user the request saved for another, and sign-out deletes it', async () => {
      const storage = memoryStorage();
      const before = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await before.setUser('rosa');
      const done = before.sendRequest(rosaNeedsHelp);
      await advance(TIMING.search);
      await done;
      expect(storage.data.has(KEY)).toBe(true);

      const other = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await other.setUser('sam');
      expect(other.getState()).toEqual(INITIAL_STATE);

      await before.setUser(null);
      await advance(0);
      expect(storage.data.has(KEY)).toBe(false);
    });

    it('removes the key once the help is over', async () => {
      const storage = memoryStorage();
      const store = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await store.setUser('rosa');
      const done = store.sendRequest(rosaNeedsHelp);
      await advance(TIMING.search);
      await done;
      store.endHelp();
      store.skipFeedback();
      await advance(0);
      expect(storage.data.has(KEY)).toBe(false);
    });

    it('ignores saved data that is corrupt or from someone else', () => {
      expect(parseSaved(null, 'rosa')).toBeNull();
      expect(parseSaved('{not json', 'rosa')).toBeNull();
      expect(parseSaved(JSON.stringify({ v: 1, owner: 'sam', state: INITIAL_STATE }), 'rosa')).toBeNull();
      expect(parseSaved(JSON.stringify({ v: 1, owner: 'rosa', state: { ...INITIAL_STATE, status: 'matched' } }), 'rosa')).toBeNull();
      const draft = { helpTypes: ['quiet'], note: 'hi', photoUri: 'blob:http://x/1', language: null };
      expect(parseSaved(JSON.stringify({ v: 1, owner: 'rosa', state: { ...INITIAL_STATE, draft } }), 'rosa')?.draft).toEqual({ ...draft, photoUri: null });
    });
  });

  it('ignores actions that do not fit the current status', () => {
    expect(reduce(INITIAL_STATE, { type: 'end' })).toBe(INITIAL_STATE);
    expect(reduce(INITIAL_STATE, { type: 'cancel' })).toBe(INITIAL_STATE);
    expect(reduce(INITIAL_STATE, { type: 'send', message: { id: 'm', from: 'me', text: 'hi', sentAt: 0 } })).toBe(INITIAL_STATE);
  });
});

describe('no volunteer free in time', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  // German: no mock volunteer speaks it and chat translation doesn't cover it, so nobody matches.
  const nobodySpeaks: NewRequest = { ...rosaNeedsHelp, language: 'de' };
  const request: HelpRequest = { ...rosaNeedsHelp, id: 'req-1', createdAt: 0 };
  const draft = { helpTypes: ['physical' as const], note: 'By the ramp', photoUri: null, language: 'de' };
  const searching: RequestState = { ...INITIAL_STATE, status: 'searching', request, draft };

  it('moves searching → notFound → searching, and cancels back to the form with the draft', () => {
    const notFound = reduce(searching, { type: 'searchTimedOut', requestId: 'req-1' });
    expect(notFound).toEqual({ ...searching, status: 'notFound' });
    expect(reduce(searching, { type: 'searchTimedOut', requestId: 'req-other' })).toBe(searching);
    expect(reduce(INITIAL_STATE, { type: 'searchTimedOut', requestId: 'req-1' })).toBe(INITIAL_STATE);

    const again = { ...request, id: 'req-2' };
    expect(reduce(notFound, { type: 'keepSearching', request: again })).toEqual({ ...searching, request: again });
    expect(reduce(searching, { type: 'keepSearching', request: again })).toBe(searching);
    expect(reduce(notFound, { type: 'matched', requestId: 'req-1', match: {} as never })).toBe(notFound);

    expect(reduce(notFound, { type: 'cancel' })).toEqual({ ...INITIAL_STATE, draft });
  });

  it('the mock matches nobody only for a language no one speaks and the app can’t translate', () => {
    expect(mockVolunteerFor('de')).toBeNull();
    expect(mockVolunteerFor('ko')?.firstName).toBe('Min-ji');
    expect(mockVolunteerFor('ja')?.firstName).toBe('Daniel'); // through chat translation, as before
  });

  it('gives up after SEARCH_TIMEOUT_MS, keeping the request and draft, and withdraws it', async () => {
    const backend = createMockBackend(TIMING);
    const withdrawRequest = jest.spyOn(backend, 'withdrawRequest' as never) as unknown as jest.Mock;
    const cancelRequest = jest.spyOn(backend, 'cancelRequest');
    const store = createRequestStore(backend);
    store.setUser('rosa');
    store.editDraft(draft);
    let settled = false;
    void store.sendRequest(nobodySpeaks).then(() => { settled = true; });

    await advance(SEARCH_TIMEOUT_MS - 1);
    expect(store.getState().status).toBe('searching');
    expect(settled).toBe(false);

    await advance(1);
    const state = store.getState();
    expect(state.status).toBe('notFound');
    expect(state.request?.language).toBe('de');
    expect(state.draft).toEqual(draft);
    expect(settled).toBe(true);
    // Withdrawn only if still open, never cancelled outright (that would call off a volunteer who just accepted).
    expect(withdrawRequest).toHaveBeenCalledWith(state.request!.id);
    expect(cancelRequest).not.toHaveBeenCalled();
  });

  it('a match before the timeout stays matched', async () => {
    const store = setup();
    void store.sendRequest(rosaNeedsHelp);
    await advance(SEARCH_TIMEOUT_MS * 2);
    expect(store.getState().status).toBe('matched');
  });

  it('keep searching sends the request again under a new id and waits the full time again', async () => {
    const store = setup();
    void store.sendRequest(nobodySpeaks);
    await advance(SEARCH_TIMEOUT_MS);
    const id = store.getState().request?.id;
    expect(store.getState().status).toBe('notFound');

    void store.keepSearching();
    expect(store.getState().status).toBe('searching');
    expect(store.getState().request?.id).not.toBe(id);
    expect(store.getState().request).toMatchObject({ helpTypes: nobodySpeaks.helpTypes, language: nobodySpeaks.language });
    await advance(SEARCH_TIMEOUT_MS - 1);
    expect(store.getState().status).toBe('searching');
    await advance(1);
    expect(store.getState().status).toBe('notFound');
  });

  it('cancel from notFound goes back to the form with the draft', async () => {
    const store = setup();
    store.setUser('rosa');
    store.editDraft(draft);
    void store.sendRequest(nobodySpeaks);
    await advance(SEARCH_TIMEOUT_MS);
    store.cancel();
    expect(store.getState()).toEqual({ ...INITIAL_STATE, draft });
  });

  describe('the timer fires after a volunteer accepted (a locked phone)', () => {
    const sam: Match = {
      volunteer: { id: 'sam', name: 'Sam', firstName: 'Sam', possessive: 'their', languages: ['en'], rating: null, tags: [] },
      language: 'en', etaMinutes: null, distanceFeet: null,
    };

    /** A service whose poll hasn't seen the Accept yet; `withdraw` answers the timer's withdraw. */
    function lateBackend(withdraw: (id: string) => Promise<Match | null>) {
      let resolveFind: ((m: Match) => void) | null = null;
      let rejectFind: ((e: Error) => void) | null = null;
      const backend: VolunteerBackend = {
        ...createMockBackend(TIMING),
        findVolunteer: (_request, signal) => new Promise<Match>((resolve, reject) => {
          resolveFind = resolve;
          rejectFind = reject;
          signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
        }),
        withdrawRequest: jest.fn(withdraw),
        cancelRequest: jest.fn(async () => {}),
        onMessage: jest.fn(() => () => {}),
      };
      return { backend, find: { resolve: (m: Match) => resolveFind?.(m), reject: (e: Error) => rejectFind?.(e) } };
    }

    it('shows the match, not "No volunteer is free", and never cancels the request', async () => {
      const { backend } = lateBackend(async () => sam);
      const store = createRequestStore(backend);
      void store.sendRequest(rosaNeedsHelp);
      await advance(SEARCH_TIMEOUT_MS);
      expect(store.getState()).toMatchObject({ status: 'matched', match: { volunteer: { firstName: 'Sam' } } });
      expect(backend.cancelRequest).not.toHaveBeenCalled();
      expect(backend.onMessage).toHaveBeenCalledWith(store.getState().request!.id, expect.any(Function), undefined); // following the chat
    });

    it('keeps searching while the withdraw is on its way, and a match seen meanwhile wins', async () => {
      let answer: (m: Match | null) => void = () => {};
      const { backend, find } = lateBackend(() => new Promise(r => { answer = r; }));
      const store = createRequestStore(backend);
      void store.sendRequest(rosaNeedsHelp);
      await advance(SEARCH_TIMEOUT_MS);
      expect(store.getState().status).toBe('searching');
      find.resolve(sam);
      await advance(0);
      expect(store.getState().status).toBe('matched');
      answer(sam); // the withdraw's answer arrives after: nothing changes
      await advance(0);
      expect(store.getState().status).toBe('matched');
      expect(backend.onMessage).toHaveBeenCalledTimes(1);
    });

    it('the search seeing the row it withdrew says nobody was free, not "couldn’t reach a volunteer"', async () => {
      let answer: (m: Match | null) => void = () => {};
      const { backend, find } = lateBackend(() => new Promise(r => { answer = r; }));
      const store = createRequestStore(backend);
      void store.sendRequest(rosaNeedsHelp);
      await advance(SEARCH_TIMEOUT_MS);
      find.reject(new Error('Request cancelled'));
      await advance(0);
      answer(null);
      await advance(0);
      expect(store.getState()).toMatchObject({ status: 'notFound', notice: null });
    });

    it('offline, the withdraw failing still says nobody was free', async () => {
      const { backend } = lateBackend(async () => { throw new Error('offline'); });
      const store = createRequestStore(backend);
      void store.sendRequest(rosaNeedsHelp);
      await advance(SEARCH_TIMEOUT_MS);
      expect(store.getState().status).toBe('notFound');
    });

    it('cancelling while the withdraw is on its way goes back to the form and stays there', async () => {
      let answer: (m: Match | null) => void = () => {};
      const { backend } = lateBackend(() => new Promise(r => { answer = r; }));
      const store = createRequestStore(backend);
      void store.sendRequest(rosaNeedsHelp);
      await advance(SEARCH_TIMEOUT_MS);
      store.cancel();
      answer(sam);
      await advance(0);
      expect(store.getState().status).toBe('idle');
      expect(backend.cancelRequest).toHaveBeenCalledTimes(1);
    });

    it('after a restart, a search that ran out while closed lands on the match a volunteer made meanwhile', async () => {
      const { backend } = lateBackend(async () => sam);
      const storage = memoryStorage();
      const request: HelpRequest = { ...rosaNeedsHelp, id: 'req-1', createdAt: Date.now() - SEARCH_TIMEOUT_MS - 1000 };
      storage.data.set(KEY, JSON.stringify({ v: 1, owner: 'rosa', state: { ...INITIAL_STATE, status: 'searching', request }, since: request.createdAt }));
      const store = createRequestStore(backend, { storage, key: KEY });
      await store.setUser('rosa');
      await advance(0);
      expect(store.getState()).toMatchObject({ status: 'matched', match: { volunteer: { firstName: 'Sam' } } });
      expect(backend.withdrawRequest).toHaveBeenCalledWith('req-1');
      expect(backend.cancelRequest).not.toHaveBeenCalled();
    });

    /** A search saved before the app closed, whose wait has run out by the time it opens again. */
    function expiredSave() {
      const storage = memoryStorage();
      const request: HelpRequest = { ...rosaNeedsHelp, id: 'req-1', createdAt: Date.now() - SEARCH_TIMEOUT_MS - 1000 };
      storage.data.set(KEY, JSON.stringify({ v: 1, owner: 'rosa', state: { ...INITIAL_STATE, status: 'searching', request }, since: request.createdAt }));
      return storage;
    }

    it('after a restart on a slow network, shows "No volunteer is free" at once while the withdraw is on its way', async () => {
      let answer: (m: Match | null) => void = () => {};
      const { backend } = lateBackend(() => new Promise(r => { answer = r; }));
      const store = createRequestStore(backend, { storage: expiredSave(), key: KEY });
      await store.setUser('rosa');
      expect(store.isRestored()).toBe(true);
      expect(store.getState().status).toBe('notFound');

      answer(sam); // a volunteer had accepted it after all: that's the match
      await advance(0);
      expect(store.getState()).toMatchObject({ status: 'matched', match: { volunteer: { firstName: 'Sam' } } });
      expect(backend.onMessage).toHaveBeenCalledWith('req-1', expect.any(Function), undefined);
      expect(backend.cancelRequest).not.toHaveBeenCalled();
    });

    it('after a restart, a late match for a request the visitor already searched again for is called off', async () => {
      let answer: (m: Match | null) => void = () => {};
      const { backend } = lateBackend(() => new Promise(r => { answer = r; }));
      const store = createRequestStore(backend, { storage: expiredSave(), key: KEY });
      await store.setUser('rosa');
      void store.keepSearching();
      const again = store.getState().request!.id;
      expect(again).not.toBe('req-1');

      answer(sam);
      await advance(0);
      expect(store.getState()).toMatchObject({ status: 'searching', request: { id: again } });
      expect(backend.cancelRequest).toHaveBeenCalledWith('req-1');
    });
  });

  describe('after a restart', () => {
    function saved(state: RequestState, extra: object = {}) {
      return JSON.stringify({ v: 1, owner: 'rosa', state, ...extra });
    }

    async function restart(raw: string) {
      const storage = memoryStorage();
      storage.data.set(KEY, raw);
      const store = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await store.setUser('rosa');
      return store;
    }

    it('shows notFound again for a saved notFound request, without searching', async () => {
      const store = await restart(saved({ ...searching, status: 'notFound', request: { ...request, createdAt: Date.now() } }));
      expect(store.getState().status).toBe('notFound');
      expect(store.getState().draft).toEqual(draft);
      await advance(SEARCH_TIMEOUT_MS * 2);
      expect(store.getState().status).toBe('notFound');
    });

    it('shows notFound for an old-shape save (no since) whose wait already ran out', async () => {
      const store = await restart(saved({ ...searching, request: { ...request, createdAt: Date.now() - SEARCH_TIMEOUT_MS - 1000 } }));
      expect(store.getState().status).toBe('notFound');
    });

    it('resumes an old-shape save that still has time, and matches as before', async () => {
      const store = await restart(saved({ ...searching, request: { ...request, language: 'en', createdAt: Date.now() } }));
      expect(store.getState().status).toBe('searching');
      await advance(TIMING.search);
      expect(store.getState().status).toBe('matched');
    });

    it('saves when the wait began and gives up on time after a restart', async () => {
      const storage = memoryStorage();
      const before = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await before.setUser('rosa');
      const started = Date.now();
      void before.sendRequest(nobodySpeaks);
      await advance(0);
      expect(JSON.parse(storage.data.get(KEY)!).since).toBe(started);

      await advance(SEARCH_TIMEOUT_MS / 2);
      const after = createRequestStore(createMockBackend(TIMING), { storage, key: KEY });
      await after.setUser('rosa');
      expect(after.getState().status).toBe('searching');
      await advance(SEARCH_TIMEOUT_MS / 2);
      expect(after.getState().status).toBe('notFound');
    });

    it('parses a saved notFound request', () => {
      expect(parseSaved(saved({ ...searching, status: 'notFound' }), 'rosa')?.status).toBe('notFound');
      expect(parseSaved(saved({ ...searching, status: 'notFound', request: null }), 'rosa')).toBeNull();
    });
  });
});

describe('the mock volunteer in another language', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(async () => {
    jest.useRealTimers();
    await i18n.changeLanguage('en');
  });

  // The chat translates for the reader; the volunteer writes as they would, in their main language.
  it('greets and replies in the volunteer’s own language, tagged with it', async () => {
    await i18n.changeLanguage('es');
    const store = setup();
    void store.sendRequest({ ...rosaNeedsHelp, language: 'es', location: AT_ENTRY_4 });
    await advance(TIMING.search + TIMING.greeting);
    expect(store.getState().match?.volunteer.firstName).toBe('Daniel');
    expect(store.getState().messages[0]).toMatchObject({
      text: "Hi Rosa! I'm Daniel, your LA28 volunteer. I'm heading to you now. Meeting point: Entry 4.",
      lang: 'en',
    });
    store.sendMessage('Gracias');
    await advance(TIMING.reply);
    expect(store.getState().messages.at(-1)).toMatchObject({ text: "Got it, thanks! I'll be there in a couple of minutes.", lang: 'en' });
  });

  it('tags your messages with your chat language once it is known', async () => {
    const store = setup();
    void store.sendRequest({ ...rosaNeedsHelp, language: 'es' });
    await advance(TIMING.search);
    store.sendMessage('Hola');
    expect(store.getState().messages.at(-1)).not.toHaveProperty('lang');
    store.setLanguage('es');
    store.sendMessage('Estoy aquí');
    expect(store.getState().messages.at(-1)).toMatchObject({ from: 'me', text: 'Estoy aquí', lang: 'es' });
  });

  it('has a Korean-speaking volunteer write in Korean', async () => {
    await i18n.changeLanguage('ko');
    const store = setup();
    void store.sendRequest({ ...rosaNeedsHelp, language: 'ko', location: AT_ENTRY_4 });
    await advance(TIMING.search + TIMING.greeting);
    expect(store.getState().match?.volunteer.firstName).toBe('Min-ji');
    store.sendMessage('감사합니다');
    await advance(TIMING.reply);
    expect(store.getState().messages.at(-1)).toMatchObject({ text: '알겠어요, 감사합니다! 몇 분 안에 도착해요.', lang: 'ko' });
  });
});

describe('formatClock', () => {
  afterEach(async () => { await i18n.changeLanguage('en'); });

  it('prints Figma-style times in English', () => {
    expect(formatClock(new Date(2026, 6, 14, 14, 0).getTime())).toBe('2:00pm');
    expect(formatClock(new Date(2026, 6, 14, 0, 5).getTime())).toBe('12:05am');
    expect(formatClock(new Date(2026, 6, 14, 12, 30).getTime())).toBe('12:30pm');
  });

  it("uses the language's own clock elsewhere", async () => {
    await i18n.changeLanguage('es');
    expect(formatClock(new Date(2026, 6, 14, 14, 0).getTime())).toBe('14:00');
    expect(formatClock(new Date(2026, 6, 14, 14, 0).getTime(), 'ko')).toBe('오후 2:00');
  });
});

describe('formatDistance', () => {
  afterEach(async () => { await i18n.changeLanguage('en'); });

  it('rounds feet and switches to miles at 1000 ft', async () => {
    expect(formatDistance(183)).toBe('180 ft');
    expect(formatDistance(1584)).toBe('0.3 mi');
    await i18n.changeLanguage('es');
    expect(formatDistance(183)).toBe('180 pies');
    expect(formatDistance(1584)).toBe('0,3 mi');
  });
});

describe('chat day/time separators', () => {
  const at = (h: number, m: number, day = 14) => new Date(2026, 6, day, h, m).getTime();

  it('only separates messages more than 10 minutes apart', () => {
    expect(needsSeparator(at(14, 0), at(14, 10))).toBe(false);
    expect(needsSeparator(at(14, 0), at(14, 11))).toBe(true);
    expect(needsSeparator(at(23, 58, 13), at(0, 2))).toBe(false); // across midnight but close together
  });

  it('names the day relative to now', () => {
    const now = at(18, 0);
    expect(formatDayTime(at(14, 5), now)).toBe('Today 2:05pm');
    expect(formatDayTime(at(9, 30, 13), now)).toBe('Yesterday 9:30am');
    expect(formatDayTime(at(14, 0, 10), now)).toBe('Fri, Jul 10 2:00pm');
  });

  it('names the day in the UI language', async () => {
    const now = at(18, 0);
    await i18n.changeLanguage('es');
    expect(formatDayTime(at(14, 5), now)).toBe('Hoy 14:05');
    expect(formatDayTime(at(9, 30, 13), now)).toBe('Ayer 9:30');
    await i18n.changeLanguage('en');
  });
});
