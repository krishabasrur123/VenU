// Found before the Intuit demo: with The Wall Entrance open (and "I'm here" there), tapping the
// First Aid Floor pin showed its card over The Wall Entrance's sheet, so Directions answered
// "You're already here" for The Wall Entrance instead of routing to First Aid Floor.
import { describe, expect, it } from '@jest/globals';

import { pinPressAction } from '../pin-press';

describe('pinPressAction', () => {
  it('shows the card when the list is showing (nothing open)', () => {
    expect(pinPressAction(undefined, 'first-aid-floor')).toBe('card');
    expect(pinPressAction('', 'first-aid-floor')).toBe('card');
  });

  it('opens another facility straight away when one is already open', () => {
    expect(pinPressAction('wall-entrance', 'first-aid-floor')).toBe('open');
  });

  it('does nothing for the open facility’s own pin', () => {
    expect(pinPressAction('wall-entrance', 'wall-entrance')).toBe('none');
  });
});
