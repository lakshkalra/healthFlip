export type GoalType = 'lose' | 'maintain' | 'gain';
export type MealSource = 'manual' | 'photo' | 'voice';
export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export type MacroTargets = { carbsGrams: number; fatGrams: number; proteinGrams: number };

/** Plan targets from a recommendation; null on goals set manually. */
export type PlanTargets = {
  dailyStepsTarget?: number | null;
  macroTargets?: MacroTargets | null;
  planRationale?: string | null;
};

export type Goal = PlanTargets & {
  dailyCalorieTarget: number;
  id: string;
  startsOn: string;
  type: GoalType;
};

export type Sex = 'female' | 'male' | 'unspecified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export type Profile = {
  activityLevel: ActivityLevel;
  age: number;
  heightCm: number;
  name: string;
  sex: Sex;
  weightKg: number;
};

export type PlanRecommendation = MacroTargets & {
  dailyCalorieTarget: number;
  dailySteps: number;
  rationale: string;
  source: 'ai' | 'fallback';
};

export type DietPlanOptions = {
  cuisine: string;
  days: 1 | 3 | 7;
  dietType: 'vegetarian' | 'non-vegetarian' | 'vegan' | 'eggetarian' | 'any';
  notes?: string;
  /** Shape the plan around the latest confirmed lab report. */
  useHealthNotes?: boolean;
};

export type ExercisePlanOptions = {
  daysPerWeek: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  location: 'home' | 'gym' | 'outdoors';
  minutesPerSession: number;
  notes?: string;
};

export type DietPlanContent = {
  dailyCalories: number;
  days: { label: string; meals: { calories: number; name: string; portion: string; proteinGrams: number; type: 'breakfast' | 'lunch' | 'snack' | 'dinner' }[] }[];
  macros: MacroTargets;
  summary: string;
  tips: string[];
  title: string;
};

export type ExercisePlanContent = {
  days: { durationMinutes: number; exercises: { detail: string; name: string }[]; focus: string; label: string; rest: boolean }[];
  summary: string;
  tips: string[];
  title: string;
};

export type PlanSource = 'ai' | 'fallback';

/** A generated plan before it is saved. */
export type PlanDraft =
  | { content: DietPlanContent; kind: 'diet'; options: DietPlanOptions; source: PlanSource }
  | { content: ExercisePlanContent; kind: 'exercise'; options: ExercisePlanOptions; source: PlanSource };

export type SavedPlan = PlanDraft & { createdAt: string; id: string; title: string };

export type PlanSummary = { createdAt: string; id: string; kind: 'diet' | 'exercise'; source: PlanSource; summary: string; title: string };

export type MemoryCategory = 'diet' | 'allergy' | 'preference' | 'routine' | 'goal' | 'other';

export type Memory = {
  category: MemoryCategory;
  createdAt: string;
  id: string;
  text: string;
};

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

export type ReportFlag = 'low' | 'normal' | 'high' | 'critical' | 'unknown';

export type ReportValue = {
  category: string;
  flag: ReportFlag;
  name: string;
  referenceRange: string | null;
  unit: string | null;
  value: string;
};

/** What Flip read from a lab report, for the user to review before anything is saved. */
export type ReportDraft = {
  hydration: { reason: string; suggestedLitres: number | null };
  nutritionNotes: string[];
  reportDate: string | null;
  summary: string;
  title: string;
  urgent: boolean;
  values: ReportValue[];
};

export type HealthReport = Omit<ReportDraft, 'hydration'> & { createdAt: string; id: string };

export type ReportSummary = {
  createdAt: string;
  flaggedCount: number;
  id: string;
  reportDate: string | null;
  title: string;
  urgent: boolean;
  valueCount: number;
};

export type WaterDay = { consumedMl: number; source: 'user' | 'report' | null; targetMl: number | null };

export type ReportFileType = ImageMimeType | 'application/pdf';
