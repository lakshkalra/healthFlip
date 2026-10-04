import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatNumber } from '../../utils/format';
import type { Meal } from '../../types';
import { Banner, IconTile, Overlay, PillButton, styles as ui } from '../../components/ui';
import { colors } from '../../constants/theme';

export function DeleteMealDialog({ visible, meal, onCancel, onDelete }: { visible: boolean; meal: Meal | null; onCancel: () => void; onDelete: () => Promise<void> }) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'fail'>('idle');
  const deleting = status === 'deleting';
  async function confirm() {
    if (deleting) return;
    setStatus('deleting');
    try {
      await onDelete();
    } catch {
      setStatus('fail');
    }
  }
  return (
    <Overlay visible={visible && !!meal} variant="dialog" onClose={() => !deleting && onCancel()}>
      <IconTile name="trash" bg={colors.dangerBg} fg={colors.danger} size={52} radius={26} iconSize={24} />
      <Text style={screen.dialogTitle}>Delete this meal?</Text>
      <Text style={screen.body}>
        <Text style={screen.bold}>{meal?.name}</Text> ({formatNumber(meal?.caloriesKcal ?? 0)} kcal) will be removed from today's progress.
      </Text>
      {status === 'fail' ? <Banner message="Couldn't delete right now. The meal is still saved." /> : null}
      <View style={screen.dialogActions}>
        <PillButton title="Cancel" variant="muted" height={54} style={ui.flex} onPress={() => !deleting && onCancel()} />
        <PillButton title={status === 'fail' ? 'Try again' : 'Delete'} variant="danger" height={54} busy={deleting} busyLabel="Deleting…" style={ui.flex} onPress={confirm} />
      </View>
    </Overlay>
  );
}

// ---------- Styles ----------

const screen = StyleSheet.create({
  bold: { color: colors.ink, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  dialogTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
