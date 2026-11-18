// The chat screen's view of a request, from either side: a visitor chatting with the volunteer who
// accepted (request-store.ts), or a volunteer chatting with the visitor they're helping (desk-store.ts).
// e.g. useConversation('req-1') → { side: 'visitor', peer: { name: 'Daniel K.', firstName: 'Daniel', language: 'en' }, … }
import { chatLanguage } from '@/features/translate/languages';

import { useDeskRestored, useVolunteerDesk, volunteerDesk } from './desk-store';
import { useVolunteerRequest, useVolunteerRestored, volunteerRequests } from './request-store';
import type { ChatMessage, HelpTypeId, MeetPoint } from './types';

export interface Conversation {
  side: 'visitor' | 'volunteer';
  /** The other person: the name on the header, and the language they read. */
  peer: { name: string; firstName: string; language: string };
  messages: ChatMessage[];
  unread: number;
  /** The other person is typing (only the mock volunteer reports it). */
  typing: boolean;
  /** For the visitor: "2 min away", when the service knows. */
  etaMinutes: number | null;
  /** For the volunteer: where the visitor is waiting. */
  meetPoint: MeetPoint | null;
  /**
   * What the visitor asked for, shown at the top of the chat. `mine`: the visitor's own (not
   * translated). `language`: the language they asked for help in, taken as the note's.
   */
  request: { id: string; helpTypes: HelpTypeId[]; note: string; language: string; mine: boolean };
  send(text: string): void;
  /** Sends a message that failed ("Not sent · Tap to retry") again, by id. */
  retry(messageId: string): void;
  markRead(): void;
}

/**
 * The live chat for request `id`, or null (it ended, or isn't yours). `restored`: false while a
 * saved request or accepted one may still be loading, so the screen waits before giving up on it.
 */
export function useConversation(id: string | undefined): { conversation: Conversation | null; restored: boolean } {
  const visitor = useVolunteerRequest();
  const visitorRestored = useVolunteerRestored();
  const desk = useVolunteerDesk();
  const deskRestored = useDeskRestored();
  const restored = visitorRestored && deskRestored;

  const { status, request, match } = visitor;
  if (id && status === 'matched' && request?.id === id && match) {
    const v = match.volunteer;
    return {
      restored,
      conversation: {
        side: 'visitor',
        peer: { name: v.name, firstName: v.firstName, language: match.language },
        messages: visitor.messages,
        unread: visitor.unread,
        typing: visitor.typing,
        etaMinutes: match.etaMinutes,
        meetPoint: null,
        request: { id: request.id, helpTypes: request.helpTypes, note: request.note, language: request.language, mine: true },
        send: volunteerRequests.sendMessage,
        retry: volunteerRequests.retryMessage,
        markRead: volunteerRequests.markRead,
      },
    };
  }

  const a = desk.assignment;
  if (id && a?.id === id) {
    return {
      restored,
      conversation: {
        side: 'volunteer',
        peer: { name: a.visitorName, firstName: a.visitorName, language: chatLanguage([a.language]) },
        messages: desk.messages,
        unread: desk.unread,
        typing: false,
        etaMinutes: null,
        meetPoint: a.location,
        request: { id: a.id, helpTypes: a.helpTypes, note: a.note, language: a.language, mine: false },
        send: volunteerDesk.sendMessage,
        retry: volunteerDesk.retryMessage,
        markRead: volunteerDesk.markRead,
      },
    };
  }

  return { conversation: null, restored };
}
