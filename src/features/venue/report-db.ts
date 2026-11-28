// Facility reports in the database: public.facility_reports
// (supabase/migrations/20261118010000_reports_feedback.sql), read through public.facility_report_cards,
// which leaves out author_id (nobody reads who wrote what) and says `mine` for your own
// (20261118050000_review_fixes.sql). The same calls reach the real project
// (supabase mode) and the local mock server (mock mode); reports.ts picks this or device storage.
// The calls sit behind `ReportDb`, so tests drive the store with an in-memory fake:
//   supabaseReportDb(supabase)    the app
//   createLiveReportStore(fake)   tests (reports.ts)
import type { SupabaseClient } from '@supabase/supabase-js';

import type { FacilityReport, ReportTopic } from './reports';

/** A facility_report_cards row, as PostgREST returns it. */
export interface ReportRow {
  id: string;
  venue_id: string;
  facility_id: string;
  /** The signed-in user wrote it (worked out by the database; author ids aren't readable). */
  mine: boolean;
  /** The author's first name, copied from their profile by the database when they posted ('' for none). */
  author_name: string;
  title: string;
  topic: ReportTopic;
  body: string;
  language: string | null;
  created_at: string;
}

/** What the app inserts; the database fills in the id, author and time. */
export type NewReportRow = Pick<ReportRow, 'venue_id' | 'facility_id' | 'title' | 'topic' | 'body' | 'language'>;

/** The columns signed-in users may read: facility_reports' minus author_id. */
const COLUMNS = 'id,venue_id,facility_id,author_name,title,topic,body,language,created_at';

export interface ReportDb {
  /** One facility's reports, newest first. */
  list(venueId: string, facilityId: string): Promise<ReportRow[]>;
  get(id: string): Promise<ReportRow | null>;
  /** Inserts and returns the saved row (yours, so mine: true). */
  insert(row: NewReportRow): Promise<ReportRow>;
  /** Deletes the report if it's yours (RLS); someone else's is left alone without an error. */
  remove(id: string): Promise<void>;
}

/** e.g. 'seed-ramp' isn't a row id; asking the database for it would fail with "invalid uuid". */
export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * The report as the screens show it. `mine` marks the signed-in user's own (they may delete it).
 * e.g. { author_name: 'Rosa', created_at: '2026-11-18T01:00:00.123+00:00' } → authorName 'Rosa', createdAt '2026-11-18T01:00:00.123Z'.
 */
export function rowToReport(row: ReportRow): FacilityReport {
  return {
    id: row.id,
    venueId: row.venue_id,
    facilityId: row.facility_id,
    title: row.title,
    topic: row.topic,
    body: row.body ?? '',
    authorName: row.author_name ?? '',
    // The same ISO form as device reports, so the two sort together by string.
    createdAt: new Date(row.created_at).toISOString(),
    ...(row.language ? { language: row.language } : {}),
    ...(row.mine === true ? { mine: true } : {}),
  };
}

export function supabaseReportDb(client: SupabaseClient): ReportDb {
  const fail = (error: unknown): never => { throw error; };
  return {
    async list(venueId, facilityId) {
      const { data, error } = await client
        .from('facility_report_cards')
        .select(`${COLUMNS},mine`)
        .eq('venue_id', venueId)
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });
      if (error) fail(error);
      return (data as ReportRow[] | null) ?? [];
    },
    async get(id) {
      const { data, error } = await client.from('facility_report_cards').select(`${COLUMNS},mine`).eq('id', id).maybeSingle();
      if (error) fail(error);
      return (data as ReportRow | null) ?? null;
    },
    async insert(row) {
      // Read back without author_id (select * would be refused); it's the caller's own.
      const { data, error } = await client.from('facility_reports').insert(row).select(COLUMNS).single();
      if (error) fail(error);
      return { ...(data as Omit<ReportRow, 'mine'>), mine: true };
    },
    async remove(id) {
      const { error } = await client.from('facility_reports').delete().eq('id', id);
      if (error) fail(error);
    },
  };
}
