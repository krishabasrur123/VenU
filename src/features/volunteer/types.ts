// Shapes for the visitor's "get a volunteer" flow: request → match → chat → feedback.
// The backend (matching, chat, feedback) sits behind VolunteerBackend in backend.ts.

export type HelpTypeId = 'physical' | 'directions' | 'language' | 'quiet' | 'lost' | 'other';


/**
 * Where the visitor is waiting, as ids so it's worded in the language on screen (meet-point.ts).
 * e.g. { venueId: 'sofi', facilityId: 'entry-4' } = "Near Entry 4 · SoFi Stadium".
 */
export interface MeetPoint {
  venueId: string;
  /** A facility in that venue, or null when the visitor isn't sure. */
  facilityId: string | null;
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
  /** Average stars, e.g. 4.9; null for someone with no ratings yet (live matching keeps none). */
  rating: number | null;
  /** `label` shows as is (language names are native names) unless `skill` names a translated training. */
  tags: { label: string; tone: TagTone; skill?: SkillCode }[];
}

/** What the backend returns once someone accepts the request. */
export interface Match {
  volunteer: Volunteer;
  /** The language the volunteer reads and writes chat in, e.g. 'en' (chatLanguage of their languages). */
  language: string;
  /** Estimates for "2 min until arrival" and "180 ft away"; null when the service doesn't know (live matching). */
  etaMinutes: number | null;
  distanceFeet: number | null;
}

export interface ChatMessage {
  id: string;
  /** 'them': the other person in the chat (the volunteer for a visitor, the visitor for a volunteer). */
  from: 'me' | 'them';
  text: string;
  sentAt: number;
  /** Language the sender wrote in, when known (e.g. 'en'). Lets the reader skip translating their own language. */
  lang?: string;
  /** Yours, and the service refused it (e.g. offline): "Not sent · Tap to retry" shows under it. */
  failed?: boolean;
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
 * idle: the request form. searching: waiting for a match. notFound: the wait ran out with nobody
 * free; the request is kept so they can search again. matched: a volunteer is on the way.
 * done: the help ended; the visitor is asked for feedback.
 */
export type RequestStatus = 'idle' | 'searching' | 'notFound' | 'matched' | 'done';

/** volunteer:notice.<key>. volunteerEnded: the volunteer ended the chat, shown above the rating. */
export type NoticeKey = 'thanks' | 'searchFailed' | 'volunteerLeft' | 'volunteerEnded';

export interface Notice {
  tone: 'success' | 'error';
  key: NoticeKey;
  params?: { name?: string };
}

export interface RequestState {
  status: RequestStatus;
  request: HelpRequest | null;
  match: Match | null;
  messages: ChatMessage[];
  /** Volunteer messages the visitor hasn't seen (drives the dot on the message icon). */
  unread: number;
  /**
   * One-off note for the home screen, as a string key and its values so the banner words it in the
   * language on screen when it shows, e.g. { tone: 'success', key: 'thanks', params: { name: 'Daniel' } }.
   */
  notice: Notice | null;
  /** The form's contents; survives a failed search or a cancel, cleared once the help ends. */
  draft: RequestDraft | null;
  /** The volunteer is writing a reply ("Daniel is typing…"). */
  typing: boolean;
}

/** An open request as a volunteer sees it under "Incoming requests". */
export interface IncomingRequest {
  id: string;
  visitorName: string;
  /** The first thing they asked for (the card's icon and title). */
  helpType: HelpTypeId;
  location: MeetPoint;
  language: string;
  minutesAgo: number;
  /** null when the service doesn't know where the volunteer is (live matching). */
  distanceFeet: number | null;
  /** What the visitor wrote, or ''. */
  note?: string;
}

/** A request this volunteer accepted: who they're helping, where, and in which language. */
export interface Assignment {
  id: string;
  visitorName: string;
  helpTypes: HelpTypeId[];
  note: string;
  /** The language the visitor asked for help in, e.g. 'es'. */
  language: string;
  location: MeetPoint;
  createdAt: number;
}

/** How a request ended: called off ('cancelled') or the help happened ('done'). */
export type ClosedStatus = 'cancelled' | 'done';

/**
 * A request closing, as the backend reports it. `byMe`: this device's user closed it. `bySystem`:
 * neither person did (e.g. the visitor's account was deleted), so nobody is named as cancelling.
 */
export interface RequestClosed {
  status: ClosedStatus;
  byMe: boolean;
  bySystem?: boolean;
}
