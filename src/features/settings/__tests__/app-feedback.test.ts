// Help & feedback's box: what goes to public.app_feedback, and local mode's console fallback.
import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { appFeedbackRow, createAppFeedbackSender } from '../app-feedback';

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

function client(error: unknown = null) {
  const insert = jest.fn(async (_row: unknown) => ({ error }));
  const from = jest.fn((_table: string) => ({ insert }));
  return { from, insert, client: { from } as unknown as SupabaseClient };
}

describe('app feedback', () => {
  it('sends the trimmed note with the app language and platform, asking nothing back', async () => {
    const c = client();
    await createAppFeedbackSender(c.client, 'ios')('  The map was hard to read  ', 'es');
    expect(c.from).toHaveBeenCalledWith('app_feedback');
    expect(c.insert).toHaveBeenCalledWith({ note: 'The map was hard to read', language: 'es', platform: 'ios' });
  });

  it('throws the database error so the screen can say it wasn’t sent', async () => {
    const error = { code: '42501', message: 'permission denied for table app_feedback' };
    await expect(createAppFeedbackSender(client(error).client, 'web')('Hi')).rejects.toBe(error);
  });

  it('sends nothing for a blank note', async () => {
    const c = client();
    await createAppFeedbackSender(c.client, 'web')('   ');
    expect(c.insert).not.toHaveBeenCalled();
  });

  it('local mode (no client) only logs it', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createAppFeedbackSender(null, 'web')(' Hi ');
    expect(log).toHaveBeenCalledWith('[feedback]', 'Hi');
    log.mockRestore();
  });

  it('caps the note and drops an unknown platform', () => {
    expect(appFeedbackRow('x'.repeat(1200), null, 'windows')).toEqual({ note: 'x'.repeat(1000), language: null, platform: null });
    expect(appFeedbackRow(' ', 'en', 'web')).toBeNull();
  });
});
