// The volunteer's side of live matching: open requests nearby, Accept, then the chat with the visitor
// until one of them ends it. The visitor's side is request-store.ts; both talk to the same backend.
// Only live backends (supabase-backend.ts) have a volunteer side; with the mock, `live` is false and
// the volunteer home keeps its example requests.
//
// Nothing is saved on the device: after a restart, setUser asks the backend for the request this
// volunteer accepted and loads its chat again.
import { useSyncExternalStore } from 'react';

import { onBeforeSignOut } from '@/lib/before-sign-out';

import { appBackend } from './app-backend';
import { AlreadyHelpingError, AlreadyTakenError, newId, NotVerifiedError, RequestClosedError, type VolunteerBackend } from './backend';
import type { Assignment, ChatMessage, IncomingRequest, RequestClosed } from './types';

/**
 * volunteer:desk.<key>, e.g. { key: 'cancelled', params: { name: 'Rosa' } } → "Rosa cancelled the request."
 * closed: called off without either of them (e.g. the visitor's account was deleted).
 * handedBack: this volunteer tapped "Can't make it".
 */
export type DeskNoticeKey = 'taken' | 'withdrawn' | 'acceptFailed' | 'notVerified' | 'cancelled' | 'closed' | 'done' | 'ended' | 'handedBack';

/** The other person ended it: the banner stays until dismissed, so it isn't missed on the way back from the chat. */
export const STICKY_DESK_NOTICES: DeskNoticeKey[] = ['cancelled', 'closed', 'done'];

/** A restore that failed (offline) tries again after this, doubling each time up to RESTORE_RETRY_MAX_MS. */
export const RESTORE_RETRY_MS = 2000;
export const RESTORE_RETRY_MAX_MS = 30_000;

export interface DeskNotice {
  tone: 'success' | 'error';
  key: DeskNoticeKey;
  params?: { name?: string };
}

export interface DeskState {
  /** Open requests nearby, newest first (only while the list is being watched). */
  open: IncomingRequest[];
  /** The request this volunteer accepted and is helping with, or null. */
  assignment: Assignment | null;
  messages: ChatMessage[];
  /** The visitor's messages not yet seen (the dot on Message). */
  unread: number;
  /** The request an Accept is in flight for. */
  accepting: string | null;
  notice: DeskNotice | null;
}

export const INITIAL_DESK: DeskState = { open: [], assignment: null, messages: [], unread: 0, accepting: null, notice: null };

