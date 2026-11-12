// Dates, times and numbers in the current UI language, through Intl.
// e.g. formatDate(new Date(2026, 9, 24)) → "10/24/2026" (en), "24/10/2026" (es), "2026/10/24" (zh), "۲۰۲۶/۱۰/۲۴" (fa)
//      formatTime(ms) → "2:00 PM" (en), "14:00" (fr);  formatNumber(1234.5) → "1,234.5" (en), "1 234,5" (fr)
// Pass `language` only in tests or to format for someone else; screens use the current language.

import i18n from './index';

type DateInput = Date | number | string;

/** Always the Gregorian calendar: event dates must match the LA28 schedule (fa would default to Persian). */
function locale(language: string): string {
  return `${language}-u-ca-gregory`;
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function safely(format: (tag: string) => string, language: string): string {
  try {
    return format(locale(language));
  } catch {
    return format('en'); // an engine without that locale still shows something sensible
  }
}

const DATE_STYLES = {
  short: { year: 'numeric', month: '2-digit', day: '2-digit' }, // 10/24/2026
  medium: { year: 'numeric', month: 'short', day: 'numeric' }, // Oct 24, 2026
  long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, // Saturday, October 24, 2026
  weekday: { weekday: 'short', month: 'short', day: 'numeric' }, // Sat, Oct 24
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatDate(value: DateInput, style: keyof typeof DATE_STYLES = 'short', language = i18n.language): string {
  return safely(tag => new Intl.DateTimeFormat(tag, DATE_STYLES[style]).format(toDate(value)), language);
}

/** Hours and minutes, in the language's usual clock: "2:00 PM", "14:00", "오후 2:00". */
export function formatTime(value: DateInput, language = i18n.language): string {
  return safely(tag => new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit' }).format(toDate(value)), language);
}

/** "Oct 24, 2026, 2:00 PM". */
export function formatDateTime(value: DateInput, language = i18n.language): string {
  return safely(
    tag => new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(toDate(value)),
    language,
  );
}

/** Grouping and decimals for the language; pass Intl options for units or fixed decimals. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions, language = i18n.language): string {
  return safely(tag => new Intl.NumberFormat(tag, options).format(value), language);
}

/** A short list in the language's style: "Opening Ceremony, Swimming" (en), "开幕式、游泳" (zh), "Ceremonia de apertura y Natación" (es). Plain ", " without Intl.ListFormat. */
export function formatList(items: string[], language = i18n.language): string {
  if (typeof Intl.ListFormat !== 'function') return items.join(', ');
  return safely(tag => new Intl.ListFormat(tag, { style: 'narrow', type: 'conjunction' }).format(items), language);
}
