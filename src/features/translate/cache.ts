// Translations per (message id, target language). Re-renders, the "Show original" toggle and
// switching languages back never refetch; a request already on its way is shared. Each bubble
// listens to its own key only, and a key a bubble is watching is never evicted.
//
// Kept across reloads too, with attach(storage): good translations are saved (with the text they
// translate, so an edited text is translated again), and a reload shows the very same wording without
// asking the translator again. Requests made while a storage is still loading wait for it.
//
// Failures back off: after the n-th failure in a row a key waits retryAfterMs × 2^(n-1) (capped at
// maxRetryMs). One timer per failed key re-requests it then, but only while a bubble is watching;
// otherwise the next bubble to ask after the wait does. retry() (the "Try again" tap) goes at once.
import type { Translate, TranslateRequest, Translation } from './client';

export type Entry =
  | { status: 'loading' }
  | { status: 'done'; result: Translation }
  | { status: 'error'; at: number };

/** A saved translation: the text it translates, the result, and when it was made (ms). */
export interface StoredTranslation {
  text: string;
  result: Translation;
  at: number;
}

/** Where translations are kept between visits, e.g. this device's storage for the signed-in user. */
export interface TranslationStorage {
  load(): Promise<Record<string, StoredTranslation> | null>;
  save(entries: Record<string, StoredTranslation>): Promise<void> | void;
}

export interface CacheOptions {
  retryAfterMs?: number;
  maxRetryMs?: number;
  /** Oldest entries are dropped past this many (never loading or watched ones). */
  max?: number;
  /** Most translations kept in storage (the newest). */
  maxStored?: number;
  /** Saves are batched: written this long after the last new translation. */
  saveDelayMs?: number;
  now?: () => number;
}

/** Worth keeping: a real answer, not "not set up here", "can't do this language" or a refusal. */
export function keepable(result: Translation): boolean {
  return !result.unavailable && !result.unsupported && !result.refused;
}

function validStored(value: unknown): value is StoredTranslation {
  if (!value || typeof value !== 'object') return false;
  const { text, result, at } = value as Partial<StoredTranslation>;
  return typeof text === 'string' && typeof at === 'number' && !!result && typeof result.text === 'string';
}

