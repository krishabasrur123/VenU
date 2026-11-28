/**
 * What tapping a map pin does, given the facility open in the sheet (if any).
 * - Nothing open (the list): show the pin's card over the map; the card opens it.
 * - Another facility open: open the tapped one in the sheet straight away. A card over the old
 *   facility's sheet read as if it were the tapped one: Directions went to the old facility
 *   ("You're already here" after I'm here there).
 * - Its own pin: nothing; it's already open.
 * e.g. pinPressAction(undefined, 'first-aid-floor') → 'card'; pinPressAction('wall-entrance', 'first-aid-floor') → 'open'
 */
export function pinPressAction(openId: string | undefined, tappedId: string): 'card' | 'open' | 'none' {
  if (!openId) return 'card';
  return openId === tappedId ? 'none' : 'open';
}
