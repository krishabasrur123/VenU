// What a chat bubble shows for one message, in the reader's language.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useProfile } from '@/features/profile/profile-context';
import type { ChatMessage } from '@/features/volunteer/types';
import { useUiLanguage } from '@/i18n';

import type { Entry, TranslationCache } from './cache';
import { baseLanguage, chatLanguage, profileChatLanguage } from './languages';
import { translationCache } from './service';

/**
 * original: show the message as written (yours, or already in the reader's language).
 * loading: show the original with "Translating…". translated: show `text`, "Translated from <source>"
 * (`partial`: only the start of a very long message). failed / unsupported / unavailable: show the
 * original with a note saying why.
 */
export type MessageTranslation =
  | { kind: 'original' }
  | { kind: 'loading' }
  | { kind: 'translated'; text: string; source: string | null; partial: boolean }
  | { kind: 'failed' }
  | { kind: 'unsupported' }
  | { kind: 'unavailable' };

/** The profile's chat language (main language first, even one the UI isn't translated into, e.g. Hindi), else the UI language. */
export function useReaderLanguage(): string {
  const { profile } = useProfile();
  const { language } = useUiLanguage();
  return profile ? profileChatLanguage(profile) : chatLanguage([language]);
}

/**
 * Anything translated like a chat message: a message, or a visitor's request note or a facility
 * report, under an id of its own, e.g. { id: 'note:req-1', from: 'them', text: 'Hola, estoy en la puerta 5' }.
 */
export type Translatable = Pick<ChatMessage, 'id' | 'from' | 'text' | 'lang'>;

/** Messages that never need a request: yours, empty ones, ones already in the reader's language. */
export function needsTranslation(message: Translatable, reader: string): boolean {
  if (message.from === 'me' || !message.text.trim()) return false;
  return !message.lang || chatLanguage([message.lang]) !== reader;
}

export function viewOf(entry: Entry | undefined, message: Translatable, reader: string): MessageTranslation {
  if (!needsTranslation(message, reader)) return { kind: 'original' };
  if (!entry || entry.status === 'loading') return { kind: 'loading' };
  if (entry.status === 'error') return { kind: 'failed' };
  const r = entry.result;
  if (r.refused) return { kind: 'failed' };
  if (r.unsupported) return { kind: 'unsupported' };
  if (r.unavailable) return { kind: 'unavailable' };
  const source = r.detectedSource ?? (message.lang ? baseLanguage(message.lang) : null);
  if (source === reader || r.text.trim() === message.text.trim()) return { kind: 'original' };
  return { kind: 'translated', text: r.text, source, partial: !!r.partial };
}

/** The bubble's view of `message`, and `retry` for the "Try again" tap. */
export function useMessageTranslation(
  message: Translatable,
  reader: string,
  cache: TranslationCache = translationCache,
): { view: MessageTranslation; retry: () => void } {
  const { id, text, lang } = message;
  const needed = needsTranslation(message, reader);
  const subscribe = useCallback((listener: () => void) => cache.subscribe(id, reader, listener), [cache, id, reader]);
  const read = () => (needed ? cache.get(id, reader) : undefined);
  const entry = useSyncExternalStore(subscribe, read, read);
  useEffect(() => {
    if (needed) cache.request(id, { text, target: reader, ...(lang ? { source: lang } : {}) });
  }, [cache, needed, id, text, lang, reader]);
  const retry = useCallback(() => cache.retry(id, reader), [cache, id, reader]);
  return { view: viewOf(entry, message, reader), retry };
}

/**
 * The text to show for `view`: the translation (with "…" when only its start was translated), or
 * `text` as written while `original` is on or there's no translation.
 * e.g. shownText({ kind: 'translated', text: 'Hi', source: 'es', partial: false }, 'Hola', false) → 'Hi'
 */
export function shownText(view: MessageTranslation, text: string, original: boolean): string {
  if (view.kind !== 'translated' || original) return text;
  return view.partial ? `${view.text}…` : view.text;
}

/**
 * `item` in the reader's language, with a "Show original" switch: the text to show (the translation,
 * or the original while switched or when there's none), the view for TranslationNote, and the switch.
 */
export function useTranslatedText(
  item: Translatable,
  reader: string,
  cache: TranslationCache = translationCache,
): { text: string; view: MessageTranslation; original: boolean; toggle: () => void; retry: () => void } {
  const { view, retry } = useMessageTranslation(item, reader, cache);
  const [original, setOriginal] = useState(false);
  const toggle = useCallback(() => setOriginal(o => !o), []);
  return { text: shownText(view, item.text, original), view, original, toggle, retry };
}
