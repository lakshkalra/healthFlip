import type { GoalType, Meal } from './types';

export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'dinner', label: 'Dinner' },
];

export const GOALS: { id: GoalType; label: string; desc: string }[] = [
  { id: 'lose', label: 'Lose weight', desc: 'Eat a little under what you burn' },
  { id: 'maintain', label: 'Maintain weight', desc: 'Stay steady where you are' },
  { id: 'gain', label: 'Gain weight', desc: 'Fuel up to build' },
];

export type Food = { name: string; serving: string; cal: number; p: number; c: number; f: number; saved?: boolean };

/** A meal confirmed from a Flip estimate, as a "Pick from list" option (the form takes whole grams). */
export function foodFromSaved(food: { caloriesKcal: number; carbsGrams: number | null; fatGrams: number | null; name: string; proteinGrams: number | null; serving: string }): Food {
  const grams = (value: number | null) => Math.round(value ?? 0);
  return { c: grams(food.carbsGrams), cal: food.caloriesKcal, f: grams(food.fatGrams), name: food.name, p: grams(food.proteinGrams), saved: true, serving: food.serving };
}

const food = (name: string, serving: string, cal: number, p: number, c: number, f: number): Food => ({ name, serving, cal, p, c, f });

export const FOODS: Food[] = [
  food('Poha with peanuts', '1 plate', 320, 8, 52, 9),
  food('Masala chai', '1 cup', 90, 3, 12, 3),
  food('Idli with sambar', '3 idli', 290, 10, 54, 4),
  food('Masala dosa', '1 dosa', 410, 9, 58, 16),
  food('Dal rice with salad', '1 plate', 520, 18, 82, 12),
  food('Rajma chawal', '1 plate', 480, 17, 80, 9),
  food('Roti with mixed sabzi', '2 roti', 360, 10, 52, 12),
  food('Paneer tikka wrap', '1 wrap', 430, 24, 38, 18),
  food('Chicken biryani', '1 plate', 620, 30, 72, 22),
  food('Butter chicken with naan', '1 plate', 1150, 48, 96, 58),
  food('Oatmeal with banana', '1 bowl', 300, 9, 54, 6),
  food('Avocado toast', '2 slices', 340, 9, 32, 20),
  food('Grilled chicken salad', '1 bowl', 380, 36, 14, 20),
  food('Pasta arrabbiata', '1 plate', 520, 16, 88, 12),
  food('Greek yogurt with berries', '1 bowl', 160, 14, 20, 3),
  food('Boiled eggs', '2 eggs', 140, 12, 1, 10),
  food('Apple', '1 medium', 95, 0, 25, 0),
];

/** Meal type for the current (or given) hour, used as the default chip and as a fallback. */
export function typeForHour(hour = new Date().getHours()): MealType {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 19 ? 'snacks' : 'dinner';
}

export function mealTypeOf(meal: Meal, saved: Record<string, MealType>): MealType {
  return meal.mealType ?? saved[meal.id] ?? typeForHour(new Date(meal.loggedAt).getHours());
}

export function mealTypeLabel(type: MealType): string {
  return MEAL_TYPES.find(t => t.id === type)?.label ?? 'Meal';
}

export function goalLabel(type: GoalType | undefined): string {
  return GOALS.find(g => g.id === type)?.label ?? '';
}

/** Macro targets derived 30/40/30 from the calorie target. */
export function macroTargets(target: number) {
  return { p: Math.round((target * 0.3) / 4), c: Math.round((target * 0.4) / 4), f: Math.round((target * 0.3) / 9) };
}

export const isWholeNumber = (value: string) => /^\d+$/.test(value.trim());
export const formatNumber = (value: number) => Number(value).toLocaleString('en-US');
export const formatTime = (value: string | number) =>
  new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Local calendar date as YYYY-MM-DD (toISOString() would give the UTC date). */
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Noon on the given YYYY-MM-DD, safe from DST edges. */
export const parseDateKey = (key: string) => new Date(`${key}T12:00:00`);

export function daysAgo(count: number, from = new Date()): Date {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - count);
  return date;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;
export const mealCalories = (meals: Meal[]) => meals.reduce((total, meal) => total + (meal.caloriesKcal ?? 0), 0);
