// Facility reports in the database: the live store over an in-memory stand-in for
// public.facility_reports (its RLS: everyone reads, authors insert and delete their own; author_id
// isn't readable, facility_report_cards says `mine`), and the Supabase calls supabaseReportDb makes.
import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isUuid, rowToReport, supabaseReportDb, type NewReportRow, type ReportDb, type ReportRow } from '../report-db';
import { createLiveReportStore, ReportValidationError, SEED_REPORTS, type ReportDraft } from '../reports';

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const NAMES: Record<string, string> = { rosa: 'Rosa', lee: 'Lee' };
const good: ReportDraft = { title: '  Elevator out at Gate 2 ', topic: 'accessibility', body: ' Use the ramp instead. ' };

type StoredRow = Omit<ReportRow, 'mine'> & { author_id: string };

/** The table and its rules, shared by every user's connection. */
function fakeTable() {
  const rows: StoredRow[] = [];
  let n = 0;
  let clock = Date.parse('2026-11-18T01:00:00Z');
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  /** facility_report_cards: no author_id, plus mine. */
  const card = ({ author_id, ...row }: StoredRow, who: string | null): ReportRow => ({ ...row, mine: author_id === who });
  function dbFor(who: string | null): ReportDb {
    return {
      list: async (venueId, facilityId) => {
        if (!who) throw new Error('permission denied for table facility_reports');
        return rows
          .filter(r => r.venue_id === venueId && r.facility_id === facilityId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map(r => card(r, who));
      },
      get: async id => {
        const row = rows.find(r => r.id === id);
        return row ? card(row, who) : null;
      },
      async insert(row: NewReportRow) {
        if (!who) throw new Error('permission denied for table facility_reports');
        // Postgres' timestamptz text, not JS ISO: rowToReport has to normalise it.
        const created_at = new Date((clock += 60_000)).toISOString().replace('Z', '+00:00');
        const full: StoredRow = { ...row, id: uuid(), author_id: who, author_name: NAMES[who] ?? '', created_at };
        rows.push(full);
        return card(full, who);
      },
      async remove(id) {
        const i = rows.findIndex(r => r.id === id && r.author_id === who);
        if (i >= 0) rows.splice(i, 1);
      },
    };
  }
  return { rows, dbFor };
}

describe('live report store (supabase and mock modes)', () => {
  it('saves a trimmed report with the author’s first name from the server, and others see it', async () => {
    const table = fakeTable();
    const rosa = createLiveReportStore(table.dbFor('rosa'), SEED_REPORTS);
    // The app's guess at a name isn't sent: the database takes it from the profile.
    const saved = await rosa.add({ venueId: 'sofi', facilityId: 'entry-4', authorName: 'Someone Else', language: 'es', draft: good });
    expect(table.rows).toEqual([expect.objectContaining({
      venue_id: 'sofi', facility_id: 'entry-4', title: 'Elevator out at Gate 2', topic: 'accessibility', body: 'Use the ramp instead.', language: 'es', author_id: 'rosa',
    })]);
    expect(saved).toMatchObject({ authorName: 'Rosa', language: 'es', mine: true, createdAt: '2026-11-18T01:01:00.000Z' });

    // Another account: the report is there, above the older sample one, and isn't theirs.
    const lee = createLiveReportStore(table.dbFor('lee'), SEED_REPORTS);
    const list = await lee.list('sofi', 'entry-4');
    expect(list.map(r => r.id)).toEqual([saved.id, 'seed-bags']);
    expect(list[0]!.mine).toBeUndefined();
    expect(await lee.get(saved.id)).toMatchObject({ title: 'Elevator out at Gate 2', authorName: 'Rosa' });
  });

  it('keeps the sample reports, read-only and without asking the database for them', async () => {
    const table = fakeTable();
    const db = table.dbFor('rosa');
    const get = jest.spyOn(db, 'get');
    const store = createLiveReportStore(db, SEED_REPORTS);
    expect(await store.get('seed-ramp')).toMatchObject({ authorName: 'Rosa W.' });
    // A hand-typed id that isn't a uuid would be "invalid input syntax for type uuid" on Postgres.
    expect(await store.get('nope')).toBeNull();
    expect(get).not.toHaveBeenCalled();
    await store.remove!('seed-ramp');
    expect(await store.get('seed-ramp')).not.toBeNull();
  });

  it('rejects an incomplete draft before reaching the database', async () => {
    const table = fakeTable();
    const store = createLiveReportStore(table.dbFor('rosa'));
    await expect(store.add({ venueId: 'sofi', facilityId: 'entry-4', authorName: '', draft: { title: '', topic: null, body: '' } }))
      .rejects.toBeInstanceOf(ReportValidationError);
    expect(table.rows).toEqual([]);
  });

  it('only the author deletes a report', async () => {
    const table = fakeTable();
    const rosa = createLiveReportStore(table.dbFor('rosa'));
    const lee = createLiveReportStore(table.dbFor('lee'));
    const saved = await rosa.add({ venueId: 'sofi', facilityId: 'entry-4', authorName: '', draft: good });
    await lee.remove!(saved.id);
    expect(await rosa.list('sofi', 'entry-4')).toHaveLength(1);
    await rosa.remove!(saved.id);
    expect(await lee.list('sofi', 'entry-4')).toEqual([]);
  });

  it('passes a save error through (the screen shows its own message)', async () => {
    const store = createLiveReportStore(fakeTable().dbFor(null), SEED_REPORTS);
    await expect(store.add({ venueId: 'sofi', facilityId: 'entry-4', authorName: '', draft: good })).rejects.toThrow('permission denied');
  });

  it('still lists the sample reports when the database can’t be reached', async () => {
    const db = fakeTable().dbFor('rosa');
    jest.spyOn(db, 'list').mockRejectedValue(new TypeError('Failed to fetch'));
    const store = createLiveReportStore(db, SEED_REPORTS);
    expect((await store.list('sofi', 'entry-4')).map(r => r.id)).toEqual(['seed-bags']);
    expect(await createLiveReportStore(fakeTable().dbFor(null), SEED_REPORTS).list('sofi', 'pedestrian-ramp')).toEqual([expect.objectContaining({ id: 'seed-ramp' })]);
  });
});

describe('rowToReport', () => {
  const row: ReportRow = {
    id: '00000000-0000-4000-8000-000000000001', venue_id: 'sofi', facility_id: 'entry-4', mine: true, author_name: '',
    title: 'Ramp', topic: 'accessibility', body: '', language: null, created_at: '2026-11-18T01:00:00.123456+00:00',
  };

  it('normalises the time, leaves an empty name for the screen to word, and marks only your own', () => {
    expect(rowToReport(row)).toEqual({
      id: row.id, venueId: 'sofi', facilityId: 'entry-4', title: 'Ramp', topic: 'accessibility', body: '', authorName: '',
      createdAt: '2026-11-18T01:00:00.123Z', mine: true,
    });
    expect(rowToReport({ ...row, mine: false }).mine).toBeUndefined();
    expect(rowToReport({ ...row, language: 'es' }).language).toBe('es');
  });

  it('isUuid tells row ids from sample ids', () => {
    expect(isUuid(row.id)).toBe(true);
    expect(isUuid('seed-ramp')).toBe(false);
  });
});

describe('supabaseReportDb', () => {
  /** A stand-in Supabase client that records the query chain and answers with `result`. */
  function client(result: { data?: unknown; error?: unknown } = {}) {
    const calls: unknown[][] = [];
    const answer = { data: result.data ?? null, error: result.error ?? null };
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'insert', 'delete']) {
      chain[name] = (...args: unknown[]) => { calls.push([name, ...args]); return chain; };
    }
    chain.maybeSingle = async () => { calls.push(['maybeSingle']); return answer; };
    chain.single = async () => { calls.push(['single']); return answer; };
    chain.then = (resolve: (v: unknown) => void) => resolve(answer);
    const fake = { from: (table: string) => { calls.push(['from', table]); return chain; } };
    return { calls, db: supabaseReportDb(fake as unknown as SupabaseClient) };
  }

  const COLUMNS = 'id,venue_id,facility_id,author_name,title,topic,body,language,created_at';

  it('lists one facility newest first, from the cards (mine from the server)', async () => {
    const { calls, db } = client({ data: [] });
    expect(await db.list('sofi', 'entry-4')).toEqual([]);
    expect(calls).toEqual([['from', 'facility_report_cards'], ['select', `${COLUMNS},mine`], ['eq', 'venue_id', 'sofi'], ['eq', 'facility_id', 'entry-4'], ['order', 'created_at', { ascending: false }]]);
  });

  it('inserts only the granted columns and reads the saved row back as yours', async () => {
    const { calls, db } = client({ data: { id: 'x' } });
    const row: NewReportRow = { venue_id: 'sofi', facility_id: 'entry-4', title: 'Ramp', topic: 'accessibility', body: '', language: 'en' };
    expect(await db.insert(row)).toEqual({ id: 'x', mine: true });
    expect(calls).toEqual([['from', 'facility_reports'], ['insert', row], ['select', COLUMNS], ['single']]);
  });

  it('deletes by id and gets one card', async () => {
    const { calls, db } = client();
    await db.remove('abc');
    expect(await db.get('abc')).toBeNull();
    expect(calls).toEqual([['from', 'facility_reports'], ['delete'], ['eq', 'id', 'abc'], ['from', 'facility_report_cards'], ['select', `${COLUMNS},mine`], ['eq', 'id', 'abc'], ['maybeSingle']]);
  });

  it('never asks for author_id (nobody may read who wrote a report)', async () => {
    const { calls, db } = client({ data: [] });
    await db.list('sofi', 'entry-4');
    await db.get('abc');
    await db.insert({ venue_id: 'sofi', facility_id: 'entry-4', title: 'Ramp', topic: 'accessibility', body: '', language: null });
    const selected = calls.filter(c => c[0] === 'select').flatMap(c => String(c[1]).split(','));
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.filter(col => col === '*' || col === 'author_id')).toEqual([]);
  });

  it('throws the database error', async () => {
    const error = { code: '42501', message: 'new row violates row-level security policy' };
    await expect(client({ error }).db.list('sofi', 'entry-4')).rejects.toBe(error);
    await expect(client({ error }).db.remove('abc')).rejects.toBe(error);
  });
});
