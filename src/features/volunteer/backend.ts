// The seam between the volunteer flow and the matching service. The app talks only to
// `VolunteerBackend`; `createMockBackend()` fakes it on the device, and `createSupabaseBackend()`
// (supabase-backend.ts) runs it on Supabase when the app has a project. app-backend.ts picks one.
// The visitor side (find, chat, end) is required; the volunteer side (open requests, Accept) is
// optional, and a backend without it keeps the volunteer home's example requests.
import { chatLanguage } from '@/features/translate/languages';
import { isUiLanguage } from '@/i18n';

import { greetingFrom, mockReply, MOCK_VOLUNTEERS, mockTextLanguage } from './mock';
import type { Assignment, ChatMessage, Feedback, HelpRequest, IncomingRequest, Match, ProblemReport, RequestClosed, Volunteer } from './types';

export interface VolunteerBackend {
  /** The id for a new request, when the service needs its own format (e.g. a UUID). Default: newId('req'). */
  newRequestId?(): string;
  /** Resolves when a volunteer accepts; rejects with an AbortError when `signal` aborts. */
  findVolunteer(request: HelpRequest, signal: AbortSignal): Promise<Match>;
  cancelRequest(requestId: string): Promise<void>;
  /**
   * The search ran out of time: withdraws the request only if it's still open. Resolves with the
   * match when a volunteer took it first (a late timer on a locked phone), else null. Optional:
   * without it the store calls cancelRequest.
   */
  withdrawRequest?(requestId: string): Promise<Match | null>;
  /** `lang`: the language the sender writes in (e.g. 'es'), so the reader's app knows what to translate. */
  sendMessage(requestId: string, text: string, lang?: string | null): Promise<void>;
  /**
   * Picks a matched request back up after an app restart (the store calls it before listening), so
   * the service knows who is on the other end. Optional: a server-side service already knows.
   */
  resume?(requestId: string, match: Match): void;
  /**
   * The other person's messages for a request, as they arrive (a live service also sends the ones
   * already there when you subscribe; the store skips ids it has). `since` (ms, the newest message
   * the caller already has): only messages from then on, so a resubscribe doesn't fetch the whole
   * chat again. Returns an unsubscribe function.
   */
  onMessage(requestId: string, listener: (message: ChatMessage) => void, since?: number): () => void;
  /**
   * Whether the volunteer is typing, called with the current value on subscribing and on each
   * change. Optional: a service without typing events just never shows the line.
   */
  onTyping?(requestId: string, listener: (typing: boolean) => void): () => void;
  /**
   * Called once when the request closes, whoever closed it: e.g. the volunteer ended the chat, or the
   * visitor cancelled. Optional: in the mock nobody else can close it.
   */
  onClosed?(requestId: string, listener: (closed: RequestClosed) => void): () => void;
  /**
   * Called once when the matched volunteer (`volunteerId`) hands the request back (e.g. they signed
   * out): it's open again, or another volunteer already took it. Optional: the mock volunteer never leaves.
   */
  onReleased?(requestId: string, volunteerId: string, listener: () => void): () => void;
  endHelp(requestId: string): Promise<void>;
  submitFeedback(feedback: Feedback): Promise<void>;
  reportProblem(report: ProblemReport): Promise<void>;

  // ---- the volunteer's side (live matching only)
  /** Open requests, newest first, called on subscribing and on each change. Returns an unsubscribe function. */
  watchOpenRequests?(listener: (requests: IncomingRequest[]) => void): () => void;
  /**
   * Takes an open request. Rejects with AlreadyTakenError when another volunteer got it first,
   * RequestClosedError when the visitor withdrew it, AlreadyHelpingError when this volunteer
   * already has one, NotVerifiedError when LA28 hasn't verified this volunteer yet.
   */
  acceptRequest?(requestId: string): Promise<Assignment>;
  /** The volunteer leaves without finishing ("Can't make it", or signing out): the request opens again for someone else. */
  releaseRequest?(requestId: string): Promise<void>;
  /** The request this volunteer accepted and hasn't finished, e.g. after an app restart. */
  currentAssignment?(): Promise<Assignment | null>;
  /** Every message on a request so far, both people's, oldest first. */
  loadMessages?(requestId: string): Promise<ChatMessage[]>;
}

/** Accept lost the race: another volunteer took the request first. */
export class AlreadyTakenError extends Error {
  constructor() {
    super('Someone else already took this request');
    this.name = 'AlreadyTakenError';
  }
}

/** Accept came too late: the visitor cancelled the request (or it was finished). */
export class RequestClosedError extends Error {
  constructor() {
    super('This request was withdrawn');
    this.name = 'RequestClosedError';
  }
}

/** Accept refused: LA28 hasn't verified this volunteer yet (profiles.verified is false). */
export class NotVerifiedError extends Error {
  constructor() {
    super('Waiting for verification');
    this.name = 'NotVerifiedError';
  }
}

