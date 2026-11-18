import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ChatMessage } from '@/features/volunteer/types';

import { MAX_TEXT_CHARS } from '../../../../supabase/functions/translate/core';
import { createTranslationCache } from '../cache';
import { createTranslateClient, cutToLimit, type Transport, type Translate, type Translation } from '../client';
import { chatLanguage, profileChatLanguage } from '../languages';
import { MOCK_CATALOG } from '../local';
import { createStub } from '../stub';
import { needsTranslation, shownText, viewOf } from '../use-translation';

// use-translation reads the profile, whose store uses AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const flush = () => new Promise(r => setTimeout(r, 0));
const echo: Transport = async b => ({ provider: 'stub', translations: b.texts.map(t => ({ text: `${b.target}:${t}`, detectedSource: 'en' })) });

describe('translate client', () => {
  it('sends calls from the same tick as one batch per language pair, in order', async () => {
    const transport = jest.fn(echo);
    const translate = createTranslateClient(transport);
    const results = await Promise.all([
      translate({ text: 'a', target: 'es' }),
      translate({ text: 'b', target: 'es' }),
      translate({ text: 'c', target: 'ar', source: 'en' }),
    ]);
    expect(results.map(r => r.text)).toEqual(['es:a', 'es:b', 'ar:c']);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0]![0]).toEqual({ target: 'es', texts: ['a', 'b'] });
    expect(transport.mock.calls[1]![0]).toEqual({ target: 'ar', source: 'en', texts: ['c'] });
  });

  it('splits a batch at the server limit of 16 texts', async () => {
    const transport = jest.fn(echo);
    const translate = createTranslateClient(transport);
    await Promise.all(Array.from({ length: 20 }, (_, i) => translate({ text: `m${i}`, target: 'es' })));
    expect(transport.mock.calls.map(c => c[0].texts.length)).toEqual([16, 4]);
  });

  it('sends an over-long message alone, cut to the limit and marked partial, so the rest still translate', async () => {
    const transport = jest.fn(echo);
    const translate = createTranslateClient(transport);
    const long = 'x'.repeat(MAX_TEXT_CHARS + 500);
    const [a, b, c] = await Promise.all([
      translate({ text: 'short one', target: 'es' }),
      translate({ text: long, target: 'es' }),
      translate({ text: 'short two', target: 'es' }),
    ]);
    expect(a).toEqual({ text: 'es:short one', detectedSource: 'en' });
    expect(c).toEqual({ text: 'es:short two', detectedSource: 'en' });
    expect(b!.partial).toBe(true);
    expect(b!.text).toBe(`es:${'x'.repeat(MAX_TEXT_CHARS)}`);
    const sent = transport.mock.calls.map(call => call[0].texts);
    expect(sent).toContainEqual(['short one', 'short two']);
    expect(sent).toContainEqual(['x'.repeat(MAX_TEXT_CHARS)]);
  });

  it('cuts without splitting an emoji', () => {
    const text = 'a'.repeat(9) + '😀' + 'b';
    expect(cutToLimit(text, 10)).toBe('a'.repeat(9));
    expect(cutToLimit(text, 11)).toBe('a'.repeat(9) + '😀');
    expect(cutToLimit('short', 10)).toBe('short');
  });

  it('reports which provider answered', async () => {
    const onProvider = jest.fn();
    const translate = createTranslateClient(async b => ({ provider: 'deepl', translations: b.texts.map(text => ({ text, detectedSource: 'en' })) }), { onProvider });
    await translate({ text: 'a', target: 'es' });
    expect(onProvider).toHaveBeenCalledWith('deepl');
  });

  it('rejects every call in a batch when the transport fails', async () => {
    const translate = createTranslateClient(async () => { throw new Error('offline'); });
    await expect(Promise.all([translate({ text: 'a', target: 'es' }), translate({ text: 'b', target: 'es' })])).rejects.toThrow('offline');
  });
});

