// Translations kept across reloads (visitor F5): a message already read keeps its wording after a
// reload and costs no second translation.
import { describe, expect, it, jest } from '@jest/globals';

import { createTranslationCache, type StoredTranslation, type TranslationStorage } from '../cache';
import type { Translate, Translation } from '../client';

const flush = () => new Promise(r => setTimeout(r, 0));

/** A device's storage: one saved blob, like AsyncStorage under one key. */
function memoryStorage(initial: Record<string, StoredTranslation> | null = null) {
  let blob = initial ? JSON.stringify(initial) : null;
  const storage: TranslationStorage = {
    load: jest.fn(async () => (blob ? (JSON.parse(blob) as Record<string, StoredTranslation>) : null)),
    save: jest.fn(async (entries: Record<string, StoredTranslation>) => { blob = JSON.stringify(entries); }),
  };
  return { storage, saved: () => (blob ? (JSON.parse(blob) as Record<string, StoredTranslation>) : {}) };
}

/** A translator whose wording changes on every call, like a model asked twice. */
function varyingTranslator() {
  let n = 0;
  return jest.fn<Translate>(async r => ({ text: `${r.text} (take ${++n})`, detectedSource: 'en' }));
}

const doneText = (cache: ReturnType<typeof createTranslationCache>, id: string, target = 'es') => {
  const e = cache.get(id, target);
  return e?.status === 'done' ? e.result.text : e?.status;
};

describe('translation cache across reloads', () => {
  it('shows the same wording after a reload, without a second call', async () => {
    const { storage } = memoryStorage();
    const first = varyingTranslator();
    const before = createTranslationCache(first, { saveDelayMs: 0 });
    await before.attach(storage);
    before.request('m1', { text: 'Hi Lucia!', target: 'es' });
    await flush();
    await flush(); // the save
    expect(doneText(before, 'm1')).toBe('Hi Lucia! (take 1)');

    // Reload: a new cache (new page) on the same storage.
    const second = varyingTranslator();
    const after = createTranslationCache(second, { saveDelayMs: 0 });
    await after.attach(storage);
    after.request('m1', { text: 'Hi Lucia!', target: 'es' });
    await flush();
    expect(doneText(after, 'm1')).toBe('Hi Lucia! (take 1)');
    expect(second).not.toHaveBeenCalled();
  });

  it('waits for storage that is still loading instead of paying for a translation it has', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const saved = { 'm1\u0000es': { text: 'Hi', result: { text: 'Hola', detectedSource: 'en' }, at: 1 } };
    const storage: TranslationStorage = { load: async () => { await gate; return saved; }, save: () => {} };
    const translate = varyingTranslator();
    const cache = createTranslationCache(translate);
    const attached = cache.attach(storage);
    cache.request('m1', { text: 'Hi', target: 'es' }); // the chat opens before storage is read
    cache.request('m2', { text: 'Bye', target: 'es' });
    expect(cache.get('m1', 'es')?.status).toBe('loading');
    release();
    await attached;
    await flush();
    expect(doneText(cache, 'm1')).toBe('Hola');
    expect(doneText(cache, 'm2')).toBe('Bye (take 1)');
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it('translates again when the text under an id changed', async () => {
    const { storage } = memoryStorage({ 'note:r1\u0000en': { text: 'Hola', result: { text: 'Hello', detectedSource: 'es' }, at: 1 } });
    const translate = varyingTranslator();
    const cache = createTranslationCache(translate);
    await cache.attach(storage);
    cache.request('note:r1', { text: 'Hola, estoy en la puerta 5', target: 'en' });
    await flush();
    expect(doneText(cache, 'note:r1', 'en')).toBe('Hola, estoy en la puerta 5 (take 1)');
    // And in memory too: a changed text under a cached id isn't served the old translation.
    cache.request('note:r1', { text: 'Adiós', target: 'en' });
    await flush();
    expect(doneText(cache, 'note:r1', 'en')).toBe('Adiós (take 2)');
  });

  it('keeps only real translations, not "not set up", "unsupported" or refusals', async () => {
    const { storage, saved } = memoryStorage();
    const replies: Record<string, Translation> = {
      a: { text: 'A!', detectedSource: 'en' },
      b: { text: 'b', detectedSource: null, unavailable: true },
      c: { text: 'c', detectedSource: 'en', unsupported: true },
      d: { text: 'd', detectedSource: 'en', refused: true },
    };
    const cache = createTranslationCache(async r => replies[r.text]!, { saveDelayMs: 0 });
    await cache.attach(storage);
    for (const id of Object.keys(replies)) cache.request(id, { text: id, target: 'es' });
    await flush();
    await flush();
    expect(Object.keys(saved())).toEqual(['a\u0000es']);
  });

  it('saves only the newest translations past the limit', async () => {
    const { storage, saved } = memoryStorage();
    let t = 0;
    const cache = createTranslationCache(async r => ({ text: r.text.toUpperCase(), detectedSource: 'en' }), { saveDelayMs: 0, maxStored: 2, now: () => ++t });
    await cache.attach(storage);
    for (const id of ['a', 'b', 'c']) {
      cache.request(id, { text: id, target: 'es' });
      await flush();
    }
    await flush();
    expect(Object.keys(saved()).sort()).toEqual(['b\u0000es', 'c\u0000es']);
  });

  it('forgets the previous account’s translations when another signs in, and ignores a broken save', async () => {
    const lucia = memoryStorage();
    const translate = varyingTranslator();
    const cache = createTranslationCache(translate, { saveDelayMs: 0 });
    await cache.attach(lucia.storage);
    cache.request('m1', { text: 'Hi', target: 'es' });
    await flush();
    expect(cache.get('m1', 'es')?.status).toBe('done');

    const broken: TranslationStorage = { load: async () => ({ junk: { nope: true } } as unknown as Record<string, StoredTranslation>), save: () => {} };
    await cache.attach(broken);
    expect(cache.get('m1', 'es')).toBeUndefined();
    cache.request('m1', { text: 'Hi', target: 'es' });
    await flush();
    expect(doneText(cache, 'm1')).toBe('Hi (take 2)');
  });

  it('keeps asking for keys still on screen after switching storage', async () => {
    const translate = varyingTranslator();
    const cache = createTranslationCache(translate);
    cache.subscribe('m1', 'es', () => {});
    cache.request('m1', { text: 'Hi', target: 'es' });
    await flush();
    await cache.attach(memoryStorage().storage);
    await flush();
    expect(doneText(cache, 'm1')).toBe('Hi (take 2)');
  });

  it('works for this visit only when storage fails to load', async () => {
    const storage: TranslationStorage = { load: async () => { throw new Error('blocked'); }, save: () => { throw new Error('blocked'); } };
    const translate = varyingTranslator();
    const cache = createTranslationCache(translate, { saveDelayMs: 0 });
    await cache.attach(storage);
    cache.request('m1', { text: 'Hi', target: 'es' });
    await flush();
    await flush();
    expect(doneText(cache, 'm1')).toBe('Hi (take 1)');
  });
});
