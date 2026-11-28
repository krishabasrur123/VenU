// The promoted card says the same walk as the rows around it (walkTo), not the stand's stand-in
// walkMinutes: after "I'm here" at First Aid Terrace, the Coca-Cola stand is no longer "1 min walk".
import { describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import i18n from '@/i18n';

import { walkFromStart } from '../directions';
import { getVenue } from '../mock';
import { PromotedCard } from '../sponsor-ui';
import { featuredStandFor, venueFacilitiesFor } from '../sponsors';
import { venueMapFor } from '../venue-maps';

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const label = (c: TestInstance) => c.queryAll(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Sponsored: '))[0]?.props.accessibilityLabel as string | undefined;

describe('PromotedCard', () => {
  it('shows the walk it is given, the one the list rows use', async () => {
    await i18n.changeLanguage('en');
    const stand = featuredStandFor('intuit-dome')!;
    const where = { venueId: 'intuit-dome', facilityId: 'first-aid-terrace' };
    const walk = walkFromStart(venueMapFor(getVenue('intuit-dome')!), venueFacilitiesFor('intuit-dome'), where, 'intuit-dome', stand);
    expect(walk).toEqual({ kind: 'walk', minutes: expect.any(Number) });
    const minutes = (walk as { minutes: number }).minutes;
    expect(minutes).not.toBe(stand.walkMinutes); // far from the stand: not its 1 min from the way in

    const root = createRoot();
    await act(async () => { root.render(<PromotedCard stand={stand} walk={walk} onPress={() => {}} />); });
    expect(label(root.container)).toContain(`${minutes} min walk · Short wait`);

    await act(async () => { root.render(<PromotedCard stand={stand} walk={{ kind: 'start' }} onPress={() => {}} />); });
    expect(label(root.container)).toContain('Walks start here · Short wait');
  });
});
