// The visitor's current help request: idle → searching → matched → done → idle (searching can
// time out to notFound, then search again).
// One store shared by the Volunteer tab and the chat screen (they're in different navigators, so a
// context provider would have to wrap the root layout). The backend and storage are injected, so
// tests and the app use the same store. The request is saved under one storage key, so a reload or
// an app restart lands back on it; it belongs to one signed-in user (see setUser).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { chatLanguage } from '@/features/translate/languages';
import { onBeforeSignOut } from '@/lib/before-sign-out';

import { appBackend } from './app-backend';
import { newId, type VolunteerBackend } from './backend';
import { restoreMeetPoint } from './meet-point';
import type { ChatMessage, FeedbackTag, HelpRequest, Match, ProblemKind, RequestDraft, RequestState } from './types';

export const INITIAL_STATE: RequestState = {
  status: 'idle',
  request: null,
  match: null,
  messages: [],
  unread: 0,
  notice: null,
  draft: null,
  typing: false,
};

export const EMPTY_DRAFT: RequestDraft = { helpTypes: [], note: '', photoUri: null, language: null };

/** How long to wait for a volunteer before showing "No volunteer is free right now", e.g. 2 min. */
export const SEARCH_TIMEOUT_MS = 2 * 60 * 1000;

export type RequestAction =
  | { type: 'search'; request: HelpRequest }
  | { type: 'matched'; requestId: string; match: Match }
  | { type: 'searchFailed'; requestId: string }
  | { type: 'searchTimedOut'; requestId: string }
  | { type: 'keepSearching'; request: HelpRequest }
  | { type: 'cancel' }
  | { type: 'released'; requestId: string }
  | { type: 'send'; message: ChatMessage }
  | { type: 'sendFailed'; messageId: string; failed: boolean }
  | { type: 'receive'; requestId: string; message: ChatMessage }
  | { type: 'typing'; requestId: string; typing: boolean }
  | { type: 'read' }
  | { type: 'end'; notice?: RequestState['notice'] }
  | { type: 'finish'; notice: RequestState['notice'] }
  | { type: 'dismissNotice' }
  | { type: 'editDraft'; patch: Partial<RequestDraft> }
  | { type: 'reset' }
  | { type: 'restore'; state: RequestState };

/** Pure state transitions. Actions that don't fit the current status return the same state. */
export function reduce(state: RequestState, action: RequestAction): RequestState {
  switch (action.type) {
    case 'search':
      return state.status === 'idle' ? { ...INITIAL_STATE, status: 'searching', request: action.request, draft: state.draft } : state;
    case 'matched':
      return state.status === 'searching' && state.request?.id === action.requestId
        ? { ...state, status: 'matched', match: action.match, notice: null }
        : state;
    case 'released':
      // The volunteer left (e.g. signed out) and the request is open again: search on, with a note,
      // and start the next chat empty (the next volunteer can't read this one either).
      return state.status === 'matched' && state.request?.id === action.requestId
        ? { ...state, status: 'searching', match: null, messages: [], unread: 0, typing: false, notice: { tone: 'error', key: 'volunteerLeft' } }
        : state;
    case 'searchFailed':
      return state.status === 'searching' && state.request?.id === action.requestId
        ? { ...INITIAL_STATE, draft: state.draft, notice: { tone: 'error', key: 'searchFailed' } }
        : state;
    case 'searchTimedOut':
      // Nobody free in time (the request was withdrawn): keep it (and the draft) so "Search again"
      // sends it again under a new id.
      return state.status === 'searching' && state.request?.id === action.requestId ? { ...state, status: 'notFound' } : state;
    case 'keepSearching':
      return state.status === 'notFound' ? { ...state, status: 'searching', request: action.request } : state;
    case 'cancel':
      return state.status === 'searching' || state.status === 'notFound' || state.status === 'matched'
        ? { ...INITIAL_STATE, draft: state.draft }
        : state;
    case 'send':
      return state.status === 'matched' ? { ...state, messages: [...state.messages, action.message] } : state;
    case 'sendFailed':
      return state.messages.some(m => m.id === action.messageId && !!m.failed !== action.failed)
        ? { ...state, messages: state.messages.map(m => (m.id === action.messageId ? { ...m, failed: action.failed } : m)) }
        : state;
    case 'receive':
      // A live service resends the chat so far on (re)subscribing: skip messages already here.
      return state.status === 'matched' && state.request?.id === action.requestId && !state.messages.some(m => m.id === action.message.id)
        ? { ...state, messages: [...state.messages, action.message], unread: state.unread + 1, typing: false }
        : state;
    case 'typing':
      return state.status === 'matched' && state.request?.id === action.requestId && state.typing !== action.typing
        ? { ...state, typing: action.typing }
        : state;
    case 'read':
      return state.unread ? { ...state, unread: 0 } : state;
    case 'end':
      // The help happened: the next request starts from an empty form. `notice`: why, when the
      // volunteer ended it ("Daniel ended the chat"), shown above the rating.
      return state.status === 'matched'
        ? { ...state, status: 'done', unread: 0, draft: null, typing: false, notice: action.notice ?? null }
        : state;
    case 'finish':
      return state.status === 'done' ? { ...INITIAL_STATE, notice: action.notice } : state;
    case 'dismissNotice':
      return state.notice ? { ...state, notice: null } : state;
    case 'editDraft':
      return { ...state, draft: { ...(state.draft ?? EMPTY_DRAFT), ...action.patch } };
    case 'reset':
      return state === INITIAL_STATE ? state : INITIAL_STATE;
    case 'restore':
      return action.state;
  }
}

