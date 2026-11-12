// Shapes for the visitor's "get a volunteer" flow: request → match → chat → feedback.
// The backend (matching, chat, feedback) sits behind VolunteerBackend in backend.ts.

export type HelpTypeId = 'physical' | 'directions' | 'language' | 'quiet' | 'lost' | 'other';


/** Where the visitor is waiting, e.g. "Near Gate 2 Ramp" at "SoFi Stadium". */
export interface MeetPoint {
  spot: string;
  venue: string;
}

export interface HelpRequest {
  id: string;
  /** First name, so the volunteer knows who to look for. */
  visitorName: string;
  helpTypes: HelpTypeId[];
  note: string;
  /** Local URI of a photo the visitor attached (where they are, what they need). */
  photoUri: string | null;
  /** Language code the visitor wants help in. */
  language: string;
  location: MeetPoint;
  createdAt: number;
}

export type TagTone = 'success' | 'warning';

/** Trainings shown as green tags; the label comes from volunteer `skills.<code>`. */
export type SkillCode = 'wheelchair' | 'first_aid' | 'asl';

export interface Volunteer {
  id: string;
  /** "Daniel K.": first name plus last initial, never a full name. */
  name: string;
  firstName: string;
  /** For "Daniel is on his way". */
  possessive: 'his' | 'her' | 'their';
  languages: string[];
  rating: number;
  /** `label` shows as is (language names are native names) unless `skill` names a translated training. */
  tags: { label: string; tone: TagTone; skill?: SkillCode }[];
}

/** What the backend returns once someone accepts the request. */
export interface Match {
  volunteer: Volunteer;
  etaMinutes: number;
  distanceFeet: number;
}

export interface ChatMessage {
  id: string;
  from: 'me' | 'volunteer';
  text: string;
  sentAt: number;
}

export type FeedbackTag = 'language' | 'venue' | 'patient' | 'fast' | 'helpful' | 'other';

export interface Feedback {
  requestId: string;
  volunteerId: string;
  /** 1–5 */
  stars: number;
  tags: FeedbackTag[];
  note: string;
}

export type ProblemKind = 'no_show' | 'unsafe' | 'rude' | 'other';

export interface ProblemReport {
  requestId: string;
  volunteerId: string;
  kind: ProblemKind;
  note: string;
}

/** What the visitor has filled in on the request form, kept while they search or cancel. */
export interface RequestDraft {
  helpTypes: HelpTypeId[];
  note: string;
  photoUri: string | null;
  /** null: the profile's main language. */
  language: string | null;
}

/**
 * idle: the request form. searching: waiting for a match. matched: a volunteer is on the way.
 * done: the help ended; the visitor is asked for feedback.
 */
export type RequestStatus = 'idle' | 'searching' | 'matched' | 'done';

export interface RequestState {
  status: RequestStatus;
  request: HelpRequest | null;
  match: Match | null;
  messages: ChatMessage[];
  /** Volunteer messages the visitor hasn't seen (drives the dot on the message icon). */
  unread: number;
  /** One-off note for the home screen, e.g. "Thanks for your feedback" or "Couldn't find anyone". */
  notice: { tone: 'success' | 'error'; text: string } | null;
  /** The form's contents; survives a failed search or a cancel, cleared once the help ends. */
  draft: RequestDraft | null;
  /** The volunteer is writing a reply ("Daniel is typing…"). */
  typing: boolean;
}

/** An open request as a volunteer sees it (volunteer role's placeholder list). */
export interface IncomingRequest {
  id: string;
  visitorName: string;
  helpType: HelpTypeId;
  spot: string;
  venue: string;
  language: string;
  minutesAgo: number;
  distanceFeet: number;
}
