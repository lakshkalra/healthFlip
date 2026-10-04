import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { Tab } from '../types';

const NAV_TABS: { tab: Tab; icon: IconName; label: string }[] = [
  { tab: 'home', icon: 'home', label: 'Home' },
  { tab: 'progress', icon: 'chart', label: 'Progress' },
  { tab: 'plans', icon: 'calendarCheck', label: 'Plans' },
  { tab: 'tips', icon: 'lightbulb', label: 'Tips' },
];

export function BottomNav({ activeTab, onNavigate, onAdd }: { activeTab: Tab; onNavigate: (tab: Tab) => void; onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[screen.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <NavItem {...NAV_TABS[0]} active={activeTab === 'home'} onPress={onNavigate} />
      <NavItem {...NAV_TABS[1]} active={activeTab === 'progress'} onPress={onNavigate} />
      <View style={screen.navItem}>
        <Pressable accessibilityLabel="Log a meal" accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [screen.fab, pressed && screen.fabPressed]}>
          <Icon name="plus" size={26} stroke={2.8} />
        </Pressable>
      </View>
      <NavItem {...NAV_TABS[2]} active={activeTab === 'plans'} onPress={onNavigate} />
      <NavItem {...NAV_TABS[3]} active={activeTab === 'tips'} onPress={onNavigate} />
    </View>
  );
}

function NavItem({ tab, icon, label, active, onPress }: { tab: Tab; icon: IconName; label: string; active: boolean; onPress: (tab: Tab) => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onPress(tab)} style={screen.navItem}>
      <View style={[screen.navIcon, active && screen.navIconOn]}><Icon name={icon} size={21} color={active ? colors.ink : '#8a8f82'} /></View>
      <Text style={[screen.navLabel, active && screen.navActive]}>{label}</Text>
      <View style={[screen.navDot, active && screen.navDotOn]} />
    </Pressable>
  );
}

// ---------- Page 4 · Meal detail ----------

const screen = StyleSheet.create({
  fabPressed: { transform: [{ scale: 0.95 }] },
  nav: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, bottom: 0, boxShadow: '0 -4px 20px rgba(0,0,0,.05)', flexDirection: 'row', left: 0, paddingTop: 12, position: 'absolute', right: 0 },
  navItem: { alignItems: 'center', flex: 1, gap: 3 },
  navIcon: { alignItems: 'center', borderRadius: 14, height: 30, justifyContent: 'center', width: 48 },
  navIconOn: { backgroundColor: colors.selected },
  navLabel: { color: colors.disabled, fontSize: 11 },
  navActive: { color: colors.ink, fontWeight: '700' },
  navDot: { backgroundColor: 'transparent', borderRadius: 3, height: 5, width: 5 },
  navDotOn: { backgroundColor: colors.green },
  fab: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 29, boxShadow: '0 0 0 6px #fff, 0 8px 18px rgba(127,191,42,.45)', height: 58, justifyContent: 'center', marginTop: -26, width: 58 },
});
