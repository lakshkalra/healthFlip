import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatLitres } from '../../features/reminders/waterReminders';
import type { ReportSummary, WaterDay } from '../../types';
import { Icon, IconTile } from '../ui';
import { colors } from '../../constants/theme';

export type HomeHealthActions = {
  nextReminder: Date | null;
  onAddWater: (ml: number) => void;
  onOpenReports: (reportId?: string) => void;
  onUndoWater: () => void;
  onWaterSettings: () => void;
  waterBusy: boolean;
};

/** Home row for lab reports: an upload prompt, or the latest report at a glance. */
export function HealthRow({ report, onOpen }: { report: ReportSummary | null | undefined; onOpen: (reportId?: string) => void }) {
  if (!report) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Upload a test report" onPress={() => onOpen()} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <IconTile name="chart" bg={colors.pale} fg={colors.greenDark} size={38} radius={12} iconSize={18} />
        <View style={styles.grow}>
          <Text style={styles.title}>Upload a test report</Text>
          <Text style={styles.small}>Flip tailors your meals to your lab results</Text>
        </View>
        <Icon name="plus" size={18} color={colors.greenDark} stroke={2.6} />
      </Pressable>
    );
  }
  const when = new Date(report.reportDate ? `${report.reportDate}T12:00:00` : report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${report.title}`} onPress={() => onOpen(report.id)} style={({ pressed }) => [styles.row, report.urgent && styles.rowUrgent, pressed && styles.pressed]}>
      <IconTile name={report.urgent ? 'alert' : 'chart'} bg={report.urgent ? colors.dangerBg : colors.pale} fg={report.urgent ? colors.dangerText : colors.greenDark} size={38} radius={12} iconSize={18} />
      <View style={styles.grow}>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.small}>{when} · {report.flaggedCount ? `${report.flaggedCount} ${report.flaggedCount === 1 ? 'value' : 'values'} to watch` : 'all in range'}</Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} />
    </Pressable>
  );
}

/** Daily water progress with quick add (+250 ml, long-press +500 ml), undo and reminder settings. */
export function WaterCard({ actions, water }: { actions: HomeHealthActions; water: WaterDay }) {
  if (!water.targetMl) return null;
  const pct = Math.min(1, water.consumedMl / water.targetMl);
  const done = water.consumedMl >= water.targetMl;
  const next = actions.nextReminder?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <View style={styles.water}>
      <View style={styles.waterTop}>
        <IconTile name="droplet" bg="#dcefff" fg="#1f6fb2" size={38} radius={12} iconSize={18} />
        <View style={styles.grow}>
          <Text style={styles.title} accessibilityLabel={`Water ${formatLitres(water.consumedMl)} of ${formatLitres(water.targetMl)} litres`} accessible>
            {formatLitres(water.consumedMl)} <Text style={styles.unit}>/ {formatLitres(water.targetMl)} L water</Text>
          </Text>
          <Text style={styles.small}>{done ? 'Goal reached. Nicely done!' : next ? `Next reminder ${next}` : 'Sip through the day'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Water reminder settings" hitSlop={8} onPress={actions.onWaterSettings} style={styles.more}>
          <Text style={styles.moreText}>•••</Text>
        </Pressable>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
      <View style={styles.waterActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add 250 ml of water" accessibilityHint="Long press to add 500 ml" disabled={actions.waterBusy} onPress={() => actions.onAddWater(250)} onLongPress={() => actions.onAddWater(500)} style={({ pressed }) => [styles.add, pressed && styles.pressed, actions.waterBusy && styles.busy]}>
          <Icon name="plus" size={16} color={colors.white} stroke={2.8} />
          <Text style={styles.addText}>250 ml</Text>
        </Pressable>
        {water.consumedMl > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Undo last water" disabled={actions.waterBusy} onPress={actions.onUndoWater} style={styles.undo}>
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: 2, minWidth: 0 },
  row: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowUrgent: { borderColor: colors.dangerBg, borderWidth: 1.5 },
  pressed: { opacity: 0.75 },
  busy: { opacity: 0.5 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  unit: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  water: { backgroundColor: colors.white, borderRadius: 20, gap: 10, padding: 14 },
  waterTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  more: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  moreText: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  track: { backgroundColor: '#e7f2fb', borderRadius: 5, height: 10, overflow: 'hidden' },
  fill: { backgroundColor: '#3b8fd6', borderRadius: 5, height: 10 },
  waterActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  add: { alignItems: 'center', backgroundColor: '#1f6fb2', borderRadius: 16, flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  addText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  undo: { paddingHorizontal: 8, paddingVertical: 8 },
  undoText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
