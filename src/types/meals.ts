import type { GoalType, PlanTargets } from './goals';
import type { ReportSummary, WaterDay } from './health';

export type MealSource = 'manual' | 'photo' | 'voice';

export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export type Meal = {
  caloriesKcal: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  id: string;
  loggedAt: string;
  mealType: MealType;
  name: string;
  note: string | null;
  proteinGrams: number | null;
  source: MealSource;
};

export type Dashboard = {
  date: string;
  goal: (PlanTargets & { dailyCalorieTarget: number; id: string; type: GoalType }) | null;
  /** Newest confirmed lab report, for the Home "Health" row; older servers omit it. */
  latestReport?: ReportSummary | null;
  meals: Meal[];
  remainingCalories: number | null;
  totalCalories: number;
  timezone: string;
  water?: WaterDay;
};

/** Meal photo formats the API accepts (iPhones save HEIC/HEIF). */
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif';

/** One food or drink in an AI estimate, with an approximate edible weight. */
export type MealItem = {
  caloriesKcal: number;
  carbsGrams: number | null;
  fatGrams: number | null;
  grams: number;
  name: string;
  proteinGrams: number | null;
};

/** A meal the guest confirmed from a Flip estimate, offered again in "Pick from list". */
export type SavedFood = {
  caloriesKcal: number;
  carbsGrams: number | null;
  fatGrams: number | null;
  id: string;
  lastUsedAt: string;
  name: string;
  proteinGrams: number | null;
  serving: string;
  timesUsed: number;
};
