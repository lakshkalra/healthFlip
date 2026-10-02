import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, PillButton, colors, styles as ui } from './ui';

/** Page 10 · Rewards: a "coming soon" placeholder tab. */
export function RewardsScreen({ onHome }: { onHome: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ui.tabContent, styles.screen, { paddingTop: insets.top + 14 }]}>
      <Text style={ui.screenTitle}>Rewards</Text>
      <View style={styles.center}>
        <View style={styles.art}>
          <View style={styles.blob} />
          <View style={styles.dotLime} />
          <View style={styles.dotBlue} />
          <View style={styles.icon}>
            <Icon name="gift" size={58} color="#c27a12" stroke={2.2} />
          </View>
        </View>
        <Text style={styles.badge}>Coming soon</Text>
        <Text style={styles.title}>Rewards are coming soon</Text>
        <Text style={styles.body}>
          We're building rewards that celebrate steady habits, like logging regularly and staying close to your daily target. They'll show up here once they're ready.
        </Text>
        <PillButton title="Back to home" height={52} style={styles.cta} onPress={onHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  center: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center' },
  art: { height: 156, position: 'relative', width: 156 },
  blob: { backgroundColor: colors.carbsBg, borderRadius: 78, bottom: 14, left: 14, position: 'absolute', right: 14, top: 14 },
  dotLime: { backgroundColor: colors.lime, borderRadius: 15, height: 30, position: 'absolute', right: 4, top: 8, width: 30 },
  dotBlue: { backgroundColor: colors.fatBg, borderRadius: 9, bottom: 18, height: 18, left: 2, position: 'absolute', width: 18 },
  icon: { alignItems: 'center', bottom: 14, justifyContent: 'center', left: 14, position: 'absolute', right: 14, top: 14 },
  badge: { backgroundColor: colors.pale, borderRadius: 99, color: colors.greenDark, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 5 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 29, textAlign: 'center' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, maxWidth: 290, textAlign: 'center' },
  cta: { paddingHorizontal: 28 },
});
