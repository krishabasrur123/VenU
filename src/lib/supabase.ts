import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Set these in `.env.local` (see .env.example). Without them the app runs in local mode: auth is
// skipped and profiles are saved on the device only. `npm run dev:local|mock|supabase` picks a mode.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Web static rendering runs this module in Node, where there's no storage to persist to.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          ...(isServer ? {} : { storage: AsyncStorage }),
          autoRefreshToken: !isServer,
          persistSession: !isServer,
          detectSessionInUrl: false,
          // No `lock`: supabase-js 2.107+ coordinates refreshes without one, and v3 removes the option.
        },
      })
    : null;

// Only refresh tokens while the app is in the foreground (Supabase's RN guidance).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const AVATAR_BUCKET = 'avatars';

/** The project's URL and publishable key (null in local mode), for the few Auth calls supabase-js has no method for. */
export const supabaseConfig = url && anonKey ? { url, anonKey } : null;

/**
 * A client that keeps its session in memory only and never touches the app's stored one, e.g. for a
 * password-reset link: setting the new password mustn't sign this device in (or swap the account
 * another tab has open). Null in local mode.
 */
export function createDetachedClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { storageKey: 'venu-detached', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