export function createDeskStore(backend: VolunteerBackend) {
  let state = INITIAL_DESK;
  const listeners = new Set<() => void>();
  let owner: string | null = null;
  let restored = false;
  /** Bumped on every user change, so late answers for the previous user are dropped. */
  let generation = 0;
  let senderLanguage: string | null = null;
  let stopChat: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Requests this volunteer handed back ("Can't make it"): kept off their list, so they go to someone else. */
  let handedBack = new Set<string>();

  const live = !!(backend.watchOpenRequests && backend.acceptRequest);

  function set(patch: Partial<DeskState>) {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
  }

  function leaveChat() {
    stopChat?.();
    stopChat = null;
  }

  /** A new message from the visitor. One already here (by id, e.g. from the history) changes nothing. */
  function receive(requestId: string, message: ChatMessage) {
    if (state.assignment?.id !== requestId || state.messages.some(m => m.id === message.id)) return;
    set({ messages: [...state.messages, message], unread: state.unread + (message.from === 'them' ? 1 : 0) });
  }

  function markFailed(id: string, failed: boolean) {
    if (!state.messages.some(m => m.id === id && !!m.failed !== failed)) return;
    set({ messages: state.messages.map(m => (m.id === id ? { ...m, failed } : m)) });
  }

  /** Sends one of the volunteer's messages; if the service refuses it, it's marked "Not sent". */
  function deliver(requestId: string, message: ChatMessage) {
    backend.sendMessage(requestId, message.text, message.lang ?? null).catch(() => {
      if (state.assignment?.id === requestId) markFailed(message.id, true);
    });
  }

  function closed(requestId: string, how: RequestClosed) {
    const a = state.assignment;
    if (!a || a.id !== requestId) return;
    leaveChat();
    const key: DeskNoticeKey = how.byMe ? 'ended' : how.status === 'done' ? 'done' : how.bySystem ? 'closed' : 'cancelled';
    set({ assignment: null, messages: [], unread: 0, notice: { tone: 'success', key, params: { name: a.visitorName } } });
  }

  /**
   * Shows `assignment` and follows its chat: the messages so far (already read: the volunteer is
   * opening the chat they had), then new ones after the newest of those, until it closes. History
   * loads before listening, so it never arrives as new messages that light up the unread dot.
   */
  function join(assignment: Assignment, mine: number) {
    leaveChat();
    set({ assignment, messages: [], unread: 0, open: state.open.filter(r => r.id !== assignment.id) });
    const id = assignment.id;
    let left = false;
    let offMessage: (() => void) | null = null;
    const listen = (since?: number) => {
      if (!left && mine === generation) offMessage = backend.onMessage(id, m => receive(id, m), since);
    };
    const offClosed = backend.onClosed?.(id, how => closed(id, how));
    stopChat = () => {
      left = true;
      offMessage?.();
      offClosed?.();
    };
    if (!backend.loadMessages) return listen();
    backend.loadMessages(id).then(
      history => {
        if (left || mine !== generation || state.assignment?.id !== id) return;
        const have = new Set(state.messages.map(m => m.id));
        const merged = [...history.filter(m => !have.has(m.id)), ...state.messages].sort((x, y) => x.sentAt - y.sentAt);
        set({ messages: merged });
        listen(history.length ? Math.max(...history.map(m => m.sentAt)) : undefined);
      },
      // Couldn't load it: listen from the start, so the messages still arrive (as unread).
      () => listen(),
    );
  }

  function clear() {
    leaveChat();
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    generation += 1;
    handedBack = new Set();
    state = INITIAL_DESK;
    listeners.forEach(l => l());
  }

  /**
   * Picks up the request this volunteer accepted and hasn't finished, if any. Offline, it tries
   * again after RESTORE_RETRY_MS, then twice as long each time, until it gets an answer or the user changes.
   */
  async function restore(mine: number, wait = RESTORE_RETRY_MS): Promise<void> {
    if (!backend.currentAssignment) return;
    try {
      const assignment = await backend.currentAssignment();
      if (assignment && mine === generation && !state.assignment) join(assignment, mine);
    } catch {
      if (mine !== generation || state.assignment) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (mine === generation && !state.assignment) void restore(mine, Math.min(wait * 2, RESTORE_RETRY_MAX_MS));
      }, wait);
    }
  }

  return {
    /** True when the backend has real open requests (Supabase); false keeps the examples. */
    live,
    getState: () => state,
    isRestored: () => restored,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    /** Keeps `open` up to date while the list is on screen. Returns a stop function. */
    watchOpen(): () => void {
      if (!backend.watchOpenRequests) return () => {};
      const mine = generation;
      const stop = backend.watchOpenRequests(open => {
        if (mine !== generation) return;
        const taken = state.assignment?.id;
        set({ open: open.filter(r => r.id !== taken && !handedBack.has(r.id)) });
      });
      return () => {
        stop();
        if (mine === generation) set({ open: [] });
      };
    },

    /**
     * Takes an open request. True when this volunteer got it; false when someone else did first
     * ("already taken"), the visitor withdrew it ("withdrawn"), LA28 hasn't verified this volunteer
     * yet ("notVerified") or it failed (e.g. offline). When
     * this volunteer already has a request (accepted on another device), that one shows instead.
     */
    async accept(requestId: string): Promise<boolean> {
      if (!backend.acceptRequest || state.accepting || state.assignment) return false;
      const mine = generation;
      set({ accepting: requestId, notice: null });
      try {
        const assignment = await backend.acceptRequest(requestId);
        if (mine !== generation) return false;
        set({ accepting: null });
        join(assignment, mine);
        return true;
      } catch (e) {
        if (mine !== generation) return false;
        if (e instanceof AlreadyHelpingError) {
          set({ accepting: null });
          await restore(mine);
          return false;
        }
        const gone = e instanceof AlreadyTakenError || e instanceof RequestClosedError;
        const key = e instanceof NotVerifiedError ? 'notVerified' : e instanceof RequestClosedError ? 'withdrawn' : gone ? 'taken' : 'acceptFailed';
        set({
          accepting: null,
          open: gone ? state.open.filter(r => r.id !== requestId) : state.open,
          notice: { tone: 'error', key },
        });
        return false;
      }
    },

    sendMessage(text: string) {
      const body = text.trim();
      const id = state.assignment?.id;
      if (!body || !id) return;
      const lang = senderLanguage ? { lang: senderLanguage } : {};
      const message: ChatMessage = { id: newId('msg'), from: 'me', text: body, sentAt: Date.now(), ...lang };
      set({ messages: [...state.messages, message] });
      deliver(id, message);
    },

    /** "Tap to retry" on a message that wasn't sent: sends it again. */
    retryMessage(messageId: string) {
      const id = state.assignment?.id;
      const message = state.messages.find(m => m.id === messageId && m.failed);
      if (!id || !message) return;
      markFailed(messageId, false);
      deliver(id, message);
    },

    markRead() {
      if (state.unread) set({ unread: 0 });
    },

    /** The volunteer ends the chat: the help is done, and the visitor is asked for feedback. */
    endChat() {
      const id = state.assignment?.id;
      if (!id) return;
      closed(id, { status: 'done', byMe: true });
      backend.endHelp(id).catch(() => {});
    },

    /**
     * "Can't make it": hands the request back without finishing. It opens again for other
     * volunteers (not this one), and the visitor's app goes back to searching instead of asking
     * for a rating. False when the backend has no hand-back, or it failed (e.g. offline): the
     * request stays, and the card says it didn't work.
     */
    async handBack(): Promise<boolean> {
      const a = state.assignment;
      if (!a || !backend.releaseRequest) return false;
      const mine = generation;
      try {
        await backend.releaseRequest(a.id);
      } catch {
        return false;
      }
      if (mine !== generation || state.assignment?.id !== a.id) return false;
      handedBack.add(a.id);
      leaveChat();
      set({
        assignment: null, messages: [], unread: 0, open: state.open.filter(r => r.id !== a.id),
        notice: { tone: 'success', key: 'handedBack', params: { name: a.visitorName } },
      });
      return true;
    },

    /**
     * Hands the request back while still signed in (runs just before sign-out): it opens again for
     * another volunteer, and the visitor goes back to searching instead of being asked to rate a
     * help that never happened.
     */
    async endSession(): Promise<void> {
      const id = state.assignment?.id;
      if (!id) return;
      await (backend.releaseRequest ? backend.releaseRequest(id) : backend.endHelp(id));
    },

    dismissNotice() {
      if (state.notice) set({ notice: null });
    },

    setLanguage(lang: string | null) {
      senderLanguage = lang;
    },

    /**
     * Called as the session changes. A volunteer signing in gets back the request they accepted (if
     * it's still on); anyone else, or signing out, starts empty.
     */
    async setUser(userId: string | null, isVolunteer = true): Promise<void> {
      const who = userId && isVolunteer ? userId : null;
      if (who === owner && (restored || who !== null)) return;
      clear();
      owner = who;
      restored = false;
      const mine = generation;
      // Offline, the desk shows (restored) without it and keeps trying in the background.
      if (who) await restore(mine);
      if (mine === generation) {
        restored = true;
        listeners.forEach(l => l());
      }
    },
  };
}

export type DeskStore = ReturnType<typeof createDeskStore>;

/** The app's volunteer desk, on the same backend as the visitor's requests. */
export const volunteerDesk: DeskStore = createDeskStore(appBackend);

onBeforeSignOut(() => volunteerDesk.endSession());

export function useVolunteerDesk(store: DeskStore = volunteerDesk): DeskState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useDeskRestored(store: DeskStore = volunteerDesk): boolean {
  return useSyncExternalStore(store.subscribe, store.isRestored, store.isRestored);
}
