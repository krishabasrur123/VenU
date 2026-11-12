import type {
  AccessNeed,
  AgeBand,
  CommunicationMethod,
  Gender,
  HelperAgePref,
  HelperGenderPref,
  Training,
} from './types';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export interface Language {
  code: string;
  /** Name in the language itself, so people who don't read English can find theirs. */
  native: string;
  english: string;
}

// LA County's most-spoken languages first, then other common LA28 visitor languages.
export const LANGUAGES: Language[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'zh', native: '中文', english: 'Chinese' },
  { code: 'ko', native: '한국어', english: 'Korean' },
  { code: 'tl', native: 'Tagalog', english: 'Tagalog' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'hy', native: 'Հայերեն', english: 'Armenian' },
  { code: 'fa', native: 'فارسی', english: 'Persian' },
  { code: 'ja', native: '日本語', english: 'Japanese' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'ar', native: 'العربية', english: 'Arabic' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'de', native: 'Deutsch', english: 'German' },
  { code: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'th', native: 'ไทย', english: 'Thai' },
  { code: 'km', native: 'ខ្មែរ', english: 'Khmer' },
  { code: 'he', native: 'עברית', english: 'Hebrew' },
  { code: 'ase', native: 'ASL', english: 'American Sign Language' },
];

const BY_CODE = new Map(LANGUAGES.map(l => [l.code, l]));

/** True for codes in LANGUAGES; anything else (e.g. from a hand-edited URL) shouldn't be saved. */
export function isKnownLanguage(code: string | undefined | null): code is string {
  return !!code && BY_CODE.has(code);
}

export function languageName(code: string): string {
  return BY_CODE.get(code)?.native ?? code;
}

/**
 * The native name wrapped in Unicode isolate marks (FSI…PDI), for mixing into a longer label.
 * Without it, an RTL name flips the whole string: "فارسی · main" renders as "main · فارسی".
 */
export function isolatedLanguageName(code: string): string {
  return `\u2068${languageName(code)}\u2069`;
}

export function englishLanguageName(code: string): string {
  return BY_CODE.get(code)?.english ?? code;
}

/** Case- and accent-insensitive match on native name, English name or code. */
export function searchLanguages(query: string): Language[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(query.trim());
  if (!q) return LANGUAGES;
  return LANGUAGES.filter(l => [l.native, l.english, l.code].some(s => fold(s).includes(q)));
}

/**
 * Option groups; each label is profile:options.<group>.<value>, e.g. options.accessNeeds.wheelchair.
 * The stored value never changes; only the label follows the UI language.
 */
type OptionGroup = 'accessNeeds' | 'communication' | 'helperGender' | 'helperAge' | 'training' | 'gender' | 'ageBand';

/**
 * The label in the current UI language, read each time (a getter), so a screen that re-renders on a
 * language change shows the new label. i18n is required lazily: src/i18n imports LANGUAGES from here,
 * so a top-level import would be circular.
 */
function translated(group: OptionGroup, value: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const i18n = (require('@/i18n') as typeof import('@/i18n')).default;
  return (i18n.t as (key: string) => string)(`profile:options.${group}.${value}`);
}

function options<T extends string>(group: OptionGroup, values: T[]): Option<T>[] {
  return values.map(value => ({
    value,
    get label() {
      return translated(group, value);
    },
  }));
}

export const ACCESS_NEEDS = options<AccessNeed>('accessNeeds', ['wheelchair', 'hard_of_hearing', 'low_vision', 'walking_aid', 'other']);

export const COMMUNICATION = options<CommunicationMethod>('communication', ['speaking', 'text', 'sign_language']);

// Figma's wording and order ("No preference / Male / Female"); stored values stay 'man' / 'woman'.
export const HELPER_GENDER = options<HelperGenderPref>('helperGender', ['none', 'man', 'woman']);

export const HELPER_AGE = options<HelperAgePref>('helperAge', ['any', 'under_40', '40_plus']);

export const TRAININGS = options<Training>('training', ['wheelchair', 'asl', 'first_aid', 'sighted_guide', 'mental_health']);

export const GENDERS = options<Gender>('gender', ['woman', 'man', 'nonbinary', 'prefer_not']);

export const AGE_BANDS = options<AgeBand>('ageBand', ['under_40', '40_plus', 'prefer_not']);

/** The option's label in the current UI language, e.g. labelFor(ACCESS_NEEDS, 'wheelchair') → "Wheelchair user". */
export function labelFor<T extends string>(options: Option<T>[], value: T): string {
  return options.find(o => o.value === value)?.label ?? value;
}