export type NewRequest = Omit<HelpRequest, 'id' | 'createdAt'>;

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface Persistence {
  storage: KeyValueStorage;
  key: string;
}

interface Saved {
  v: 1;
  owner: string;
  state: RequestState;
  /** While searching: when the wait began (ms). Older saves lack it and use request.createdAt. */
  since?: number;
}

const STATUSES: RequestState['status'][] = ['idle', 'searching', 'notFound', 'matched', 'done'];

/** When a saved search's wait began, e.g. 1763200000000; null if the save doesn't say. */
function savedSince(raw: string | null): number | null {
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
    const since = saved?.since ?? saved?.state?.request?.createdAt;
    return typeof since === 'number' ? since : null;
  } catch {
    return null;
  }
}

/** A web photo is a blob: URL that dies with the page; drop it rather than show a broken image. */
function livePhoto(uri: string | null | undefined): string | null {
  return uri && !uri.startsWith('blob:') ? uri : null;
}

/** The saved request, if it's well formed and belongs to `userId`. */
export function parseSaved(raw: string | null, userId: string): RequestState | null {
  let saved: Partial<Saved> | null;
  try {
    saved = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
  } catch {
    return null;
  }
  const s = saved?.state;
  if (saved?.v !== 1 || saved.owner !== userId || !s || !STATUSES.includes(s.status) || !Array.isArray(s.messages)) return null;
  if (s.status !== 'idle' && !s.request) return null;
  if ((s.status === 'matched' || s.status === 'done') && !s.match) return null;
  return {
    ...INITIAL_STATE,
    status: s.status,
    // location: ids now; a request saved with the old translated-text shape keeps its venue.
    request: s.request ? { ...s.request, photoUri: livePhoto(s.request.photoUri), location: restoreMeetPoint(s.request.location) } : null,
    // Saved before Match had `language`: work it out the same way the matcher does.
    match: s.match ? { ...s.match, language: s.match.language ?? chatLanguage(s.match.volunteer?.languages ?? []) } : null,
    // Saved before ChatMessage.from said 'them' for the other person.
    messages: s.messages.map(m => ((m.from as string) === 'volunteer' ? { ...m, from: 'them' } : m)),
    unread: typeof s.unread === 'number' ? s.unread : 0,
    draft: s.draft ? { ...EMPTY_DRAFT, ...s.draft, photoUri: livePhoto(s.draft.photoUri) } : null,
  };
}

