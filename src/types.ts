export type GoalType = 'lose' | 'maintain' | 'gain';
export type MealSource = 'manual' | 'photo' | 'voice';

export type Goal = {
  dailyCalorieTarget: number;
  id: string;
  startsOn: string;
  type: GoalType;
};

export type Meal = {
  caloriesKcal: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  id: string;
  loggedAt: string;
  name: string;
  note: string | null;
  proteinGrams: number | null;
  source: MealSource;
};

export type Dashboard = {
  date: string;
  goal: { dailyCalorieTarget: number; id: string; type: GoalType } | null;
  meals: Meal[];
  remainingCalories: number | null;
  totalCalories: number;
  timezone: string;
};
