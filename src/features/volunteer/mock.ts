// Mock data for the volunteer flow. The real matching backend (owned by Krisha) replaces
// mockBackend in backend.ts; these lists stay as the UI's fixed options.
// Places are facility ids, worded in the reader's language. The volunteer writes in their own main
// language (Daniel: English), so chat translation has something to do; the stub translator
// (features/translate) knows these lines and the facility names in every locale. Venue and people's
// names stay as they are.
import { chatLanguage } from '@/features/translate/languages';
import i18n, { isUiLanguage } from '@/i18n';

import { meetSpotName, meetVenueName } from './meet-point';
import type { FeedbackTag, HelpTypeId, IncomingRequest, MeetPoint, ProblemKind, Volunteer } from './types';

/** The six "What do you need help with?" rows, in screen order (labels: volunteer `helpTypes.<id>`). */
export const HELP_TYPES: HelpTypeId[] = ['physical', 'directions', 'language', 'quiet', 'lost', 'other'];

/** Volunteers on shift near the visitor. The mock matcher picks the first who speaks the request's language. */
export const MOCK_VOLUNTEERS: Volunteer[] = [
  {
    id: 'vol-daniel',
    name: 'Daniel K.',
    firstName: 'Daniel',
    possessive: 'his',
    languages: ['en', 'es'],
    rating: 4.9,
    tags: [
      { label: 'Wheelchair trained', skill: 'wheelchair', tone: 'success' },
      { label: 'English', tone: 'warning' },
      { label: 'Español', tone: 'warning' },
    ],
  },
  {
    id: 'vol-minji',
    name: 'Min-ji P.',
    firstName: 'Min-ji',
    possessive: 'her',
    languages: ['ko', 'en'],
    rating: 4.8,
    tags: [
      { label: 'First aid', skill: 'first_aid', tone: 'success' },
      { label: '한국어', tone: 'warning' },
      { label: 'English', tone: 'warning' },
    ],
  },
  {
    id: 'vol-amara',
    name: 'Amara O.',
    firstName: 'Amara',
    possessive: 'her',
    languages: ['en', 'fr', 'ase'],
    rating: 5,
    tags: [
      { label: 'ASL', skill: 'asl', tone: 'success' },
      { label: 'Français', tone: 'warning' },
      { label: 'English', tone: 'warning' },
    ],
  },
];

/**
 * The language the mock volunteer's lines are actually in: their chat language when the string
 * tables have it, else English. e.g. Daniel → 'en', Min-ji → 'ko'.
 */
export function mockTextLanguage(v: Volunteer): string {
  const lang = chatLanguage(v.languages);
  return isUiLanguage(lang) ? lang : 'en';
}

/**
 * "Hi Rosa! I'm Daniel, your LA28 volunteer. I'm heading to you now. Meeting point: Entry 4."
 * The spot as the volunteer would write it (their language), or the venue when there's no spot.
 */
export function greetingFrom(v: Volunteer, visitorName: string, location: MeetPoint): string {
  const lng = mockTextLanguage(v);
  const place = meetSpotName(location, i18n.getFixedT(lng, 'venue')) ?? meetVenueName(location);
  return visitorName
    ? i18n.t('volunteer:mock.greeting', { lng, name: visitorName, volunteer: v.firstName, spot: place })
    : i18n.t('volunteer:mock.greetingNoName', { lng, volunteer: v.firstName, spot: place });
}

/** The mock volunteer's replies in `lng`, in order (then the last one repeats). */
export function mockReply(index: number, lng = i18n.language): string {
  if (index <= 0) return i18n.t('volunteer:mock.reply1', { lng });
  if (index === 1) return i18n.t('volunteer:mock.reply2', { lng });
  return i18n.t('volunteer:mock.reply3', { lng });
}

/** "What went well?" chips (labels: volunteer `feedback.tags.<value>`). */
export const FEEDBACK_TAGS: FeedbackTag[] = ['language', 'venue', 'patient', 'fast', 'helpful', 'other'];

/** "Report a problem" kinds (labels: volunteer `report.kinds.<value>`). */
export const PROBLEM_KINDS: ProblemKind[] = ['no_show', 'unsafe', 'rude', 'other'];

/** What a signed-in volunteer sees on their tab until real matching exists. */
export function mockIncoming(): IncomingRequest[] {
  return [
    { id: 'in-1', visitorName: 'Rosa', helpType: 'physical', location: { venueId: 'sofi', facilityId: 'pedestrian-ramp' }, language: 'es', minutesAgo: 1, distanceFeet: 180 },
    { id: 'in-2', visitorName: 'Wei', helpType: 'directions', location: { venueId: 'sofi', facilityId: 'entry-8' }, language: 'zh', minutesAgo: 4, distanceFeet: 420 },
    { id: 'in-3', visitorName: 'Sam', helpType: 'quiet', location: { venueId: 'sofi', facilityId: 'guest-services-sw' }, language: 'en', minutesAgo: 7, distanceFeet: 650 },
  ];
}
