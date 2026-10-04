import type { MacroTargets } from './goals';

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
