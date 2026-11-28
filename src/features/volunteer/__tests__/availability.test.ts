import { describe, expect, it } from '@jest/globals';

import { AVAILABILITIES, DEFAULT_AVAILABILITY, parseAvailability } from '../availability';

// Saving, retrying and per-account separation live in src/features/profile/__tests__/settings-sync.test.ts.
describe('volunteer availability', () => {
  it('starts Free, in screen order Free / Busy / Off', () => {
    expect(DEFAULT_AVAILABILITY).toBe('free');
    expect(AVAILABILITIES).toEqual(['free', 'busy', 'off']);
  });

  it('reads only the three statuses', () => {
    for (const s of AVAILABILITIES) expect(parseAvailability(s)).toBe(s);
    for (const raw of ['away', '"busy"', '', 'FREE', null, undefined, 1, {}]) expect(parseAvailability(raw)).toBeNull();
  });
});
