// Which alerts someone wants, kept on their profile (profiles.notification_prefs) until push
// notifications exist. e.g. { volunteer: true, chat: true, venue: false, reports: true } = everything
// but venue alerts. The profile provider saves a change at once and retries it offline.

export type NotificationKind = 'volunteer' | 'chat' | 'venue' | 'reports';
export type NotificationPrefs = Record<NotificationKind, boolean>;

/** In screen order. Label and hint: profile:notifications.options.<kind>.label / .hint. */
export const NOTIFICATION_OPTIONS: { kind: NotificationKind }[] = [
  { kind: 'volunteer' },
  { kind: 'chat' },
  { kind: 'venue' },
  { kind: 'reports' },
];

export const DEFAULT_PREFS: NotificationPrefs = { volunteer: true, chat: true, venue: true, reports: true };

/**
 * Stored choices over the defaults; a missing or broken entry gives the default.
 * e.g. parseNotificationPrefs({ chat: 'no', reports: false, extra: true }) → everything on but reports
 */
export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Partial<Record<string, unknown>>) : {};
  const prefs = { ...DEFAULT_PREFS };
  for (const { kind } of NOTIFICATION_OPTIONS) if (typeof saved[kind] === 'boolean') prefs[kind] = saved[kind];
  return prefs;
}
