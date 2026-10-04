import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type MealType, mealTypeLabel } from '../../features/meals/meals';
import { formatNumber, formatTime } from '../../utils/format';
import type { Meal } from '../../types';
import { Card, Icon, MealTypeTile, PillButton, RoundIconButton, styles as ui } from '../../components/ui';
import { colors } from '../../constants/theme';

export function MealDetailScreen({ meal, type, target, editable, onBack, onEdit, onDelete }: { meal: Meal; type: MealType; target: number; editable: boolean; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  const insets = useSafeAreaInsets();
  const cal = meal.caloriesKcal ?? 0;
  const time = formatTime(meal.loggedAt);
  const grams = (value: number | null) => (value === null ? '—' : `${value} g`);
  const macros: [string, number | null, string][] = [
    ['Protein', meal.proteinGrams, colors.protein],
    ['Carbs', meal.carbsGrams, colors.carbs],
    ['Fat', meal.fatGrams, colors.fat],
  ];
  return (
    <ScrollView contentContainerStyle={[screen.detail, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <View style={screen.detailHeader}>
        <RoundIconButton name="arrowLeft" label="Back" iconSize={20} stroke={2.6} onPress={onBack} />
        <Text style={screen.headline}>Meal details</Text>
        <View style={screen.spacer44} />
      </View>
      <View style={screen.hero}>
        <View style={screen.rowCenter10}>
          <MealTypeTile type={type} size={40} radius={13} iconSize={20} />
          <Text style={screen.kickerText}>
            {mealTypeLabel(type)} · {time}
          </Text>
        </View>
        <Text style={screen.detailName}>{meal.name}</Text>
        <View style={screen.detailCalRow}>
          <Text style={screen.detailCal}>{formatNumber(cal)}</Text>
          <Text style={screen.detailUnit}>kcal</Text>
          <Text style={screen.detailShare}>{Math.round((cal / target) * 100)}% of daily target</Text>
        </View>
      </View>
      <View style={screen.row10}>
        {macros.map(([label, value, color]) => (
          <View key={label} style={screen.macroCard}>
            <View style={[screen.dot, { backgroundColor: color }]} />
            <View>
              <Text style={screen.macroCardValue}>{grams(value)}</Text>
              <Text style={screen.mealTime}>{label}</Text>
            </View>
          </View>
        ))}
      </View>
      <Card style={screen.noteCard}>
        <Text style={screen.noteLabel}>Note</Text>
        <Text style={[screen.noteText, !meal.note && { color: colors.faint }]}>{meal.note || 'No note added'}</Text>
      </Card>
      <View style={screen.loggedRow}>
        <Icon name="clock" size={14} color={colors.muted2} />
        <Text style={screen.mealTime}>
          Logged {meal.source === 'manual' ? 'manually' : `via ${meal.source}`} at {time}
        </Text>
      </View>
      <View style={ui.flex} />
      {editable ? (
        <View style={screen.gap10}>
          <PillButton title="Edit meal" variant="dark" icon="pencil" onPress={onEdit} />
          <PillButton title="Delete meal" variant="light" icon="trash" onPress={onDelete} />
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------- Pages 3 & 5 · Add / edit meal sheet ----------

const screen = StyleSheet.create({
  row10: { flexDirection: 'row', gap: 10 },
  rowCenter10: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  gap10: { gap: 10 },
  spacer44: { width: 44 },
  headline: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  hero: { backgroundColor: colors.lime, borderRadius: 28, gap: 16, padding: 20 },
  kickerText: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  mealTime: { color: colors.muted2, fontSize: 12 },
  detail: { flexGrow: 1, gap: 14, paddingHorizontal: 18 },
  detailHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  detailName: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32 },
  detailCalRow: { alignItems: 'baseline', flexDirection: 'row', gap: 6 },
  detailCal: { color: colors.ink, fontSize: 44, fontWeight: '800', letterSpacing: -1.3, lineHeight: 46 },
  detailUnit: { color: colors.greenDark, fontSize: 16, fontWeight: '600' },
  detailShare: { color: colors.greenDark, fontSize: 13, marginLeft: 'auto' },
  macroCard: { backgroundColor: colors.white, borderRadius: 20, flex: 1, gap: 10, padding: 14 },
  macroCardValue: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  dot: { borderRadius: 5, height: 10, width: 10 },
  noteCard: { borderRadius: 20, gap: 6 },
  noteLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  noteText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  loggedRow: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
});
