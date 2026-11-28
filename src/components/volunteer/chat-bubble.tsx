/**
 * Figma "chat-bubble" (231:25791): incoming white with a gray outline and a tail at the bottom left,
 * outgoing blue with the tail at the bottom right. The time sits beside a short message and drops
 * under a long one. Incoming bubbles carry the "listen" link (Frame 2271). In a right-to-left
 * layout the sides swap: incoming on the right with its tail at the bottom right, yours on the left.
 *
 * Translation: an incoming message in another language shows in the reader's language, with
 * "Translated from English · Show original" under it (a button that flips between the two). While it
 * translates, or if it can't, the original shows with a short note ("Couldn't translate · Try again").
 * Yours show what you typed; the last one can name who reads it: "Daniel will see this translated
 * into English" once a real translator has answered, else just "Daniel reads English". One the
 * service refused says "Not sent · Tap to retry" under it instead, and tapping sends it again.
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { TranslationNote } from '@/components/translation-note';
import { Colors, Face, Fonts, Spacing } from '@/constants/theme';
import { uiLanguageName } from '@/features/profile/summary';
import { isRealProvider, useReaderLanguage, useTranslatedText, useTranslationProvider } from '@/features/translate';
import { formatClock } from '@/features/volunteer/format';
import type { ChatMessage } from '@/features/volunteer/types';
import { useLayoutRtl, useT } from '@/i18n';

const TAIL = 7;
const INCOMING_EDGE = Colors.controlBorder;
const MUTED_TIME = Colors.textFaint; // Figma #7E919A is 3.3:1 on white; this is 4.5:1

/** Bubble outline with the tail on the left; `mirror` flips it for outgoing. */
function bubblePath(w: number, h: number, mirror: boolean): string {
  const r = Math.min(20, h / 2);
  const t = TAIL;
  const pts: [string, ...number[]][] = [
    ['M', t + r, 0.5],
    ['H', w - r],
    ['Q', w - 0.5, 0.5, w - 0.5, r],
    ['V', h - r],
    ['Q', w - 0.5, h - 0.5, w - r, h - 0.5],
    ['H', t + 10],
    ['C', t + 5, h - 0.5, 3, h - 0.5, 0.5, h - 1.5],
    ['C', t - 2, h - 4, t, h - 8, t, h - 14],
    ['V', r],
    ['Q', t, 0.5, t + r, 0.5],
  ];
  const isX = (cmd: string, i: number) => cmd === 'H' || (cmd !== 'V' && i % 2 === 0);
  return pts
    .map(([cmd, ...n]) => cmd + n.map((v, i) => (mirror && isX(cmd, i) ? w - v : v).toFixed(1)).join(' '))
    .join(' ') + ' Z';
}

interface Props {
  message: ChatMessage;
  /** Who reads your message, for the line under it, e.g. { name: 'Daniel', language: 'en' }. */
  recipient?: { name: string; language: string } | null;
  /** Who wrote an incoming message, for screen readers, e.g. 'Daniel K.' or 'Rosa'. */
  senderName: string;
  onListen?: () => void;
  /** Sends a message of yours that failed again ("Tap to retry"). */
  onRetry?: () => void;
}

