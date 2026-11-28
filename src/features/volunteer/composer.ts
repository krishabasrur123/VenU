// The round button at the end of the chat's message bar: Stop while dictating, Send when there's
// text, else the mic. Send turns into the mic in the same spot once the input empties, so after a
// send it stays Send for a moment (SEND_HOLD_MS): a double tap then lands on Send (which has
// nothing left to send) instead of starting dictation.
//   composerButton({ listening: false, text: '', holding: true })  → 'send'
//   composerButton({ listening: false, text: '', holding: false }) → 'mic'
import { useCallback, useEffect, useRef, useState } from 'react';

export type ComposerButton = 'stop' | 'send' | 'mic';

/** How long Send stays after sending; longer than a double tap, short enough not to be noticed. */
export const SEND_HOLD_MS = 800;

export function composerButton({ listening, text, holding }: { listening: boolean; text: string; holding: boolean }): ComposerButton {
  if (listening) return 'stop';
  return text.trim() || holding ? 'send' : 'mic';
}

/** `holding` is true for `ms` after each `hold()` (call it when a send starts). */
export function useSendHold(ms = SEND_HOLD_MS): { holding: boolean; hold: () => void } {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hold = useCallback(() => {
    clearTimeout(timer.current);
    setHolding(true);
    timer.current = setTimeout(() => setHolding(false), ms);
  }, [ms]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { holding, hold };
}
