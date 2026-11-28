// While the session loads, screens show the logo and a spinner instead of a blank page. With the
// server down, Supabase took about 5-7 s to fail before "Can't reach VenU", all of it blank.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import i18n from '@/i18n';

import { LOADING_SCREEN_DELAY_MS, LoadingScreen } from '../loading-screen';

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const spinners = (c: TestInstance) => c.queryAll(n => n.type === 'ActivityIndicator').length;
const labels = (c: TestInstance) => c.queryAll(n => typeof n.props.accessibilityLabel === 'string').map(n => n.props.accessibilityLabel as string);

describe('LoadingScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('stays empty for a quick load, then shows the spinner and says "Loading…"', async () => {
    const root = createRoot();
    await act(async () => { root.render(<LoadingScreen />); });
    expect(spinners(root.container)).toBe(0);
    expect(labels(root.container)).not.toContain('Loading…');

    await act(async () => { jest.advanceTimersByTime(LOADING_SCREEN_DELAY_MS); });
    expect(spinners(root.container)).toBe(1);
    expect(labels(root.container)).toContain('Loading…');
  });

  it('says it in the app language', async () => {
    await i18n.changeLanguage('es');
    const root = createRoot();
    await act(async () => { root.render(<LoadingScreen />); });
    await act(async () => { jest.advanceTimersByTime(LOADING_SCREEN_DELAY_MS); });
    expect(labels(root.container)).toContain(i18n.t('status.loading', { ns: 'common' }));
    expect(i18n.t('status.loading', { ns: 'common' })).not.toBe('Loading…');
  });

  it('cancels its timer when the load finishes first', async () => {
    const set = jest.spyOn(global, 'setTimeout');
    const clear = jest.spyOn(global, 'clearTimeout');
    const root = createRoot();
    await act(async () => { root.render(<LoadingScreen />); });
    const call = set.mock.calls.findIndex(([, ms]) => ms === LOADING_SCREEN_DELAY_MS);
    expect(call).toBeGreaterThanOrEqual(0);
    const id = set.mock.results[call].value as ReturnType<typeof setTimeout>;
    await act(async () => { root.unmount(); });
    expect(clear).toHaveBeenCalledWith(id);
  });
});
