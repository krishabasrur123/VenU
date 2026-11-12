// Mock data for the volunteer flow. The real matching backend (owned by Krisha) replaces
// mockBackend in backend.ts; these lists stay as the UI's fixed options.
// Places and the volunteer's chat lines are read from the string table when used, so the demo reads
// naturally in the visitor's language; venue and people's names stay as they are.
import i18n from '@/i18n';

import type { FeedbackTag, HelpTypeId, IncomingRequest, MeetPoint, ProblemKind, Volunteer } from './types';

/** The six "What do you need help with?" cards, in grid order (labels: volunteer `helpTypes.<id>`). */
export const HELP_TYPES: HelpTypeId[] = ['physical', 'directions', 'language', 'quiet', 'lost', 'other'];

/** Where the visitor is, e.g. "Near Gate 2 Ramp" at SoFi Stadium. Later: from the venue map / device location. */
export function mockLocation(): MeetPoint {
  return { spot: i18n.t('volunteer:mock.spots.gate2Ramp'), venue: 'SoFi Stadium' };
}

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

/** "Hi Rosa! I'm Daniel, your LA28 volunteer. I'm heading to you now. Meeting point: Near Gate 2 Ramp." */
export function greetingFrom(v: Volunteer, visitorName: string, spot: string): string {
  return visitorName
    ? i18n.t('volunteer:mock.greeting', { name: visitorName, volunteer: v.firstName, spot })
    : i18n.t('volunteer:mock.greetingNoName', { volunteer: v.firstName, spot });
}

/** The mock volunteer's replies, in order (then the last one repeats). */
export function mockReply(index: number): string {
  if (index <= 0) return i18n.t('volunteer:mock.reply1');
  if (index === 1) return i18n.t('volunteer:mock.reply2');
  return i18n.t('volunteer:mock.reply3');
}

/** "What went well?" chips (labels: volunteer `feedback.tags.<value>`). */
export const FEEDBACK_TAGS: FeedbackTag[] = ['language', 'venue', 'patient', 'fast', 'helpful', 'other'];

/** "Report a problem" kinds (labels: volunteer `report.kinds.<value>`). */
export const PROBLEM_KINDS: ProblemKind[] = ['no_show', 'unsafe', 'rude', 'other'];

/** What a signed-in volunteer sees on their tab until real matching exists. */
export function mockIncoming(): IncomingRequest[] {
  const spot = (key: 'gate2Ramp' | 'section214' | 'mainPlaza') => i18n.t(`volunteer:mock.spots.${key}`);
  return [
    { id: 'in-1', visitorName: 'Rosa', helpType: 'physical', spot: spot('gate2Ramp'), venue: 'SoFi Stadium', language: 'es', minutesAgo: 1, distanceFeet: 180 },
    { id: 'in-2', visitorName: 'Wei', helpType: 'directions', spot: spot('section214'), venue: 'SoFi Stadium', language: 'zh', minutesAgo: 4, distanceFeet: 420 },
    { id: 'in-3', visitorName: 'Sam', helpType: 'quiet', spot: spot('mainPlaza'), venue: 'SoFi Stadium', language: 'en', minutesAgo: 7, distanceFeet: 650 },
  ];
}
