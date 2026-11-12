import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import i18n from '@/i18n';

import { createMockBackend } from '../backend';
import { mockLocation } from '../mock';
import { createRequestStore, INITIAL_STATE, parseSaved, reduce, type KeyValueStorage, type NewRequest } from '../request-store';
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

const TIMING = { search: 1000, greeting: 500, reply: 800 };

const rosaNeedsHelp: NewRequest = {
  visitorName: 'Rosa',
  helpTypes: ['physical'],
  note: 'Stuck near ramp 2',
  photoUri: null,
  language: 'en',
  location: mockLocation(),
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
    expect(store.getState().messages.map(m => m.from)).toEqual(['volunteer']);
    expect(store.getState().messages[0]!.text).toBe(
      "Hi Rosa! I'm Daniel, your LA28 volunteer. I'm heading to you now. Meeting point: Near Gate 2 Ramp.",
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
    expect(messages.map(m => m.from)).toEqual(['volunteer', 'me', 'volunteer']);
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
    expect(store.getState().messages.at(-1)?.from).toBe('volunteer');

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
    expect(store.getState().notice).toMatchObject({ tone: 'success' });
    expect(store.getState().notice?.text).toContain('Daniel');

    store.dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  it('a failed search returns to the form with an error', async () => {
    const backend = createMockBackend(TIMING);
    backend.findVolunteer = () => Promise.reject(new Error('offline'));
    const store = createRequestStore(backend);
    await store.sendRequest(rosaNeedsHelp);
    expect(store.getState().status).toBe('idle');
    expect(store.getState().notice?.tone).toBe('error');
  });

  it('keeps the form draft through a failed search and a cancel, and clears it once help ends', async () => {
    const backend = createMockBackend(TIMING);
    const find = backend.findVolunteer;
    backend.findVolunteer = () => Promise.reject(new Error('offline'));
    const store = createRequestStore(backend);
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
      expect(after.getState().messages.map(m => m.from)).toEqual(['volunteer', 'me', 'me', 'volunteer']);
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

describe('the mock volunteer in another language', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(async () => {
    jest.useRealTimers();
    await i18n.changeLanguage('en');
  });

  it('greets and replies in the UI language', async () => {
    await i18n.changeLanguage('es');
    const store = setup();
    void store.sendRequest({ ...rosaNeedsHelp, location: mockLocation() });
    await advance(TIMING.search + TIMING.greeting);
    expect(store.getState().messages[0]!.text).toBe(
      '¡Hola, Rosa! Soy Daniel, del equipo de voluntarios de LA28. Voy hacia ti ahora. Punto de encuentro: Cerca de la rampa de la Puerta 2.',
    );
    store.sendMessage('Gracias');
    await advance(TIMING.reply);
    expect(store.getState().messages.at(-1)!.text).toBe('¡Entendido, gracias! Llego en un par de minutos.');
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
