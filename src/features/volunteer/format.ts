// Times, distances and chat separators for the volunteer flow, in the current UI language.
import i18n from '@/i18n';
import { formatDate, formatNumber, formatTime } from '@/i18n/format';

/**
 * A chat bubble's time: "2:00pm" in English (as in the Figma bubbles), the language's own clock
 * elsewhere ("14:00" in Spanish, "오후 2:00" in Korean).
 */
export function formatClock(ms: number, language: string = i18n.language): string {
  const time = formatTime(ms, language);
  // Intl writes "2:00 PM" (often with a narrow no-break space); Figma's English style is "2:00pm".
  return language === 'en' ? time.replace(/[\s ]*([AP])M$/, (_, p: string) => `${p.toLowerCase()}m`) : time;
}

/** "180 ft", "0.3 mi": units stay imperial; the number and abbreviation follow the language. */
export function formatDistance(feet: number): string {
  if (feet < 1000) return i18n.t('volunteer:distance.feet', { value: formatNumber(Math.round(feet / 10) * 10) });
  const miles = formatNumber(feet / 5280, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return i18n.t('volunteer:distance.miles', { value: miles });
}

/** Messages further apart than this get a day/time line between them. */
export const SEPARATOR_GAP_MS = 10 * 60 * 1000;

/** True when `next` came more than 10 minutes after `prev`. */
export function needsSeparator(prevSentAt: number, nextSentAt: number): boolean {
  return nextSentAt - prevSentAt > SEPARATOR_GAP_MS;
}

/**
 * The chat's day/time separator: "Today 2:14pm", "Yesterday 9:05am", "Mon, Jul 14 2:14pm".
 * Hermes has no Intl.RelativeTimeFormat, so "Today" and "Yesterday" come from the string table.
 */
export function formatDayTime(ms: number, now: number = Date.now()): string {
  const startOfDay = (t: number) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / 86_400_000);
  const time = formatClock(ms);
  if (days === 0) return i18n.t('volunteer:chat.today', { time });
  if (days === 1) return i18n.t('volunteer:chat.yesterday', { time });
  return i18n.t('volunteer:chat.dayTime', { day: formatDate(ms, 'weekday'), time });
}