/** Accept refused: this volunteer is already helping someone (e.g. accepted on another device). */
export class AlreadyHelpingError extends Error {
  constructor() {
    super('Already helping someone');
    this.name = 'AlreadyHelpingError';
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function abortError(): Error {
  const e = new Error('Request cancelled');
  e.name = 'AbortError';
  return e;
}

/** Timings for the fake service, in ms. Tests shrink them to 0 with fake timers anyway. */
export const MOCK_TIMING = { search: 2500, greeting: 1200, reply: 1500 };

/**
 * The mock volunteer for a request: the first who speaks its language, else (chat translation
 * covers the app's languages) the first on shift. Nobody for a language no one speaks and the app
 * can't translate, so "No volunteer is free" can be tried: e.g. 'es' → Daniel, 'ja' → Daniel, 'de' → null.
 */
export function mockVolunteerFor(language: string): Volunteer | null {
  return MOCK_VOLUNTEERS.find(v => v.languages.includes(language)) ?? (isUiLanguage(language) ? MOCK_VOLUNTEERS[0]! : null);
}

/**
 * On-device stand-in: "finds" mockVolunteerFor the request after a short wait (or never, leaving
 * the store's timeout to give up), and has them answer each message with a canned reply.
 */
export function createMockBackend(timing = MOCK_TIMING): VolunteerBackend {
  const listeners = new Map<string, Set<(m: ChatMessage) => void>>();
  const replyIndex = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>[]>();
  const typingListeners = new Map<string, Set<(typing: boolean) => void>>();
  /** Replies scheduled but not sent yet, per request: the volunteer is "typing" while any are. */
  const pending = new Map<string, number>();
  /** The language the matched volunteer's lines are in, per request (kept in the saved Match too). */
  const langs = new Map<string, string>();

  function notifyTyping(requestId: string) {
    const typing = (pending.get(requestId) ?? 0) > 0;
    typingListeners.get(requestId)?.forEach(l => l(typing));
  }

  function emit(requestId: string, text: string) {
    const lang = langs.get(requestId);
    const message: ChatMessage = { id: newId('msg'), from: 'them', text, sentAt: Date.now(), ...(lang ? { lang } : {}) };
    listeners.get(requestId)?.forEach(l => l(message));
  }

  /** The volunteer types for `ms`, then sends `text`. */
  function replyLater(requestId: string, ms: number, text: string) {
    pending.set(requestId, (pending.get(requestId) ?? 0) + 1);
    notifyTyping(requestId);
    const t = setTimeout(() => {
      pending.set(requestId, (pending.get(requestId) ?? 1) - 1);
      emit(requestId, text);
      notifyTyping(requestId);
    }, ms);
    timers.set(requestId, [...(timers.get(requestId) ?? []), t]);
  }

  function stop(requestId: string) {
    timers.get(requestId)?.forEach(clearTimeout);
    timers.delete(requestId);
    replyIndex.delete(requestId);
    pending.delete(requestId);
    notifyTyping(requestId);
    typingListeners.delete(requestId);
  }

  return {
    findVolunteer(request, signal) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(abortError());
        const volunteer = mockVolunteerFor(request.language);
        const t = setTimeout(() => {
          if (!volunteer) return; // nobody free: wait until the caller gives up
          langs.set(request.id, mockTextLanguage(volunteer));
          // Like a real volunteer, say hello once matched.
          replyLater(request.id, timing.greeting, greetingFrom(volunteer, request.visitorName, request.location));
          resolve({ volunteer, language: chatLanguage(volunteer.languages), etaMinutes: 2, distanceFeet: 180 });
        }, timing.search);
        signal.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
      });
    },
    async cancelRequest(requestId) {
      stop(requestId);
      listeners.delete(requestId);
    },
    // Nobody here accepts after the search gives up, so it's always withdrawn.
    async withdrawRequest(requestId) {
      stop(requestId);
      listeners.delete(requestId);
      return null;
    },
    async sendMessage(requestId) {
      const i = replyIndex.get(requestId) ?? 0;
      replyIndex.set(requestId, i + 1);
      replyLater(requestId, timing.reply, mockReply(i, langs.get(requestId)));
    },
    resume(requestId, match) {
      langs.set(requestId, mockTextLanguage(match.volunteer));
    },
    onMessage(requestId, listener) {
      const set = listeners.get(requestId) ?? new Set();
      set.add(listener);
      listeners.set(requestId, set);
      return () => { set.delete(listener); };
    },
    onTyping(requestId, listener) {
      const set = typingListeners.get(requestId) ?? new Set();
      set.add(listener);
      typingListeners.set(requestId, set);
      listener((pending.get(requestId) ?? 0) > 0);
      return () => { set.delete(listener); };
    },
    async endHelp(requestId) {
      stop(requestId);
      listeners.delete(requestId);
    },
    async submitFeedback() {},
    async reportProblem() {},
  };
}
