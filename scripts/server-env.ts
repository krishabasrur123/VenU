// Which translate keys the mock backend (scripts/mock-supabase.mjs) runs with. Server side only:
// it keeps the three translate keys and drops everything else, so EXPO_PUBLIC_* and other values in
// .env.local never reach the app bundle through here. Plain TypeScript with erasable types and no
// imports, so Node's type stripping loads it as is.
//
//   .env.server.local  TRANSLATE_PROVIDER=deepl            ┐ per key, the first file that sets it wins
//   .env.local         TRANSLATE_PROVIDER=anthropic + key  ┘ → { TRANSLATE_PROVIDER: 'deepl', ANTHROPIC_API_KEY: … }

export const TRANSLATE_KEYS = ['TRANSLATE_PROVIDER', 'ANTHROPIC_API_KEY', 'DEEPL_API_KEY'] as const;
export type TranslateKey = (typeof TRANSLATE_KEYS)[number];
export type TranslateEnv = Partial<Record<TranslateKey, string>>;

/** KEY=value lines; `#` comments, blank lines and `export ` prefixes are ignored, matching quotes stripped. */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export interface EnvSource {
  /** Shown in the log, e.g. '.env.local'. Never the values. */
  name: string;
  vars: Record<string, string>;
}

export interface TranslateEnvChoice {
  env: TranslateEnv;
  /** Where TRANSLATE_PROVIDER came from, or null when no source sets it. */
  from: string | null;
}

/**
 * The translate keys from `sources`, earlier sources first. Empty values count as unset.
 *   pickTranslateEnv([{ name: '.env.local', vars: { EXPO_PUBLIC_SUPABASE_URL: 'x', TRANSLATE_PROVIDER: 'anthropic' } }])
 *   → { env: { TRANSLATE_PROVIDER: 'anthropic' }, from: '.env.local' }
 */
export function pickTranslateEnv(sources: EnvSource[]): TranslateEnvChoice {
  const env: TranslateEnv = {};
  let from: string | null = null;
  for (const key of TRANSLATE_KEYS) {
    for (const source of sources) {
      const value = source.vars[key]?.trim();
      if (!value) continue;
      env[key] = value;
      if (key === 'TRANSLATE_PROVIDER') from = source.name;
      break;
    }
  }
  return { env, from };
}
