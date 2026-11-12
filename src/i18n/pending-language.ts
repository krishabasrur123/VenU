// The language picked before sign-in (welcome screen pill), shared live with <LanguageSync />.
// Stored in pending setup (features/auth/pending-setup.ts); this adds a subscribable copy so a pick
// can switch the UI at once. e.g. choosePendingLanguage('ko') → the app re-renders in Korean.

import { useSyncExternalStore } from 'react';

import { readPendingSetup, writePendingSetup } from '@/features/auth/pending-setup';

interface Snapshot {
  /** undefined: nothing picked on this device. */
  language: string | undefined;
  /** false until storage has been read once, so the device language isn't applied too early. */
  loaded: boolean;
}

let snapshot: Snapshot = { language: undefined, loaded: false };
const listeners = new Set<() => void>();

function set(language: string | undefined) {
  if (snapshot.loaded && snapshot.language === language) return;
  snapshot = { language, loaded: true };
  listeners.forEach(l => l());
}

/** Re-reads storage: screens that call writePendingSetup directly are picked up on the next read. */
export async function refreshPendingLanguage(): Promise<void> {
  set((await readPendingSetup()).language);
}

/** Use this from a signed-out language picker: switches the UI now and remembers the pick. */
export async function choosePendingLanguage(code: string): Promise<void> {
  set(code);
  await writePendingSetup({ language: code });
}

export function usePendingLanguage(): Snapshot {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}
