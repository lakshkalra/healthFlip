

export type GoalType = 'lose' | 'maintain' | 'gain';

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

export type PlanRecommendation = MacroTargets & {
  dailyCalorieTarget: number;
  dailySteps: number;
  rationale: string;
  source: 'ai' | 'fallback';
};
