import { Href, Redirect, router, Slot, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TabBar, type Tab } from '@/components/tab-bar';
import { Colors } from '@/constants/theme';
import { useProfile } from '@/features/profile/profile-context';

const TAB_ROUTES: Record<Tab, Href> = {
  venue:     '/venue',
  volunteer: '/volunteer',
  profile:   '/profile',
};

function pathnameToTab(pathname: string): Tab {
  if (pathname.includes('volunteer')) return 'volunteer';
  if (pathname.includes('profile')) return 'profile';
  return 'venue';
}

export default function TabsLayout() {
  const pathname = usePathname();
  const { status, profile } = useProfile();
  const activeTab = pathnameToTab(pathname);

  function handleTabPress(tab: Tab) {
    router.replace(TAB_ROUTES[tab]);
  }

  if (status === 'loading') return null;
  // Session ended (signed out elsewhere, token expired) or couldn't load: back through the entry gate.
  if (status !== 'ready') return <Redirect href="/" />;
  // Signed in but never finished setup (e.g. a deep link to /volunteer): set up first.
  if (!profile) return <Redirect href="/onboarding/role" />;

  return (
    <View style={styles.root}>
      {/* Current tab screen */}
      <View style={styles.screen}>
        <Slot />
      </View>

      {/* Floating nav bar */}
      <TabBar active={activeTab} onPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  screen: { flex: 1 },
});
