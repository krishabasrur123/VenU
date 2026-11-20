// Plain-language privacy policy. DRAFT: the team needs to review it before launch;
// this isn't legal text. Bump PRIVACY_VERSION whenever a section changes so
// profiles store which version the person agreed to.
// The points stay English in every language (legal text wants a reviewed translation); the summary
// and section headings are translated: profile:privacy.summary and profile:privacy.sections.<key>.

export const PRIVACY_VERSION = '2026-11-draft-4';

export type PrivacySectionKey = 'collect' | 'why' | 'who' | 'where' | 'keep' | 'choices';

export interface PrivacySection {
  /** Heading key: profile:privacy.sections.<key>. */
  key: PrivacySectionKey;
  /** English heading (the translated one is in the string tables). */
  title: string;
  points: string[];
}

/** English; screens show profile:privacy.summary. */
export const PRIVACY_SUMMARY =
  'We only ask for what we need to match you with the right helper, and you can change or delete it any time.';

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    key: 'collect',
    title: 'What we collect',
    points: [
      'Your first name and, if you add one, a profile photo.',
      'Languages you speak and how you like to communicate.',
      'The language you use the app in, so it opens in that language when you sign in on another phone.',
      'Access needs you choose to share, e.g. "Wheelchair user".',
      'Helper preferences (visitors), or training, gender and age range (volunteers).',
      'When you ask for help: what you need help with, your note, a photo if you add one, the language you want help in, and where you are in the venue.',
      'Chat messages between you and your helper.',
      'Ratings and problem reports you leave about a helper.',
      "Facility reports you write, e.g. \"Gate 2 ramp is cracked\".",
      'Feedback you send from Help & feedback.',
      'Your email, only to sign you in.',
    ],
  },
  {
    key: 'why',
    title: 'Why we collect it',
    points: [
      'To find a volunteer who speaks your language and has the right training.',
      'So you never have to explain your needs twice.',
      'We never sell your data or use it for ads.',
    ],
  },
  {
    key: 'who',
    title: 'Who sees it',
    points: [
      'Your helper sees your first name, photo, languages and the access needs you shared, and only while helping you.',
      'Visitors see a volunteer\'s first name, photo, languages and training.',
      'Your email, gender and age range are never shown to other people.',
      'Your helper sees your help request (needs, note, photo, meeting spot) and your chat with them.',
      'Facility reports are shown to other visitors at that venue, with your first name.',
      'Ratings and problem reports go to the VenU team. The helper never sees who left them.',
      'Chat messages go to a translation service so each person reads them in their own language. It gets only the message text and the two languages, never your name or profile.',
      "Voice typing uses your phone's or browser's speech recognition. If it can't run on the device, Apple, Google or your browser's maker turns the audio into text. VenU never keeps recordings.",
      "Venue maps are the venue's own map pages (e.g. SoFi Stadium, Crypto.com Arena) shown inside the app; those sites may set their own cookies.",
    ],
  },
  {
    key: 'where',
    title: 'Where it\'s stored',
    points: [
      'In our database (Supabase), encrypted in transit and protected so each account can only read its own profile.',
      'Profile photos are in private storage. Only you can open yours; during a help request the other person gets a short-lived link to it.',
      'Notification choices stay on your phone.',
    ],
  },
  {
    key: 'keep',
    title: 'How long we keep it',
    points: [
      'Your account, profile and photo: until you delete them (Profile → Delete my data).',
      'Data from LA28 events is deleted after the Games end (date TBD by the team).',
      'Help requests, chats, ratings and facility reports count as event data.',
    ],
  },
  {
    key: 'choices',
    title: 'Your choices',
    points: [
      'Edit your profile any time from the Profile tab.',
      'Access needs are optional. Share only what helps.',
      'Delete your data from Profile → Delete my data. It removes your account and sign-in email, profile and photo; the people you chatted with keep the help request, without your messages.',
    ],
  },
];
