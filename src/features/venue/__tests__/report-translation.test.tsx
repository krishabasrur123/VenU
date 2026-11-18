// A report's title and body are two cache entries but one translator call: they go out in the same
// batch (and a whole list of cards in one), and switch to the original together.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, useEffect } from 'react';
import { Text } from 'react-native';
import { createRoot } from 'test-renderer';

import type { TranslateBatch } from '../../../../supabase/functions/translate/core';
import { useReportTranslation, type ReportTranslation } from '../report-translation';
import type { FacilityReport } from '../reports';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Signed out: the reader's language is the UI language (English in tests).
jest.mock('@/features/profile/profile-context', () => ({ useProfile: () => ({ profile: null }) }));

const batches: TranslateBatch[] = [];
jest.mock('@/features/translate/service', () => {
  const actual = jest.requireActual<typeof import('@/features/translate/service')>('@/features/translate/service');
  const { createTranslationCache } = jest.requireActual<typeof import('@/features/translate/cache')>('@/features/translate/cache');
  const { createTranslateClient } = jest.requireActual<typeof import('@/features/translate/client')>('@/features/translate/client');
  const translate = createTranslateClient(async batch => {
    batches.push(batch);
    return { provider: 'anthropic', translations: batch.texts.map(t => ({ text: `EN ${t}`, detectedSource: 'es' })) };
  });
  return { ...actual, translationCache: createTranslationCache(translate) };
});

const report = (id: string): FacilityReport => ({
  id, venueId: 'sofi', facilityId: 'entry-4', topic: 'accessibility', title: `Rampa ${id}`, body: `Cuerpo ${id}`,
  authorName: 'Ana', createdAt: '2026-11-18T01:00:00.000Z', language: 'es',
});

const seen: Record<string, ReportTranslation> = {};
const remember = (id: string, tr: ReportTranslation) => { seen[id] = tr; };
function Card({ r }: { r: FacilityReport }) {
  const tr = useReportTranslation(r);
  useEffect(() => remember(r.id, tr));
  return <Text>{tr.title}</Text>;
}

describe('report translation', () => {
  beforeEach(() => { batches.length = 0; });

  it('asks once for a whole list of cards, title and body together', async () => {
    const root = createRoot();
    await act(async () => { root.render(<>{['a', 'b', 'c'].map(id => <Card key={id} r={report(id)} />)}</>); });
    expect(batches).toEqual([{ target: 'en', source: 'es', texts: ['Rampa a', 'Cuerpo a', 'Rampa b', 'Cuerpo b', 'Rampa c', 'Cuerpo c'] }]);
    expect([seen.a!.title, seen.a!.body, seen.a!.view.kind]).toEqual(['EN Rampa a', 'EN Cuerpo a', 'translated']);
  });

  it('switches title and body to the original together', async () => {
    const root = createRoot();
    await act(async () => { root.render(<Card r={report('d')} />); });
    await act(async () => { seen.d!.toggle(); });
    expect([seen.d!.title, seen.d!.body, seen.d!.original]).toEqual(['Rampa d', 'Cuerpo d', true]);
    await act(async () => { seen.d!.toggle(); });
    expect([seen.d!.title, seen.d!.body]).toEqual(['EN Rampa d', 'EN Cuerpo d']);
  });
});
