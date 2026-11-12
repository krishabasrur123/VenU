// The visitor's current help request: idle → searching → matched → done → idle.
// One store shared by the Volunteer tab and the chat screen (they're in different navigators, so a
// context provider would have to wrap the root layout). The backend and storage are injected, so
// tests and the app use the same store. The request is saved under one storage key, so a reload or
// an app restart lands back on it; it belongs to one signed-in user (see setUser).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import i18n from '@/i18n';

import { createMockBackend, newId, type VolunteerBackend } from './backend';
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

export type RequestAction =
  | { type: 'search'; request: HelpRequest }
  | { type: 'matched'; requestId: string; match: Match }
  | { type: 'searchFailed'; requestId: string; text: string }
  | { type: 'cancel' }
  | { type: 'send'; message: ChatMessage }
  | { type: 'receive'; requestId: string; message: ChatMessage }
  | { type: 'typing'; requestId: string; typing: boolean }
  | { type: 'read' }
  | { type: 'end' }
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
        ? { ...state, status: 'matched', match: action.match }
        : state;
    case 'searchFailed':
      return state.status === 'searching' && state.request?.id === action.requestId
        ? { ...INITIAL_STATE, draft: state.draft, notice: { tone: 'error', text: action.text } }
        : state;
    case 'cancel':
      return state.status === 'searching' || state.status === 'matched' ? { ...INITIAL_STATE, draft: state.draft } : state;
    case 'send':
      return state.status === 'matched' ? { ...state, messages: [...state.messages, action.message] } : state;
    case 'receive':
      return state.status === 'matched' && state.request?.id === action.requestId
        ? { ...state, messages: [...state.messages, action.message], unread: state.unread + 1, typing: false }
        : state;
    case 'typing':
      return state.status === 'matched' && state.request?.id === action.requestId && state.typing !== action.typing
        ? { ...state, typing: action.typing }
        : state;
    case 'read':
      return state.unread ? { ...state, unread: 0 } : state;
    case 'end':
      // The help happened: the next request starts from an empty form.
      return state.status === 'matched' ? { ...state, status: 'done', unread: 0, draft: null, typing: false } : state;
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
}

const STATUSES: RequestState['status'][] = ['idle', 'searching', 'matched', 'done'];

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
    request: s.request ? { ...s.request, photoUri: livePhoto(s.request.photoUri) } : null,
    match: s.match ?? null,
    messages: s.messages,
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
  /** Storage writes, chained so they land in order. */
  let writes: Promise<unknown> = Promise.resolve();

  function emit() {
    listeners.forEach(l => l());
  }

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
    const saved: Saved = { v: 1, owner: who, state: { ...snapshot, notice: null, typing: false } };
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

  function listen(requestId: string) {
    stopListening();
    const offMessage = backend.onMessage(requestId, message => dispatch({ type: 'receive', requestId, message }));
    const offTyping = backend.onTyping?.(requestId, typing => dispatch({ type: 'typing', requestId, typing }));
    unsubscribe = () => {
      offMessage();
      offTyping?.();
    };
  }

  /** Waits for a volunteer for a request that is already in the 'searching' state. */
  async function runSearch(request: HelpRequest): Promise<void> {
    const ctl = new AbortController();
    search = ctl;
    try {
      const match = await backend.findVolunteer(request, ctl.signal);
      if (search !== ctl) return;
      search = null;
      dispatch({ type: 'matched', requestId: request.id, match });
      listen(request.id); // after "matched", so the typing state it reports right away applies
    } catch {
      if (search !== ctl) return; // cancelled: cancel() already reset the state
      search = null;
      dispatch({ type: 'searchFailed', requestId: request.id, text: i18n.t('volunteer:notice.searchFailed') });
    }
  }

  function markRestored() {
    if (restored) return;
    restored = true;
    emit();
  }

  /** Puts back the request saved for `userId`, unless something newer already happened. */
  async function restore(userId: string) {
    if (!persist) return;
    const mine = generation;
    try {
      await writes;
      const saved = parseSaved(await persist.storage.getItem(persist.key), userId);
      const untouched = state.status === 'idle' && !state.draft;
      if (!saved || mine !== generation || owner !== userId || !untouched) return;
      dispatch({ type: 'restore', state: saved });
      // Pick up where it left off: keep waiting for a volunteer, or keep listening to the chat.
      if (saved.status === 'searching' && saved.request) void runSearch(saved.request);
      else if (saved.status === 'matched' && saved.request) listen(saved.request.id);
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

    /** Starts searching; resolves once matched, failed or cancelled. */
    async sendRequest(input: NewRequest): Promise<void> {
      if (state.status !== 'idle') return;
      const request: HelpRequest = { ...input, id: newId('req'), createdAt: Date.now() };
      dispatch({ type: 'search', request });
      await runSearch(request);
    },

    /** Stops searching or calls off the matched volunteer, back to the request form. */
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
      dispatch({ type: 'send', message: { id: newId('msg'), from: 'me', text: body, sentAt: Date.now() } });
      backend.sendMessage(id, body).catch(() => {});
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
      dispatch({ type: 'finish', notice: { tone: 'success', text: i18n.t('volunteer:notice.thanks', { name: match.volunteer.firstName }) } });
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

    /** The request form's fields live here, so they come back after a failed search or a cancel. */
    editDraft(patch: Partial<RequestDraft>) {
      dispatch({ type: 'editDraft', patch });
    },

    reset,

    /**
     * Called as the session changes. Signing out (null) or another user signing in resets and
     * clears the saved request; a user signing in gets back the request saved for them.
     * Resolves once any saved request has been read back.
     */
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

/** The app's store. Swap createMockBackend() for the real service here. */
export const volunteerRequests: RequestStore = createRequestStore(createMockBackend(), {
  storage: AsyncStorage,
  key: 'venu.volunteer.request',
});

export function useVolunteerRequest(store: RequestStore = volunteerRequests): RequestState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** False while a saved request may still be on its way back (just after start or sign-in). */
export function useVolunteerRestored(store: RequestStore = volunteerRequests): boolean {
  return useSyncExternalStore(store.subscribe, store.isRestored, store.isRestored);
}
