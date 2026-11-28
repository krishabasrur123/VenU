// The app's translator and cache. Supabase and mock modes call the `translate` Edge Function;
// local mode (no Supabase) uses the offline stub. Translations are kept on this device per
// signed-in user (setTranslationOwner), so a reload never re-translates. Also remembers which provider answered last, so
// the chat only promises "will see this translated" when a real one is on.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

import { createTranslationCache, type StoredTranslation } from './cache';
import { createTranslateClient, edgeFunctionTransport, type ProviderName, type Transport } from './client';
import { localStub } from './local';

let provider: ProviderName | null = supabase ? null : 'stub';
const providerListeners = new Set<() => void>();

const stubTransport: Transport = async batch => ({ provider: 'stub', translations: await localStub.translator.translate(batch) });

export const translate = createTranslateClient(supabase ? edgeFunctionTransport(supabase) : stubTransport, {
  onProvider(name) {
    if (name === provider) return;
    provider = name;
    providerListeners.forEach(l => l());
  },
});

export const translationCache = createTranslationCache(translate);

/** Saved under `venu.translations.<userId>`; removed on sign-out. */
export const TRANSLATIONS_KEY = 'venu.translations';
let translationOwner: string | null = null;

/**
 * Keeps the signed-in user's translations on this device, so a reload shows the same wording
 * without a new call; null (signed out) forgets them, here and in storage.
 */
export function setTranslationOwner(userId: string | null): void {
  if (userId === translationOwner) return;
  const previous = translationOwner;
  translationOwner = userId;
  if (!userId) {
    void translationCache.attach(null);
    if (previous) AsyncStorage.removeItem(`${TRANSLATIONS_KEY}.${previous}`).catch(() => {});
    return;
  }
  const key = `${TRANSLATIONS_KEY}.${userId}`;
  void translationCache.attach({
    async load() {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Record<string, StoredTranslation>) : null;
    },
    save: entries => AsyncStorage.setItem(key, JSON.stringify(entries)),
  });
}

/** The provider that answered last ('anthropic', 'deepl', 'stub'), or null before any reply. */
export function useTranslationProvider(): ProviderName | null {
  return useSyncExternalStore(
    l => {
      providerListeners.add(l);
      return () => { providerListeners.delete(l); };
    },
    () => provider,
    () => provider,
  );
}

/** True once a real translator (not the offline stub) has answered. */
export function isRealProvider(name: ProviderName | null): boolean {
  return name === 'anthropic' || name === 'deepl';
}
