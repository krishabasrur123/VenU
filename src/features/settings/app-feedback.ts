// Profile → Help & feedback's box: saved to public.app_feedback
// (supabase/migrations/20261118010000_reports_feedback.sql), write-only; staff read it in the
// Supabase dashboard. Local mode has no server, so the note only goes to the console there.
// e.g. sendAppFeedback(' The map was hard to read ', 'es') → { note: 'The map was hard to read', language: 'es', platform: 'web' }
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** app_feedback.note's limit (the box's maxLength). */
export const APP_FEEDBACK_MAX = 1000;

export interface AppFeedbackRow {
  note: string;
  language: string | null;
  platform: 'ios' | 'android' | 'web' | null;
}

export type SendAppFeedback = (note: string, language?: string | null) => Promise<void>;

/** The row for `note`; null when there's nothing to send. */
export function appFeedbackRow(note: string, language: string | null = null, platform: string = Platform.OS): AppFeedbackRow | null {
  const text = note.trim().slice(0, APP_FEEDBACK_MAX);
  if (!text) return null;
  const known = platform === 'ios' || platform === 'android' || platform === 'web' ? platform : null;
  return { note: text, language: language || null, platform: known };
}

/** Sends through `client` (the app's Supabase, real or the mock server); with none, logs it. */
export function createAppFeedbackSender(client: SupabaseClient | null, platform: string = Platform.OS): SendAppFeedback {
  return async (note, language = null) => {
    const row = appFeedbackRow(note, language, platform);
    if (!row) return;
    if (!client) {
      console.log('[feedback]', row.note); // local mode: nowhere to send it
      return;
    }
    // No .select(): the table is insert-only, so ask for nothing back.
    const { error } = await client.from('app_feedback').insert(row);
    if (error) throw error;
  };
}

export const sendAppFeedback: SendAppFeedback = createAppFeedbackSender(supabase);
