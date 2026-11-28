/**
 * Chat about one help request (Figma 231:25476 keyboard down, 231:26460 keyboard up), from either
 * side: a visitor with the volunteer who accepted, or that volunteer with the visitor.
 * Full screen without the tab bar; the bottom bar rides above the keyboard.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextInputKeyPressEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { FigmaIcon } from '@/components/icons/figma-icon';
import { ChatBubble } from '@/components/volunteer/chat-bubble';
import { Hint, useHint } from '@/components/volunteer/hint';
import { MeetPlaceText } from '@/components/volunteer/meet-place';
import { RequestSummary } from '@/components/volunteer/request-note';
import { useStartAligned } from '@/components/volunteer/start-aligned';
import { Colors, Face, Fonts, Spacing } from '@/constants/theme';
import { toggleState } from '@/features/voice/announce';
import { useDictation } from '@/features/voice/use-dictation';
import { composerButton, useSendHold } from '@/features/volunteer/composer';
import { formatDayTime, needsSeparator } from '@/features/volunteer/format';
import { languageOf, useLayoutRtl, useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { useConversation } from '@/features/volunteer/conversation';
import { goBack } from '@/lib/navigation';

/** Longest message the input takes, typed or dictated. */
const MESSAGE_MAX = 1000;
/** The input grows with a long message up to about five lines, then scrolls. */
const INPUT_MIN = 38; // one 22pt line plus padding
const INPUT_MAX = 126;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversation: c, restored } = useConversation(id);
  const [text, setText] = useState('');
  const { hint, show } = useHint();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const t = useT('volunteer');
  const tc = useT('common');
  const rtl = useLayoutRtl();
  const startAligned = useStartAligned(); // "Daniel K." on the start edge in Arabic too
  // The mic dictates into the input for review; voice messages are sent as text.
  const dictation = useDictation({ onText: next => setText(next.slice(0, MESSAGE_MAX)), onNote: show });
  const [finishing, setFinishing] = useState(false);
  // Send stays Send for a moment after sending, so a double tap can't start dictation.
  const sendHold = useSendHold();
  // Web: the input's height follows its text (native multiline inputs grow by themselves).
  const [inputHeight, setInputHeight] = useState(INPUT_MIN);
  const unread = c?.unread ?? 0;
  const markRead = c?.markRead;

  // Reading the chat clears the dot on Message, including for messages that arrive while open.
  useEffect(() => {
    if (unread) markRead?.();
  }, [unread, markRead]);

  // The request ended or was cancelled (or this is a stale link). After a reload, wait for the
  // saved request to come back before deciding.
  if (!c) return restored ? <Redirect href="/volunteer" /> : null;
  const { peer, messages, typing } = c;

  async function send() {
    if (finishing) return;
    sendHold.hold();
    let message = text;
    if (dictation.listening) {
      // Wait (briefly) for the last words; once complete() resolves nothing can refill the input.
      setFinishing(true);
      message = ((await dictation.complete()) ?? text).slice(0, MESSAGE_MAX);
      setFinishing(false);
    }
    if (!message.trim()) return;
    c?.send(message);
    sendHold.hold();
    setText('');
    setInputHeight(INPUT_MIN);
  }

  // Web: Enter sends, Shift+Enter starts a new line (native: the return key sends).
  function onKeyPress(e: TextInputKeyPressEvent) {
    const key = e.nativeEvent as typeof e.nativeEvent & { shiftKey?: boolean; isComposing?: boolean };
    if (Platform.OS !== 'web' || key.key !== 'Enter' || key.shiftKey || key.isComposing) return;
    e.preventDefault();
    void send();
  }

  const button = composerButton({ listening: dictation.listening, text, holding: sendHold.holding || finishing });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.header}>
          <Pressable onPress={() => goBack('/volunteer')} accessibilityRole="button" accessibilityLabel={tc('actions.back')} style={styles.back}>
            <View style={rtl && styles.flip}>
              <FigmaIcon name="arrow-left" size={36} color={Colors.ink} />
            </View>
          </Pressable>
          <Avatar name={peer.firstName} uri={null} size={40} />
          <View style={styles.headerText}>
            <Text style={[styles.name, startAligned]} accessibilityRole="header" numberOfLines={1}>{peer.name}</Text>
            {/* Digits as on "Volunteer found" (۲ in Persian). The volunteer sees where the visitor waits. */}
            {c.etaMinutes != null ? (
              <Text style={[styles.away, startAligned]}>{t('chat.away', { minutes: formatNumber(c.etaMinutes, undefined, languageOf(t)) })}</Text>
            ) : c.meetPoint ? (
              <MeetPlaceText point={c.meetPoint} style={[styles.away, startAligned]} />
            ) : null}
          </View>
          <Pressable
            onPress={() => show(t('chat.callSoon', { name: peer.firstName }))}
            accessibilityRole="button"
            accessibilityLabel={t('chat.call', { name: peer.firstName })}
            style={({ pressed }) => [styles.call, pressed && styles.pressed]}>
            <FigmaIcon name="group-43-c358d1" size={50} />
          </Pressable>
        </View>
        <Hint text={hint} style={styles.hint} />

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          accessibilityLabel={t('chat.messages')}>
          {/* What the visitor asked for, so the volunteer doesn't have to remember it. */}
          <RequestSummary request={c.request} visitorName={peer.firstName} />
          {messages.length === 0 ? (
            <Text style={styles.empty}>{c.side === 'visitor' ? t('chat.empty', { name: peer.firstName }) : t('chat.emptyVolunteer', { name: peer.firstName })}</Text>
          ) : (
            messages.map((m, i, all) => (
              <Fragment key={m.id}>
                {/* A day/time line only where the conversation paused for more than 10 minutes. */}
                {i > 0 && needsSeparator(messages[i - 1]!.sentAt, m.sentAt) ? (
                  <Text style={styles.separator}>{formatDayTime(m.sentAt)}</Text>
                ) : null}
                <ChatBubble
                  message={m}
                  // Under your latest message: who reads it, and in which language.
                  recipient={m.from === 'me' && !all.slice(i + 1).some(n => n.from === 'me') ? { name: peer.firstName, language: peer.language } : null}
                  senderName={peer.name}
                  onListen={() => show(t('chat.listenSoon'))}
                  onRetry={() => c.retry(m.id)}
                />
              </Fragment>
            ))
          )}
          {typing ? (
            <Text style={styles.typing} accessibilityLiveRegion="polite">{t('chat.typing', { name: peer.firstName })}</Text>
          ) : null}
        </ScrollView>

        {dictation.listening ? <Text style={styles.listeningLabel}>{tc('media.listening')}</Text> : null}
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }, dictation.listening && styles.barListening]}>
          <Pressable onPress={() => show(t('chat.attachSoon'))} accessibilityRole="button" accessibilityLabel={t('chat.attach')} style={styles.barButton}>
            <FigmaIcon name="attachment" size={24} color={Colors.textFaint} />
          </Pressable>
          <View style={[styles.input, dictation.listening && styles.inputListening]}>
            {/* Multiline, so a long message wraps instead of running off to the side. */}
            <TextInput
              value={text}
              onChangeText={next => { setText(next); dictation.edit(next); if (!next) setInputHeight(INPUT_MIN); }}
              placeholder={dictation.listening ? tc('media.listening') : t('chat.placeholder')}
              placeholderTextColor={Colors.textFaint}
              style={[styles.inputText, Platform.OS === 'web' && { height: inputHeight }]}
              multiline
              onContentSizeChange={e => setInputHeight(Math.min(Math.max(Math.ceil(e.nativeEvent.contentSize.height), INPUT_MIN), INPUT_MAX))}
              onKeyPress={onKeyPress}
              onSubmitEditing={() => void send()}
              submitBehavior="submit"
              returnKeyType="send"
              accessibilityLabel={t('chat.messageTo', { name: peer.firstName })}
              maxLength={MESSAGE_MAX}
            />
            <Pressable onPress={() => show(t('chat.stickersSoon'))} accessibilityRole="button" accessibilityLabel={t('chat.stickers')} style={styles.sticker}>
              <FigmaIcon name="stickers" size={18} color={Colors.textFaint} />
            </Pressable>
          </View>
          {button === 'stop' ? (
            <Pressable
              onPress={dictation.stop}
              accessibilityRole="button"
              accessibilityLabel={tc('media.listening')}
              {...toggleState(true)}
              style={[styles.barButton, styles.sendButton]}>
              <View style={styles.stop} />
            </Pressable>
          ) : button === 'send' ? (
            <Pressable onPress={() => void send()} accessibilityRole="button" accessibilityLabel={tc('actions.send')} style={[styles.barButton, styles.sendButton]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
                <Path d="M12 19V5M5 12l7-7 7 7" stroke={Colors.onPrimary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => dictation.start(text)}
              accessibilityRole="button"
              accessibilityLabel={t('chat.record')}
              {...toggleState(false)}
              style={styles.barButton}>
              <FigmaIcon name="record" size={16} color={Colors.textFaint} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  flip: { transform: [{ scaleX: -1 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingStart: Spacing.md, paddingEnd: Spacing.gutter, paddingVertical: Spacing.lg },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 4 },
  name: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 28, color: Colors.text },
  away: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.text },
  call: { width: 50, height: 50 },
  hint: { marginHorizontal: Spacing.gutter, marginBottom: Spacing.sm },
  messages: { flex: 1, backgroundColor: Colors.surfaceAlt },
  messagesContent: { gap: Spacing.xl, paddingHorizontal: Spacing.gutter - 6, paddingVertical: Spacing.lg },
  empty: { fontFamily: Fonts.text, fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  separator: { ...Face.textSemiBold, fontSize: 13, lineHeight: 16, color: Colors.textMuted, textAlign: 'center' },
  // Sits under the last bubble, lined up with the incoming bubbles' text.
  typing: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.textMuted, marginTop: -Spacing.sm, paddingStart: Spacing.lg },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end', // the buttons stay at the bottom while the input grows
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // "Listening… tap to stop" sits on top of the bar and takes over its top border.
  listeningLabel: {
    ...Face.textSemiBold,
    fontSize: 13,
    lineHeight: 16,
    color: Colors.primary,
    textAlign: 'center',
    paddingTop: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  barListening: { borderTopWidth: 0, paddingTop: 4 },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendButton: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 2, marginBottom: 2, backgroundColor: Colors.primary },
  stop: { width: 14, height: 14, borderRadius: 3, backgroundColor: Colors.onPrimary },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 40,
    marginBottom: 1, // centred on the 44pt buttons beside it while it's one line
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
    paddingStart: 14,
  },
  inputListening: { borderColor: Colors.primary, borderWidth: 2, paddingStart: 13 }, // the thicker border doesn't shift the text
  // outlineStyle 'none' is web-only: native accepts only solid | dotted | dashed.
  inputText: {
    flex: 1,
    fontFamily: Fonts.text,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.text,
    minHeight: INPUT_MIN,
    maxHeight: INPUT_MAX,
    paddingTop: 8,
    paddingBottom: 8,
    ...Platform.select({ web: { outlineStyle: 'none', resize: 'none' } as object }),
  },
  sticker: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
