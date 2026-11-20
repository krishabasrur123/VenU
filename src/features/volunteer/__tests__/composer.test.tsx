// Double-tapping Send must not start dictation (volunteer F6): Send turns into the mic in the same
// spot once the input empties, so it stays Send for a moment after sending.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { createRoot, type TestInstance } from 'test-renderer';

import { composerButton, SEND_HOLD_MS, useSendHold } from '../composer';

describe('composerButton', () => {
  it('is Stop while dictating, whatever else is going on', () => {
    expect(composerButton({ listening: true, text: 'hi', holding: true })).toBe('stop');
    expect(composerButton({ listening: true, text: '', holding: false })).toBe('stop');
  });

  it('is Send with text, and the mic with an empty (or blank) input', () => {
    expect(composerButton({ listening: false, text: 'On my way', holding: false })).toBe('send');
    expect(composerButton({ listening: false, text: '   ', holding: false })).toBe('mic');
    expect(composerButton({ listening: false, text: '', holding: false })).toBe('mic');
  });

  it('stays Send right after sending, though the input is empty', () => {
    expect(composerButton({ listening: false, text: '', holding: true })).toBe('send');
  });
});

/** The chat bar's wiring: Send sends and empties the input; the mic starts dictation. */
function Bar({ onSend, onDictate }: { onSend: (text: string) => void; onDictate: () => void }) {
  const [text, setText] = useState('On my way');
  const hold = useSendHold();
  const button = composerButton({ listening: false, text, holding: hold.holding });
  function send() {
    hold.hold();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  }
  return button === 'send' ? (
    <Pressable accessibilityLabel="Send" onPress={send}><Text>Send</Text></Pressable>
  ) : (
    <Pressable accessibilityLabel="Speak a message" onPress={onDictate}><Text>Mic</Text></Pressable>
  );
}

const button = (c: TestInstance) => c.queryAll(n => n.type === 'View' && typeof n.props.accessibilityLabel === 'string')[0]!;
/** A tap where the button is, the way Pressable sees a click. */
const tapButton = (c: TestInstance) => act(() => { button(c).props.onClick({ nativeEvent: {} }); });

describe('Send button after sending', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('a double tap sends once and never starts dictation; the mic comes back after the hold', async () => {
    const onSend = jest.fn();
    const onDictate = jest.fn();
    const root = createRoot();
    await act(async () => { root.render(<Bar onSend={onSend} onDictate={onDictate} />); });

    tapButton(root.container); // first tap: sends
    act(() => { jest.advanceTimersByTime(150); });
    expect(button(root.container).props.accessibilityLabel).toBe('Send');
    tapButton(root.container); // second tap of the double tap: lands on Send, nothing to send
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('On my way');
    expect(onDictate).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(SEND_HOLD_MS); });
    expect(button(root.container).props.accessibilityLabel).toBe('Speak a message');
    tapButton(root.container); // a deliberate tap later does start dictation
    expect(onDictate).toHaveBeenCalledTimes(1);
  });

  it('without the hold the second tap would hit the mic (the bug)', async () => {
    function Unguarded({ onDictate }: { onDictate: () => void }) {
      const [text, setText] = useState('On my way');
      return composerButton({ listening: false, text, holding: false }) === 'send'
        ? <Pressable accessibilityLabel="Send" onPress={() => setText('')}><Text>Send</Text></Pressable>
        : <Pressable accessibilityLabel="Speak a message" onPress={onDictate}><Text>Mic</Text></Pressable>;
    }
    const onDictate = jest.fn();
    const root = createRoot();
    await act(async () => { root.render(<Unguarded onDictate={onDictate} />); });
    tapButton(root.container);
    tapButton(root.container);
    expect(onDictate).toHaveBeenCalledTimes(1);
  });
});