export function ChatBubble({ message, recipient, senderName, onListen, onRetry }: Props) {
  const mine = message.from === 'me';
  const failed = mine && !!message.failed;
  const t = useT('volunteer');
  const tp = useT('profile'); // language names in the UI language
  const rtl = useLayoutRtl();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: Math.round(width), h: Math.round(height) });
  };
  const time = formatClock(message.sentAt);
  const reader = useReaderLanguage();
  const { text, view: translation, original, toggle, retry } = useTranslatedText(message, reader);
  const provider = useTranslationProvider();
  const translated = translation.kind === 'translated' && !original ? translation : null;
  const recipientLanguage = recipient && recipient.language !== reader ? uiLanguageName(recipient.language, tp) : null;
  const hint = !mine || failed || !recipient || !recipientLanguage
    ? null
    : isRealProvider(provider)
      ? t('translation.willSeeIn', { name: recipient.name, language: recipientLanguage })
      : t('translation.readsLanguage', { name: recipient.name, language: recipientLanguage });
  const source = translated?.source ? uiLanguageName(translated.source, tp) : null;
  // Screen readers get the text on screen, then where it was translated from.
  const label = mine
    ? failed ? `${t('bubble.mine', { time, text })}. ${t('bubble.notSent')}` : t('bubble.mine', { time, text })
    : source
      ? t('bubble.fromTranslated', { name: senderName, time, text, language: source })
      : t('bubble.from', { name: senderName, time, text });

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View
        onLayout={onLayout}
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
        accessible
        accessibilityLabel={label}>
        {size.w > 0 && (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} aria-hidden>
            <Path
              d={bubblePath(size.w, size.h, mine !== rtl)}
              fill={mine ? Colors.primary : Colors.surface}
              stroke={mine ? Colors.primary : INCOMING_EDGE}
              strokeWidth={1}
            />
          </Svg>
        )}
        <View style={styles.content}>
          <Text style={[styles.text, mine && styles.textMine]}>{text}</Text>
          <View style={styles.meta}>
            <Text style={[styles.time, mine && styles.timeMine]}>{time}</Text>
            {mine && !failed ? <FigmaIcon name="read" size={16} color={Colors.onPrimary} /> : null}
          </View>
        </View>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {failed ? (
        <Pressable
          onPress={onRetry}
          disabled={!onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('bubble.retryLabel')}
          hitSlop={6}
          style={({ pressed }) => [styles.toggle, styles.failed, pressed && styles.pressed]}>
          <Text style={[styles.note, styles.notSent]}>
            {t('bubble.notSent')}
            {' · '}
            <Text style={styles.noteLink}>{t('bubble.retry')}</Text>
          </Text>
        </Pressable>
      ) : null}
      {!mine ? (
        <View style={styles.footer}>
          <TranslationNote translation={translation} reader={reader} original={original} onToggle={toggle} onRetry={retry} />
          {onListen ? (
            <Pressable onPress={onListen} accessibilityRole="button" accessibilityLabel={t('bubble.listenLabel')} hitSlop={6} style={styles.listen}>
              <FigmaIcon name="volume" size={16} color={Colors.primary} />
              <Text style={styles.listenText}>{t('bubble.listen')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '88%' },
  rowTheirs: { alignSelf: 'flex-start' },
  rowMine: { alignSelf: 'flex-end' },
  bubble: { minHeight: 44 },
  // The tail sits on the start side of incoming bubbles and the end side of yours.
  bubbleTheirs: { paddingStart: TAIL + 16, paddingEnd: 16 },
  bubbleMine: { paddingStart: 16, paddingEnd: TAIL + 16 },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 10,
    rowGap: 6,
    paddingVertical: 12,
  },
  // A link or a long unbroken word wraps inside the bubble instead of running off it. Native
  // breaks long words on its own; browsers need word-break.
  text: { fontFamily: Fonts.display, fontSize: 15, lineHeight: 20, color: Colors.text, flexShrink: 1, ...Platform.select({ web: { wordBreak: 'break-word' } as object }) },
  textMine: { color: Colors.onPrimary },
  meta: { marginStart: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: MUTED_TIME },
  timeMine: { color: Colors.onPrimary },
  // Fits beside "Translated from Spanish · Show original" in English; hitSlop keeps the target wide.
  listen: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingEnd: 4 },
  listenText: { fontFamily: Fonts.text, fontSize: 13, color: Colors.primary },
  // Starts in line with the incoming bubbles' text, like "Daniel is typing…".
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Spacing.md, paddingStart: TAIL + 2 },
  toggle: { minHeight: 32, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  note: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.textMuted },
  noteLink: { ...Face.textSemiBold, color: Colors.primary },
  hint: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.textMuted, alignSelf: 'flex-end', marginTop: 6, paddingEnd: TAIL + 2 },
  // Under your bubble, on the same edge as the hint it replaces.
  failed: { alignSelf: 'flex-end', paddingEnd: TAIL + 2 },
  notSent: { color: Colors.danger },
});
