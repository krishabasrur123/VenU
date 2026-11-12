// The seam between the volunteer flow and the matching service. The app talks only to
// `VolunteerBackend`; `createMockBackend()` fakes it on the device. A Supabase version (matching owned
// by Krisha) implements the same interface and is swapped in where the store is created.
import { greetingFrom, mockReply, MOCK_VOLUNTEERS } from './mock';
import type { ChatMessage, Feedback, HelpRequest, Match, ProblemReport } from './types';

export interface VolunteerBackend {
  /** Resolves when a volunteer accepts; rejects with an AbortError when `signal` aborts. */
  findVolunteer(request: HelpRequest, signal: AbortSignal): Promise<Match>;
  cancelRequest(requestId: string): Promise<void>;
  sendMessage(requestId: string, text: string): Promise<void>;
  /** Volunteer messages for a request, as they arrive. Returns an unsubscribe function. */
  onMessage(requestId: string, listener: (message: ChatMessage) => void): () => void;
  /**
   * Whether the volunteer is typing, called with the current value on subscribing and on each
   * change. Optional: a service without typing events just never shows the line.
   */
  onTyping?(requestId: string, listener: (typing: boolean) => void): () => void;
  endHelp(requestId: string): Promise<void>;
  submitFeedback(feedback: Feedback): Promise<void>;
  reportProblem(report: ProblemReport): Promise<void>;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function abortError(): Error {
  const e = new Error('Request cancelled');
  e.name = 'AbortError';
  return e;
}

/** Timings for the fake service, in ms. Tests shrink them to 0 with fake timers anyway. */
export const MOCK_TIMING = { search: 2500, greeting: 1200, reply: 1500 };

/**
 * On-device stand-in: "finds" the first volunteer who speaks the request's language (else the
 * first on shift) after a short wait, and has them answer each message with a canned reply.
 */
export function createMockBackend(timing = MOCK_TIMING): VolunteerBackend {
  const listeners = new Map<string, Set<(m: ChatMessage) => void>>();
  const replyIndex = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>[]>();
  const typingListeners = new Map<string, Set<(typing: boolean) => void>>();
  /** Replies scheduled but not sent yet, per request: the volunteer is "typing" while any are. */
  const pending = new Map<string, number>();

  function notifyTyping(requestId: string) {
    const typing = (pending.get(requestId) ?? 0) > 0;
    typingListeners.get(requestId)?.forEach(l => l(typing));
  }

  function emit(requestId: string, text: string) {
    const message: ChatMessage = { id: newId('msg'), from: 'volunteer', text, sentAt: Date.now() };
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
        const t = setTimeout(() => {
          const volunteer = MOCK_VOLUNTEERS.find(v => v.languages.includes(request.language)) ?? MOCK_VOLUNTEERS[0]!;
          // Like a real volunteer, say hello once matched.
          replyLater(request.id, timing.greeting, greetingFrom(volunteer, request.visitorName, request.location.spot));
          resolve({ volunteer, etaMinutes: 2, distanceFeet: 180 });
        }, timing.search);
        signal.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
      });
    },
    async cancelRequest(requestId) {
      stop(requestId);
      listeners.delete(requestId);
    },
    async sendMessage(requestId) {
      const i = replyIndex.get(requestId) ?? 0;
      replyIndex.set(requestId, i + 1);
      replyLater(requestId, timing.reply, mockReply(i));
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