export function createTranslationCache(
  translate: Translate,
  { retryAfterMs = 30_000, maxRetryMs = 5 * 60_000, max = 500, maxStored = 300, saveDelayMs = 400, now = Date.now }: CacheOptions = {},
) {
  const entries = new Map<string, Entry>();
  const requests = new Map<string, TranslateRequest>();
  const listeners = new Map<string, Set<() => void>>();
  const failures = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  // Saved translations of the attached storage, and keys asked for while it was still loading.
  let storage: TranslationStorage | null = null;
  let stored = new Map<string, StoredTranslation>();
  let loading: Promise<void> | null = null;
  const deferred = new Set<string>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const keyOf = (messageId: string, target: string) => `${messageId}\u0000${target}`;
  const watched = (key: string) => (listeners.get(key)?.size ?? 0) > 0;
  const waitFor = (key: string) => Math.min(retryAfterMs * 2 ** Math.max(0, (failures.get(key) ?? 1) - 1), maxRetryMs);

  function set(key: string, entry: Entry) {
    entries.delete(key); // re-insert, so Map order is oldest-first
    entries.set(key, entry);
    for (const k of entries.keys()) {
      if (entries.size <= max) break;
      if (k === key || watched(k) || entries.get(k)?.status === 'loading') continue;
      entries.delete(k);
      requests.delete(k);
      failures.delete(k);
    }
    listeners.get(key)?.forEach(l => l());
  }

  function scheduleSave() {
    if (!storage) return;
    clearTimeout(saveTimer);
    const target = storage;
    saveTimer = setTimeout(() => {
      const newest = [...stored.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, maxStored);
      stored = new Map(newest);
      Promise.resolve().then(() => target.save(Object.fromEntries(newest))).catch(() => {
        // Storage full or blocked (private browsing): translations still hold for this visit.
      });
    }, saveDelayMs);
  }

  /** The saved translation of this exact text, if any. */
  function savedFor(key: string, req: TranslateRequest): Translation | null {
    const hit = stored.get(key);
    return hit && hit.text === req.text ? hit.result : null;
  }

  function start(key: string) {
    const req = requests.get(key);
    if (!req) return;
    clearTimeout(timers.get(key));
    timers.delete(key);
    set(key, { status: 'loading' });
    const gen = generation;
    // Answered for the previous account, or for text that has changed since (a newer call is on its way).
    const stale = () => gen !== generation || requests.get(key)?.text !== req.text;
    translate(req).then(
      result => {
        if (stale()) return;
        failures.delete(key);
        if (keepable(result) && storage) {
          stored.set(key, { text: req.text, result, at: now() });
          scheduleSave();
        }
        set(key, { status: 'done', result });
      },
      () => {
        if (stale()) return;
        failures.set(key, (failures.get(key) ?? 0) + 1);
        set(key, { status: 'error', at: now() });
        timers.set(key, setTimeout(() => {
          timers.delete(key);
          if (watched(key) && entries.get(key)?.status === 'error') start(key);
        }, waitFor(key)));
      },
    );
  }

  /** From storage if it has this text, else from the translator. */
  function fill(key: string) {
    const req = requests.get(key);
    if (!req) return;
    const saved = savedFor(key, req);
    if (saved) set(key, { status: 'done', result: saved });
    else start(key);
  }

  return {
    get(messageId: string, target: string): Entry | undefined {
      return entries.get(keyOf(messageId, target));
    },

    /** Starts translating unless it's cached (or saved), on its way, or failed and still waiting to retry. */
    request(messageId: string, req: TranslateRequest): void {
      const key = keyOf(messageId, req.target);
      const previous = requests.get(key);
      requests.set(key, req);
      const entry = entries.get(key);
      const sameText = !previous || previous.text === req.text;
      if (entry && sameText && (entry.status !== 'error' || now() - entry.at < waitFor(key))) return;
      if (loading) {
        // Storage is still loading: wait for it rather than pay for a translation it may have.
        deferred.add(key);
        if (entry?.status !== 'loading') set(key, { status: 'loading' });
        return;
      }
      fill(key);
    },

    /** "Try again": re-requests a failed translation now. */
    retry(messageId: string, target: string): void {
      const key = keyOf(messageId, target);
      if (entries.get(key)?.status === 'error') start(key);
    },

    /** Calls `listener` when this message's translation into `target` changes. */
    subscribe(messageId: string, target: string, listener: () => void) {
      const key = keyOf(messageId, target);
      const group = listeners.get(key) ?? new Set();
      group.add(listener);
      listeners.set(key, group);
      return () => {
        group.delete(listener);
        if (!group.size) listeners.delete(key);
      };
    },

    /**
     * Keeps translations in `storage` (null: this visit only), e.g. on sign-in. Forgets everything
     * held for the previous storage, so the next person on a shared phone doesn't see it. Resolves
     * once the saved translations are loaded.
     */
    attach(next: TranslationStorage | null): Promise<void> {
      generation++;
      const gen = generation;
      // Bubbles still on screen keep asking (they won't call request() again on their own).
      const onScreen = [...requests].filter(([key]) => watched(key));
      clearTimeout(saveTimer);
      timers.forEach(clearTimeout);
      timers.clear();
      entries.clear();
      requests.clear();
      failures.clear();
      deferred.clear();
      stored = new Map();
      storage = next;
      for (const [key, req] of onScreen) {
        requests.set(key, req);
        deferred.add(key);
        entries.set(key, { status: 'loading' });
      }
      listeners.forEach(group => group.forEach(l => l()));
      if (!next) {
        loading = null;
        const waiting = [...deferred];
        deferred.clear();
        waiting.forEach(fill);
        return Promise.resolve();
      }
      const done = Promise.resolve()
        .then(() => next.load())
        .catch(() => null)
        .then(saved => {
          if (gen !== generation) return;
          for (const [key, value] of Object.entries(saved ?? {})) if (validStored(value)) stored.set(key, value);
          loading = null;
          const waiting = [...deferred];
          deferred.clear();
          waiting.forEach(fill);
        });
      loading = done;
      return done;
    },
  };
}

export type TranslationCache = ReturnType<typeof createTranslationCache>;
