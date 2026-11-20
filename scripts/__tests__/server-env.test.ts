/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { parseEnvText, pickTranslateEnv } from '../server-env.ts';

describe('parseEnvText', () => {
  it('reads KEY=value lines, strips quotes, skips comments and blanks', () => {
    const text = [
      '# Copy to .env.local',
      '',
      'EXPO_PUBLIC_SUPABASE_URL=https://x.supabase.co',
      'TRANSLATE_PROVIDER = "anthropic"  ',
      "export ANTHROPIC_API_KEY='sk-ant-test'",
      'not a line',
    ].join('\r\n');
    expect(parseEnvText(text)).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      TRANSLATE_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    });
  });
});

describe('pickTranslateEnv', () => {
  it('keeps only the translate keys, never EXPO_PUBLIC_* or anything else', () => {
    const out = pickTranslateEnv([{
      name: '.env.local',
      vars: { EXPO_PUBLIC_SUPABASE_URL: 'u', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k', SUPABASE_SERVICE_ROLE_KEY: 's', TRANSLATE_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk' },
    }]);
    expect(out).toEqual({ env: { TRANSLATE_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk' }, from: '.env.local' });
  });

  it('lets an earlier file win per key (.env.server.local over .env.local)', () => {
    const out = pickTranslateEnv([
      { name: '.env.server.local', vars: { TRANSLATE_PROVIDER: 'deepl', DEEPL_API_KEY: 'd:fx' } },
      { name: '.env.local', vars: { TRANSLATE_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk' } },
    ]);
    expect(out).toEqual({ env: { TRANSLATE_PROVIDER: 'deepl', ANTHROPIC_API_KEY: 'sk', DEEPL_API_KEY: 'd:fx' }, from: '.env.server.local' });
  });

  it('treats empty values as unset and reports no source without a provider', () => {
    expect(pickTranslateEnv([
      { name: '.env.server.local', vars: { TRANSLATE_PROVIDER: '  ' } },
      { name: '.env.local', vars: { ANTHROPIC_API_KEY: 'sk' } },
    ])).toEqual({ env: { ANTHROPIC_API_KEY: 'sk' }, from: null });
    expect(pickTranslateEnv([])).toEqual({ env: {}, from: null });
  });
});
