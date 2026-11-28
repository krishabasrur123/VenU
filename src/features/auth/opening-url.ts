// The URL a screen was opened with, for the pages Supabase Auth sends people back to
// (/reset-password, /auth-callback). On web the session in the fragment is then cleared from the
// address bar, so the tokens don't linger in history or get copied with the link.

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Kept once cleared from the address bar: a second mount (e.g. React's dev-mode double effect) finds
// the bar already clean.
let openedWith: string | null = null;

export function takeOpeningUrl(): string | null {
  if (Platform.OS !== 'web') return Linking.getLinkingURL();
  if (typeof window === 'undefined') return null;
  if (window.location.hash || window.location.search) {
    openedWith = window.location.href;
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  return openedWith ?? window.location.href;
}