describe('translation cache', () => {
  const ok = (text: string): Translation => ({ text, detectedSource: 'en' });

  it('translates a message once per target, however often it is asked', async () => {
    const translate = jest.fn(async (r: { text: string; target: string }) => ok(`${r.target}:${r.text}`));
    const cache = createTranslationCache(translate);
    cache.request('m1', { text: 'Hi', target: 'es' });
    cache.request('m1', { text: 'Hi', target: 'es' }); // while loading
    expect(cache.get('m1', 'es')).toEqual({ status: 'loading' });
    await flush();
    cache.request('m1', { text: 'Hi', target: 'es' }); // done
    expect(cache.get('m1', 'es')).toEqual({ status: 'done', result: ok('es:Hi') });
    cache.request('m1', { text: 'Hi', target: 'ar' }); // another language is its own entry
    await flush();
    cache.request('m1', { text: 'Hi', target: 'es' }); // switching back: still cached
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('never lets a slow answer for the old text replace the one for the new text', async () => {
    const answers = new Map<string, (t: Translation) => void>();
    const failures = new Map<string, (e: Error) => void>();
    const translate: Translate = r => new Promise((resolve, reject) => { answers.set(r.text, resolve); failures.set(r.text, reject); });
    const cache = createTranslationCache(translate);
    cache.request('note:r1', { text: 'Hola', target: 'en' });
    cache.request('note:r1', { text: 'Hola, estoy en la puerta 5', target: 'en' }); // edited before the first came back
    answers.get('Hola, estoy en la puerta 5')!(ok("Hi, I'm at gate 5"));
    await flush();
    answers.get('Hola')!(ok('Hi'));
    await flush();
    expect(cache.get('note:r1', 'en')).toEqual({ status: 'done', result: ok("Hi, I'm at gate 5") });

    // The other order: the old answer (or failure) lands first and is ignored; the new one still applies.
    cache.request('note:r2', { text: 'Uno', target: 'en' });
    cache.request('note:r2', { text: 'Dos', target: 'en' });
    answers.get('Uno')!(ok('One'));
    await flush();
    expect(cache.get('note:r2', 'en')).toEqual({ status: 'loading' });
    cache.request('note:r3', { text: 'Tres', target: 'en' });
    cache.request('note:r3', { text: 'Cuatro', target: 'en' });
    failures.get('Tres')!(new Error('offline'));
    await flush();
    expect(cache.get('note:r3', 'en')).toEqual({ status: 'loading' });
    answers.get('Dos')!(ok('Two'));
    answers.get('Cuatro')!(ok('Four'));
    await flush();
    expect(cache.get('note:r2', 'en')).toEqual({ status: 'done', result: ok('Two') });
    expect(cache.get('note:r3', 'en')).toEqual({ status: 'done', result: ok('Four') });
  });

  it('only notifies the listeners of the key that changed', async () => {
    const cache = createTranslationCache(async r => ok(r.text));
    const mine = jest.fn();
    const other = jest.fn();
    cache.subscribe('m1', 'es', mine);
    cache.subscribe('m2', 'es', other);
    cache.request('m1', { text: 'Hi', target: 'es' });
    await flush();
    expect(mine).toHaveBeenCalledTimes(2); // loading, done
    expect(other).not.toHaveBeenCalled();
  });

  it('drops the oldest entries past the cap, but never one a bubble is watching', async () => {
    const cache = createTranslationCache(async r => ok(r.text), { max: 2 });
    const unwatch = cache.subscribe('a', 'es', () => {});
    for (const id of ['a', 'b', 'c', 'd']) {
      cache.request(id, { text: id, target: 'es' });
      await flush();
    }
    expect(cache.get('a', 'es')?.status).toBe('done'); // oldest, but on screen
    expect(cache.get('b', 'es')).toBeUndefined();
    expect(cache.get('d', 'es')?.status).toBe('done');
    unwatch();
    cache.request('e', { text: 'e', target: 'es' });
    await flush();
    expect(cache.get('a', 'es')).toBeUndefined(); // gone once nothing watches it
  });

  describe('after a failure', () => {
    beforeEach(() => { jest.useFakeTimers({ doNotFake: ['queueMicrotask'] }); });
    afterEach(() => { jest.useRealTimers(); });
    const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

    function failing(times: number) {
      let calls = 0;
      const translate = jest.fn<Translate>(async r => {
        calls += 1;
        if (calls <= times) throw new Error('down');
        return ok(`es:${r.text}`);
      });
      let t = 0;
      const cache = createTranslationCache(translate, { retryAfterMs: 1000, maxRetryMs: 4000, now: () => t });
      return { cache, translate, advance: async (ms: number) => { t += ms; await jest.advanceTimersByTimeAsync(ms); await settle(); } };
    }

    it('re-requests a watched key once after the wait, backing off on each failure', async () => {
      const { cache, translate, advance } = failing(3);
      cache.subscribe('m1', 'es', () => {});
      cache.request('m1', { text: 'Hi', target: 'es' });
      await settle();
      expect(cache.get('m1', 'es')?.status).toBe('error');
      for (let i = 0; i < 10; i++) cache.request('m1', { text: 'Hi', target: 'es' }); // re-renders: no storm
      expect(translate).toHaveBeenCalledTimes(1);
      await advance(999);
      expect(translate).toHaveBeenCalledTimes(1);
      await advance(1); // 1 s after the first failure
      expect(translate).toHaveBeenCalledTimes(2);
      await advance(1999);
      expect(translate).toHaveBeenCalledTimes(2);
      await advance(1); // 2 s after the second
      expect(translate).toHaveBeenCalledTimes(3);
      await advance(4000); // 4 s after the third (capped)
      expect(translate).toHaveBeenCalledTimes(4);
      expect(cache.get('m1', 'es')).toEqual({ status: 'done', result: ok('es:Hi') });
    });

    it('waits for a bubble to ask again when nothing is watching', async () => {
      const { cache, translate, advance } = failing(1);
      cache.request('m1', { text: 'Hi', target: 'es' });
      await settle();
      await advance(5000);
      expect(translate).toHaveBeenCalledTimes(1);
      cache.request('m1', { text: 'Hi', target: 'es' }); // the chat is reopened
      await settle();
      expect(translate).toHaveBeenCalledTimes(2);
      expect(cache.get('m1', 'es')?.status).toBe('done');
    });

    it('"Try again" goes at once, and only for a failed key', async () => {
      const { cache, translate } = failing(1);
      cache.request('m1', { text: 'Hi', target: 'es' });
      await settle();
      cache.retry('m1', 'es');
      await settle();
      expect(translate).toHaveBeenCalledTimes(2);
      expect(cache.get('m1', 'es')?.status).toBe('done');
      cache.retry('m1', 'es'); // done: nothing to retry
      expect(translate).toHaveBeenCalledTimes(2);
    });
  });
});

describe('chat language', () => {
  it('takes the first spoken language, without region; sign-language-only reads English', () => {
    expect(chatLanguage(['en', 'es'])).toBe('en');
    expect(chatLanguage(['ase', 'es'])).toBe('es');
    expect(chatLanguage(['pt-BR'])).toBe('pt');
    expect(chatLanguage(['ase'])).toBe('en');
    expect(chatLanguage([])).toBe('en');
  });

  it('puts a profile’s main language first, even one the UI isn’t translated into', () => {
    expect(profileChatLanguage({ mainLanguage: 'hi', languages: ['en', 'hi'] })).toBe('hi');
    expect(profileChatLanguage({ mainLanguage: 'ase', languages: ['ase', 'fr'] })).toBe('fr');
  });
});

describe('what a bubble shows', () => {
  const incoming: ChatMessage = { id: 'm1', from: 'them', text: 'Got it, thanks!', sentAt: 0, lang: 'en' };
  const done = (result: Translation) => ({ status: 'done' as const, result });

  it('skips yours and messages already in the reader’s language', () => {
    expect(needsTranslation({ ...incoming, from: 'me' }, 'es')).toBe(false);
    expect(needsTranslation(incoming, 'en')).toBe(false);
    expect(needsTranslation({ ...incoming, lang: 'en-US' }, 'en')).toBe(false);
    expect(needsTranslation({ ...incoming, lang: undefined }, 'en')).toBe(true); // unknown: ask (detects the source)
    expect(viewOf(undefined, incoming, 'en')).toEqual({ kind: 'original' });
  });

  it('maps each state to translated, loading or a fallback', () => {
    expect(viewOf(undefined, incoming, 'es')).toEqual({ kind: 'loading' });
    expect(viewOf({ status: 'loading' }, incoming, 'es')).toEqual({ kind: 'loading' });
    expect(viewOf({ status: 'error', at: 0 }, incoming, 'es')).toEqual({ kind: 'failed' });
    expect(viewOf(done({ text: '¡Entendido!', detectedSource: 'en' }), incoming, 'es')).toEqual({ kind: 'translated', text: '¡Entendido!', source: 'en', partial: false });
    expect(viewOf(done({ text: '¡Entendido!', detectedSource: 'en', partial: true }), incoming, 'es')).toMatchObject({ kind: 'translated', partial: true });
    expect(viewOf(done({ text: incoming.text, detectedSource: 'en', refused: true }), incoming, 'es')).toEqual({ kind: 'failed' });
    expect(viewOf(done({ text: incoming.text, detectedSource: 'en', unsupported: true }), incoming, 'tl')).toEqual({ kind: 'unsupported' });
    expect(viewOf(done({ text: incoming.text, detectedSource: null, unavailable: true }), incoming, 'hi')).toEqual({ kind: 'unavailable' });
    // The provider found it was already in the reader's language.
    expect(viewOf(done({ text: 'Hola', detectedSource: 'es' }), { ...incoming, text: 'Hola', lang: undefined }, 'es')).toEqual({ kind: 'original' });
  });
});

describe('shownText', () => {
  it('shows the translation, its start with "…", or the original when switched or untranslated', () => {
    expect(shownText({ kind: 'translated', text: 'Hi', source: 'es', partial: false }, 'Hola', false)).toBe('Hi');
    expect(shownText({ kind: 'translated', text: 'Hi', source: 'es', partial: true }, 'Hola', false)).toBe('Hi…');
    expect(shownText({ kind: 'translated', text: 'Hi', source: 'es', partial: false }, 'Hola', true)).toBe('Hola');
    expect(shownText({ kind: 'loading' }, 'Hola', false)).toBe('Hola');
  });
});

describe('stub translator', () => {
  const stub = createStub(MOCK_CATALOG);
  const en = MOCK_CATALOG.en!;

  it('knows the canned volunteer lines in every locale', () => {
    for (const lang of Object.keys(MOCK_CATALOG)) {
      expect(stub.translateOne(en.reply1!, lang)).toEqual({ text: MOCK_CATALOG[lang]!.reply1, detectedSource: 'en' });
    }
  });

  it('fills in names and translates the meeting spot inside the greeting', () => {
    const greeting = en.greeting!.replace('{{name}}', 'Rosa').replace('{{volunteer}}', 'Daniel').replace('{{spot}}', en['places.entry-4']!);
    const out = stub.translateOne(greeting, 'es');
    expect(out.detectedSource).toBe('en');
    expect(out.text).toContain('Rosa');
    expect(out.text).toContain('Daniel');
    expect(out.text).toContain(MOCK_CATALOG.es!['places.entry-4']);
    expect(out.unavailable).toBeUndefined();
  });

  it('translates between any two locales and leaves same-language lines alone', () => {
    expect(stub.translateOne(MOCK_CATALOG.ko!.reply2!, 'fr').text).toBe(MOCK_CATALOG.fr!.reply2);
    expect(stub.translateOne(en.reply3!, 'en-GB')).toEqual({ text: en.reply3, detectedSource: 'en' });
  });

  it('returns anything else unchanged, marked unavailable, as it does for untranslated targets', () => {
    expect(stub.translateOne('Where is the elevator?', 'es')).toEqual({ text: 'Where is the elevator?', detectedSource: null, unavailable: true });
    expect(stub.translateOne(en.reply1!, 'hi')).toEqual({ text: en.reply1, detectedSource: 'en', unavailable: true });
  });

  it('is deterministic', async () => {
    const batch = { target: 'ar', texts: [en.reply1!, en.reply2!] };
    expect(await stub.translator.translate(batch)).toEqual(await stub.translator.translate(batch));
  });
});
