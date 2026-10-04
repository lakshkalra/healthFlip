import { Pressable, Text, View } from 'react-native';
import { mealCalories, type MealType } from '../../features/meals/meals';
import { formatNumber, formatTime } from '../../utils/format';
import type { Meal } from '../../types';
import { RoundIconButton } from './Button';
import { Icon, IconTile, MealTypeTile } from './Icon';
import { Card } from './Layout';
import { styles } from './styles';
import { colors } from '../../constants/theme';

/** Meals of one type. Pass onOpenMeal / onAdd for the interactive dashboard, omit them for read-only history. */
export function MealGroupCard({ type, label, meals, onOpenMeal, onAdd, emptyLabel }: { type: MealType; label: string; meals: Meal[]; onOpenMeal?: (meal: Meal) => void; onAdd?: () => void; emptyLabel?: string }) {
  if (!meals.length) {
    return onAdd ? (
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.emptyGroup, pressed && styles.whiteBg]}>
        <MealTypeTile type={type} />
        <View style={styles.grow}>
          <Text style={styles.groupTitle}>{label}</Text>
          <Text style={styles.small}>{emptyLabel}</Text>
        </View>
        <IconTile name="plus" bg={colors.limeBright} fg={colors.ink} size={36} radius={18} iconSize={18} stroke={2.6} />
      </Pressable>
    ) : (
      <View style={styles.emptyGroup}>
        <Text style={[styles.groupTitle, styles.grow, { color: colors.muted }]}>{label}</Text>
        <Text style={styles.mealTime}>Not logged</Text>
      </View>
    );
  }
  return (
    <Card style={onOpenMeal ? styles.gap8 : styles.gap6}>
      <View style={styles.rowCenter12}>
        <MealTypeTile type={type} />
        <View style={styles.grow}>
          <Text style={styles.groupTitle}>{label}</Text>
          <Text style={styles.small}>
            {formatNumber(mealCalories(meals))} kcal · {meals.length} {meals.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        {onAdd ? <RoundIconButton name="plus" label={`Add to ${label}`} bg={colors.bg} size={36} iconSize={18} stroke={2.6} onPress={onAdd} /> : null}
      </View>
      <View style={styles.mealList}>
        {meals.map(meal => (
          <Pressable key={meal.id} disabled={!onOpenMeal} onPress={() => onOpenMeal?.(meal)} style={({ pressed }) => [styles.mealRow, !onOpenMeal && styles.mealRowStatic, pressed && { backgroundColor: colors.bg }]}>
            <View style={styles.grow}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealTime}>{formatTime(meal.loggedAt)}</Text>
            </View>
            <Text style={styles.mealCal}>{formatNumber(meal.caloriesKcal ?? 0)} kcal</Text>
            {onOpenMeal ? <Icon name="chevronRight" size={16} color={colors.faint} stroke={2.6} /> : null}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

// ---------- Small layout helpers ----------
