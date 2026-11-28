import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/wordmark';
import { Colors, Spacing } from '@/constants/theme';
import { useT } from '@/i18n';

/** How long a load may take before the screen shows it's loading, so a quick load doesn't flash. */
export const LOADING_SCREEN_DELAY_MS = 250;

/**
 * What a screen shows while the session loads, instead of a blank page. Supabase can take
 * several seconds to give up when the server can't be reached, before "Can't reach VenU" shows.
 * e.g. if (status === 'loading') return <LoadingScreen />;
 */
export function LoadingScreen() {
  const t = useT('common');
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), LOADING_SCREEN_DELAY_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={styles.root} accessibilityLabel={shown ? t('status.loading') : undefined} accessibilityLiveRegion="polite">
      {shown ? (
        <>
          <LogoMark size={80} />
          <ActivityIndicator size="large" color={Colors.primary} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, backgroundColor: Colors.bg },
});