export function createRequestStore(backend: VolunteerBackend, persist?: Persistence) {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  let search: AbortController | null = null;
  let unsubscribe: (() => void) | null = null;
  /** The signed-in user the request belongs to. */
  let owner: string | null = null;
  /** False until the saved request (if any) has been read back, so screens don't flash the empty form. */
  let restored = !persist;
  /** Bumped by every reset, so a restore that finishes after one is dropped. */
  let generation = 0;
  /** The language the signed-in visitor writes in, tagged on sent messages (see setLanguage). */
  let senderLanguage: string | null = null;
  /** Storage writes, chained so they land in order. */
  let writes: Promise<unknown> = Promise.resolve();
  /** When the current wait for a volunteer began; SEARCH_TIMEOUT_MS counts from it, across restarts too. */
  let searchSince = 0;

  function emit() {
    listeners.forEach(l => l());
  }

  const requestId = () => backend.newRequestId?.() ?? newId('req');

  function queueWrite(write: (storage: KeyValueStorage, key: string) => Promise<void>) {
    if (!persist) return;
    writes = writes.then(() => write(persist.storage, persist.key)).catch(() => {});
  }

  function save() {
    const who = owner;
    if (!who) return;
    const snapshot = state;
    // Nothing worth keeping (e.g. the help ended): no key at all.
    if (snapshot.status === 'idle' && !snapshot.draft) return queueWrite((s, k) => s.removeItem(k));
    const since = snapshot.status === 'searching' ? { since: searchSince } : {};
    const saved: Saved = { v: 1, owner: who, state: { ...snapshot, notice: null, typing: false }, ...since };
    queueWrite((s, k) => s.setItem(k, JSON.stringify(saved)));
  }

  function dispatch(action: RequestAction) {
    const next = reduce(state, action);
    if (next === state) return;
    state = next;
    save();
    emit();
  }

  function stopListening() {
    unsubscribe?.();
    unsubscribe = null;
  }

  /** Follows the matched request's chat and status, until it ends or the volunteer leaves. */
  function listen(requestId: string) {
    stopListening();
    // Only the volunteer's messages newer than the newest one already here (e.g. after a restart).
    const theirs = state.messages.filter(m => m.from === 'them').map(m => m.sentAt);
    const since = theirs.length ? Math.max(...theirs) : undefined;
    const offMessage = backend.onMessage(requestId, message => dispatch({ type: 'receive', requestId, message }), since);
    const offTyping = backend.onTyping?.(requestId, typing => dispatch({ type: 'typing', requestId, typing }));
    // The volunteer ended the chat: say so, then ask for feedback, as after "Mark help as done".
    // Closed on our side (or called off by the service): back to the form, keeping the draft.
    const offClosed = backend.onClosed?.(requestId, closed => {
      if (closed.byMe || state.request?.id !== requestId) return;
      stopListening();
      const name = state.match?.volunteer.firstName;
      const ended = closed.bySystem ? undefined : { tone: 'success' as const, key: 'volunteerEnded' as const, params: { name } };
      dispatch(closed.status === 'done' ? { type: 'end', notice: ended } : { type: 'cancel' });
    });
    // The volunteer left without finishing (signed out): the request is open again, so wait for the next one.
    const volunteerId = state.match?.volunteer.id;
    const offReleased = volunteerId
      ? backend.onReleased?.(requestId, volunteerId, () => {
          const request = state.request;
          if (state.status !== 'matched' || request?.id !== requestId) return;
          stopListening();
          searchSince = Date.now();
          dispatch({ type: 'released', requestId });
          void runSearch(request);
        })
      : undefined;
    unsubscribe = () => {
      offMessage();
      offTyping?.();
      offClosed?.();
      offReleased?.();
    };
  }

  /** Sends one of the visitor's messages; if the service refuses it, it's marked "Not sent". */
  function deliver(requestId: string, message: ChatMessage) {
    backend.sendMessage(requestId, message.text, message.lang ?? null).catch(() => {
      if (state.request?.id === requestId) dispatch({ type: 'sendFailed', messageId: message.id, failed: true });
    });
  }

  /**
   * Withdraws a request nobody took in time, unless a volunteer just did: resolves with their match,
   * else null (withdrawn, or the service couldn't be reached: then it's treated as withdrawn).
   */
  async function withdraw(requestId: string): Promise<Match | null> {
    try {
      if (backend.withdrawRequest) return await backend.withdrawRequest(requestId);
      await backend.cancelRequest(requestId);
    } catch {
      // Offline: say nobody was free; the server stops listing it after 5 minutes.
    }
    return null;
  }

  /** Shows the match and follows its chat. */
  function matched(requestId: string, match: Match) {
    dispatch({ type: 'matched', requestId, match });
    listen(requestId); // after "matched", so the typing state it reports right away applies
  }

  /**
   * The wait ran out: withdraw the request so no volunteer turns up after we said nobody was free.
   * The timer can fire late (a locked phone, a background tab), after a volunteer accepted: the
   * withdraw then leaves the request alone and the visitor gets the match instead.
   */
  async function giveUp(request: HelpRequest, ctl: AbortController): Promise<void> {
    const match = await withdraw(request.id);
    if (search !== ctl) return; // matched meanwhile (findVolunteer saw it first), or cancelled
    search = null;
    ctl.abort();
    if (match) matched(request.id, match);
    else dispatch({ type: 'searchTimedOut', requestId: request.id });
  }

  /** Waits for a volunteer for a request that is already in the 'searching' state, until the wait runs out. */
  async function runSearch(request: HelpRequest): Promise<void> {
    const ctl = new AbortController();
    search = ctl;
    let givingUp = null as Promise<void> | null;
    const timer = setTimeout(() => {
      if (search === ctl) givingUp = giveUp(request, ctl);
    }, Math.min(SEARCH_TIMEOUT_MS, Math.max(0, searchSince + SEARCH_TIMEOUT_MS - Date.now()))); // a clock change never stretches it
    try {
      const match = await backend.findVolunteer(request, ctl.signal);
      if (search !== ctl) return;
      search = null;
      matched(request.id, match);
    } catch {
      // Timing out: the withdraw decides (findVolunteer may see the row it cancels first).
      if (givingUp) return await givingUp;
      if (search !== ctl) return; // cancelled: the state already moved on
      search = null;
      dispatch({ type: 'searchFailed', requestId: request.id });
    } finally {
      clearTimeout(timer);
    }
  }

  function markRestored() {
    if (restored) return;
    restored = true;
    emit();
  }

  /** Follows a match the service already made (after a restart). */
  function resumeMatch(requestId: string, match: Match) {
    backend.resume?.(requestId, match);
    listen(requestId);
  }

  /**
   * Withdraws a restored request whose wait ran out while the app was closed. A volunteer who
   * accepted it meanwhile wins: "No volunteer is free" turns into their match. If the visitor has
   * moved on by then (searched again, cancelled, signed out), that late match is called off instead.
   */
  async function withdrawExpired(requestId: string, mine: number) {
    const match = await withdraw(requestId);
    if (!match) return;
    if (mine === generation && state.status === 'notFound' && state.request?.id === requestId) {
      dispatch({ type: 'restore', state: { ...state, status: 'matched', match, notice: null } });
      resumeMatch(requestId, match);
    } else {
      backend.cancelRequest(requestId).catch(() => {});
    }
  }

  /** Puts back the request saved for `userId`, unless something newer already happened. */
  async function restore(userId: string) {
    if (!persist) return;
    const mine = generation;
    try {
      await writes;
      const raw = await persist.storage.getItem(persist.key);
      const saved = parseSaved(raw, userId);
      const untouched = state.status === 'idle' && !state.draft;
      if (!saved || mine !== generation || owner !== userId || !untouched) return;
      if (saved.status === 'searching') searchSince = savedSince(raw) ?? Date.now();
      // The wait ran out while the app was closed: say nobody was free rather than silently start
      // over, and withdraw it in the background, so the tab shows right away even on a slow network.
      const expired = saved.status === 'searching' && Date.now() - searchSince >= SEARCH_TIMEOUT_MS;
      const next: RequestState = expired ? { ...saved, status: 'notFound' } : saved;
      dispatch({ type: 'restore', state: next });
      // Pick up where it left off: keep waiting for a volunteer, or keep listening to the chat.
      if (expired && next.request) void withdrawExpired(next.request.id, mine);
      else if (next.status === 'searching' && next.request) void runSearch(next.request);
      else if (next.status === 'matched' && next.request && next.match) resumeMatch(next.request.id, next.match);
    } catch {
      // Unreadable storage: start from the empty form.
    } finally {
      markRestored();
    }
  }

  /**
   * Drops everything (calling off a live request) and goes back to the empty form. The request,
   * note, location and chat belong to whoever asked; the next person on this device mustn't see them.
   */
  function reset() {
    const live = state.status === 'searching' || state.status === 'matched' ? state.request?.id : undefined;
    search?.abort();
    search = null;
    stopListening();
    generation += 1;
    dispatch({ type: 'reset' });
    queueWrite((s, k) => s.removeItem(k));
    if (live) backend.cancelRequest(live).catch(() => {});
  }

  return {
    getState: () => state,
    /** True once any saved request has been read back (or there was nothing to read). */
    isRestored: () => restored,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    /** Starts searching; resolves once matched, failed, timed out or cancelled. */
    async sendRequest(input: NewRequest): Promise<void> {
      if (state.status !== 'idle') return;
      const request: HelpRequest = { ...input, id: requestId(), createdAt: Date.now() };
      searchSince = request.createdAt;
      dispatch({ type: 'search', request });
      await runSearch(request);
    },

    /**
     * Nobody was free: send the request again, under a new id (the timed-out one was withdrawn),
     * and wait another SEARCH_TIMEOUT_MS.
     */
    async keepSearching(): Promise<void> {
      if (state.status !== 'notFound' || !state.request) return;
      const request: HelpRequest = { ...state.request, id: requestId(), createdAt: Date.now() };
      searchSince = Date.now();
      dispatch({ type: 'keepSearching', request });
      await runSearch(request);
    },

    /** Stops searching (or gives up after nobody was free) or calls off the matched volunteer, back to the request form. */
    cancel() {
      const id = state.request?.id;
      search?.abort();
      search = null;
      stopListening();
      dispatch({ type: 'cancel' });
      if (id) backend.cancelRequest(id).catch(() => {});
    },

    sendMessage(text: string) {
      const body = text.trim();
      const id = state.request?.id;
      if (!body || !id || state.status !== 'matched') return;
      const lang = senderLanguage ? { lang: senderLanguage } : {};
      const message: ChatMessage = { id: newId('msg'), from: 'me', text: body, sentAt: Date.now(), ...lang };
      dispatch({ type: 'send', message });
      deliver(id, message);
    },

    /** "Tap to retry" on a message that wasn't sent: sends it again. */
    retryMessage(messageId: string) {
      const id = state.request?.id;
      const message = state.messages.find(m => m.id === messageId && m.failed);
      if (!id || state.status !== 'matched' || !message) return;
      dispatch({ type: 'sendFailed', messageId, failed: false });
      deliver(id, message);
    },

    markRead() {
      dispatch({ type: 'read' });
    },

    /** The help is over: ask for feedback. */
    endHelp() {
      const id = state.request?.id;
      if (state.status !== 'matched' || !id) return;
      stopListening();
      dispatch({ type: 'end' });
      backend.endHelp(id).catch(() => {});
    },

    async submitFeedback(stars: number, tags: FeedbackTag[], note: string) {
      const { request, match } = state;
      if (state.status !== 'done' || !request || !match) return;
      await backend.submitFeedback({ requestId: request.id, volunteerId: match.volunteer.id, stars, tags, note: note.trim() });
      dispatch({ type: 'finish', notice: { tone: 'success', key: 'thanks', params: { name: match.volunteer.firstName } } });
    },

    async reportProblem(kind: ProblemKind, note: string) {
      const { request, match } = state;
      if (!request || !match) return;
      await backend.reportProblem({ requestId: request.id, volunteerId: match.volunteer.id, kind, note: note.trim() });
    },

    /** Leave feedback for later and go back to the request form. */
    skipFeedback() {
      dispatch({ type: 'finish', notice: null });
    },

    dismissNotice() {
      dispatch({ type: 'dismissNotice' });
    },

    /**
     * The request form's fields live here, so they come back after a failed search or a cancel.
     * Ignored while nobody is signed in: a form unmounting after sign-out (e.g. dictation saving
     * its last words) mustn't leave its note for the next person.
     */
    editDraft(patch: Partial<RequestDraft>) {
      if (owner === null) return;
      dispatch({ type: 'editDraft', patch });
    },

    reset,

    /** The visitor's chat language (e.g. 'es'), so their messages carry it for the volunteer's translation. */
    setLanguage(lang: string | null) {
      senderLanguage = lang;
    },

    /**
     * Called as the session changes. Signing out (null) or another user signing in resets and
     * clears the saved request; a user signing in gets back the request saved for them.
     * Resolves once any saved request has been read back.
     */
    /**
     * Cancels a searching or matched request on the server while the user is still signed in
     * (runs just before sign-out; after it, the server would refuse). The local reset follows on sign-out.
     */
    async endSession(): Promise<void> {
      const live = state.status === 'searching' || state.status === 'matched' ? state.request?.id : undefined;
      if (live) await backend.cancelRequest(live);
    },

    async setUser(userId: string | null): Promise<void> {
      if (userId === null) {
        reset();
        owner = null;
        markRestored();
        return;
      }
      if (userId === owner) return;
      if (owner !== null) reset();
      owner = userId;
      await restore(userId);
    },
  };
}

export type RequestStore = ReturnType<typeof createRequestStore>;

/** The app's store: on Supabase when the app has a project, else the on-device mock (app-backend.ts). */
export const volunteerRequests: RequestStore = createRequestStore(appBackend, {
  storage: AsyncStorage,
  key: 'venu.volunteer.request',
});

onBeforeSignOut(() => volunteerRequests.endSession());

export function useVolunteerRequest(store: RequestStore = volunteerRequests): RequestState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** False while a saved request may still be on its way back (just after start or sign-in). */
export function useVolunteerRestored(store: RequestStore = volunteerRequests): boolean {
  return useSyncExternalStore(store.subscribe, store.isRestored, store.isRestored);
}
