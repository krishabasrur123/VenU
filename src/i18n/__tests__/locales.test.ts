// Every translation must have exactly English's keys (plural keys: the forms that language uses)
// and keep every {{placeholder}} English has, or a screen shows a raw key or loses a value.

import { describe, expect, it } from '@jest/globals';

import { LANGUAGES } from '@/features/profile/options';

import { TRANSLATED, UI_LANGUAGES, type UiLanguage } from '../languages';
import { NAMESPACES, resources, type Namespace } from '../locales';

const PLURAL = /_(zero|one|two|few|many|other)$/;

type Table = { [key: string]: string | Table };

function flatten(table: Table, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(table)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

function read(lng: UiLanguage, ns: Namespace): Record<string, string> {
  return flatten(resources[lng][ns] as Table);
}

/** "{{count}} of {{ total, number }}" → ['count', 'total'] */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{\{-?\s*([\w.]+)[^}]*\}\}/g)].map(m => m[1]).sort();
}

/** English keys with plurals expanded to the forms `lng` needs, e.g. ru: people_one/_few/_many/_other. */
function expectedKeys(english: Record<string, string>, lng: string): string[] {
  const forms = new Intl.PluralRules(lng).resolvedOptions().pluralCategories;
  const keys = new Set<string>();
  for (const key of Object.keys(english)) {
    if (PLURAL.test(key)) forms.forEach(f => keys.add(key.replace(PLURAL, `_${f}`)));
    else keys.add(key);
  }
  return [...keys].sort();
}

describe('locale files', () => {
  it('bundles every language and namespace', () => {
    expect(Object.keys(resources).sort()).toEqual([...TRANSLATED].sort());
    for (const lng of TRANSLATED) expect(Object.keys(resources[lng]).sort()).toEqual([...NAMESPACES].sort());
  });

  it('offers only languages listed in LANGUAGES', () => {
    expect(UI_LANGUAGES.map(l => l.code).sort()).toEqual([...TRANSLATED].sort());
    expect(TRANSLATED.every(code => LANGUAGES.some(l => l.code === code))).toBe(true);
  });

  for (const lng of TRANSLATED.filter(l => l !== 'en')) {
    for (const ns of NAMESPACES) {
      it(`${lng}/${ns}.json matches English`, () => {
        const english = read('en', ns);
        const table = read(lng, ns);
        expect(Object.keys(table).sort()).toEqual(expectedKeys(english, lng));

        for (const [key, text] of Object.entries(table)) {
          expect({ key, empty: !text.trim() }).toEqual({ key, empty: false });
          const source = english[key] ?? english[key.replace(PLURAL, '_other')];
          // Plural forms may spell the number out ("شخصان" = two people), so {{count}} is optional there.
          const needed = placeholders(source).filter(p => !(PLURAL.test(key) && p === 'count'));
          const have = placeholders(text);
          for (const p of needed) expect({ key, placeholder: p, present: have.includes(p) }).toEqual({ key, placeholder: p, present: true });
          for (const p of have) expect({ key, placeholder: p, inEnglish: placeholders(source).includes(p) }).toEqual({ key, placeholder: p, inEnglish: true });
        }
      });
    }
  }
});
