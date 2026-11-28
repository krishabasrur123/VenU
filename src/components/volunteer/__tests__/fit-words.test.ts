import { describe, expect, it, jest } from '@jest/globals';

import { statusLabelFit } from '../status-card';

jest.mock('@/i18n', () => ({ useT: () => (k: string) => k }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('status tiles keep words whole', () => {
  it('keeps 15pt and roomy padding when the word fits', () => {
    expect(statusLabelFit(311, 60)).toEqual({ size: 15, padding: 12 });
    expect(statusLabelFit(0, 400)).toEqual({ size: 15, padding: 12 });
  });

  it('tightens the padding, then shrinks the text, never below 11pt', () => {
    // "Զբաղված" is ~72pt at 15pt; a 320pt phone's row is 248pt wide.
    expect(statusLabelFit(248, 72)).toEqual({ size: 11, padding: 8 });
    expect(statusLabelFit(248, 400)).toEqual({ size: 11, padding: 8 });
    expect(statusLabelFit(311, 75)).toEqual({ size: 15, padding: 8 });
  });
});
