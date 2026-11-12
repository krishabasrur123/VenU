/**
 * Chat with the matched volunteer (Figma 231:25476 keyboard down, 231:26460 keyboard up).
 * Full screen without the tab bar; the bottom bar rides above the keyboard.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { FigmaIcon } from '@/components/icons/figma-icon';
import { ChatBubble } from '@/components/volunteer/chat-bubble';
import { Hint, useHint } from '@/components/volunteer/hint';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatDayTime, needsSeparator } from '@/features/volunteer/format';
import { useLayoutRtl, useT } from '@/i18n';
import { useVolunteerRequest, useVolunteerRestored, volunteerRequests } from '@/features/volunteer/request-store';
import { goBack } from '@/lib/navigation';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, request, match, messages, unread, typing } = useVolunteerRequest();
  const restored = useVolunteerRestored();
  const [text, setText] = useState('');
  const { hint, show } = useHint();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const t = useT('volunteer');
  const tc = useT('common');
  const rtl = useLayoutRtl();
  const active = status === 'matched' && request?.id === id && !!match;

  // Reading the chat clears the dot on "Volunteer found", including for messages that arrive while open.
  useEffect(() => {
    if (active && unread) volunteerRequests.markRead();
  }, [active, unread]);

  // The request ended or was cancelled (or this is a stale link). After a reload, wait for the
  // saved request to come back before deciding.
  if (!active) return restored ? <Redirect href="/volunteer" /> : null;
  const v = match.volunteer;

  function send() {
    if (!text.trim()) return;
    volunteerRequests.sendMessage(text);
    setText('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.header}>
          <Pressable onPress={() => goBack('/volunteer')} accessibilityRole="button" accessibilityLabel={tc('actions.back')} style={styles.back}>
            <View style={rtl && styles.flip}>
              <FigmaIcon name="arrow-left" size={36} color={Colors.ink} />
            </View>
          </Pressable>
          <Avatar name={v.firstName} uri={null} size={40} />
          <View style={styles.headerText}>
            <Text style={styles.name} accessibilityRole="header" numberOfLines={1}>{v.name}</Text>
            <Text style={styles.away}>{t('chat.away', { minutes: match.etaMinutes })}</Text>
          </View>
          <Pressable
            onPress={() => show(t('chat.callSoon', { name: v.firstName }))}
            accessibilityRole="button"
            accessibilityLabel={t('chat.call', { name: v.firstName })}
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
          {messages.length === 0 ? (
            <Text style={styles.empty}>{t('chat.empty', { name: v.firstName })}</Text>
          ) : (
            messages.map((m, i) => (
              <Fragment key={m.id}>
                {/* A day/time line only where the conversation paused for more than 10 minutes. */}
                {i > 0 && needsSeparator(messages[i - 1]!.sentAt, m.sentAt) ? (
                  <Text style={styles.separator}>{formatDayTime(m.sentAt)}</Text>
                ) : null}
                <ChatBubble message={m} onListen={() => show(t('chat.listenSoon'))} />
              </Fragment>
            ))
          )}
          {typing ? (
            <Text style={styles.typing} accessibilityLiveRegion="polite">{t('chat.typing', { name: v.firstName })}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          <Pressable onPress={() => show(t('chat.attachSoon'))} accessibilityRole="button" accessibilityLabel={t('chat.attach')} style={styles.barButton}>
            <FigmaIcon name="attachment" size={24} color={Colors.textFaint} />
          </Pressable>
          <View style={styles.input}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={Colors.textFaint}
              style={styles.inputText}
              onSubmitEditing={send}
              submitBehavior="submit"
              returnKeyType="send"
              accessibilityLabel={t('chat.messageTo', { name: v.firstName })}
              maxLength={1000}
            />
            <Pressable onPress={() => show(t('chat.stickersSoon'))} accessibilityRole="button" accessibilityLabel={t('chat.stickers')} style={styles.sticker}>
              <FigmaIcon name="stickers" size={18} color={Colors.textFaint} />
            </Pressable>
          </View>
          {text.trim() ? (
            <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={tc('actions.send')} style={[styles.barButton, styles.sendButton]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
                <Path d="M12 19V5M5 12l7-7 7 7" stroke={Colors.onPrimary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>
          ) : (
            <Pressable onPress={() => show(t('chat.voiceSoon'))} accessibilityRole="button" accessibilityLabel={t('chat.record')} style={styles.barButton}>
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
  separator: { fontFamily: Fonts.textSemiBold, fontSize: 13, lineHeight: 16, color: Colors.textMuted, textAlign: 'center' },
  // Sits under the last bubble, lined up with the incoming bubbles' text.
  typing: { fontFamily: Fonts.text, fontSize: 13, lineHeight: 16, color: Colors.textMuted, marginTop: -Spacing.sm, paddingStart: Spacing.lg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendButton: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 2, backgroundColor: Colors.primary },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.controlBorder,
    backgroundColor: Colors.surface,
    paddingStart: 14,
  },
  inputText: { flex: 1, fontFamily: Fonts.text, fontSize: 17, color: Colors.text, paddingVertical: 8, outlineStyle: 'none' } as object,
  sticker: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
