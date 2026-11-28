// Whether a volunteer takes requests right now: Free (requests reach them), Busy or Off (they skip).
// Kept on the volunteer's profile (profiles.availability), so it follows the account to any device and
// matching can read it. The profile provider saves a change at once and retries it offline
// (src/features/profile/settings-sync.ts). e.g. profile.availability === 'busy'

export type Availability = 'free' | 'busy' | 'off';

/** In screen order. Labels: volunteer:home.status.<value>. */
export const AVAILABILITIES: readonly Availability[] = ['free', 'busy', 'off'];
export const DEFAULT_AVAILABILITY: Availability = 'free';

/** A stored value that is one of the statuses, else null: parseAvailability('away') → null. */
export function parseAvailability(raw: unknown): Availability | null {
  return typeof raw === 'string' && (AVAILABILITIES as readonly string[]).includes(raw) ? (raw as Availability) : null;
}
