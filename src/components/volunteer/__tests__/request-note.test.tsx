// A visitor's request note is translated only when it isn't already in the reader's language: the
// request's language goes along as the note's, so an English note never reaches the paid translator
// for an English-reading volunteer.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot } from 'test-renderer';

import type { Translate } from '@/features/translate/client';

import { RequestNote } from '../request-note';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Signed out: the reader's language is the UI language (English in tests).
jest.mock('@/features/profile/profile-context', () => ({ useProfile: () => ({ profile: null }) }));

const calls: { text: string; target: string; source?: string }[] = [];
jest.mock('@/features/translate/service', () => {
  const actual = jest.requireActual<typeof import('@/features/translate/service')>('@/features/translate/service');
  const { createTranslationCache } = jest.requireActual<typeof import('@/features/translate/cache')>('@/features/translate/cache');
  const translate: Translate = async req => {
    calls.push(req);
    return { text: `[${req.target}] ${req.text}`, detectedSource: req.source ?? null };
  };
  return { ...actual, translationCache: createTranslationCache(translate) };
});

const texts = (root: ReturnType<typeof createRoot>) =>
  root.container.queryAll(n => n.type === 'Text').map(n => [n.props.children].flat().join(''));

describe('RequestNote', () => {
  beforeEach(() => { calls.length = 0; });

  it('shows a note in the reader’s language as written, without asking the translator', async () => {
    const root = createRoot();
    await act(async () => { root.render(<RequestNote requestId="r-en" note="By the blue gate" lang="en" />); });
    expect(calls).toEqual([]);
    expect(texts(root).join(' ')).toContain('By the blue gate');
  });

  it('translates a note in another language, telling the translator its source', async () => {
    const root = createRoot();
    await act(async () => { root.render(<RequestNote requestId="r-es" note="Junto a la puerta azul" lang="es" />); });
    expect(calls).toEqual([{ text: 'Junto a la puerta azul', target: 'en', source: 'es' }]);
    expect(texts(root).join(' ')).toContain('[en] Junto a la puerta azul');
  });
});
