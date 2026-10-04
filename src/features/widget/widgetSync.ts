import type { Dashboard } from '../../types';
import { macroTargets } from '../meals/meals';
import { updateWidget } from '../../services/native/healthFlipNative';

/** What the Home Screen widget shows; written to the shared App Group by the native module. */
export type WidgetSnapshot = {
  date: string;
  eatenKcal: number;
  macros: { carbs: [number, number]; fat: [number, number]; protein: [number, number] };
  nextReminder: string | null;
  nudge: string | null;
  targetKcal: number;
  updatedAt: string;
  water: { consumedMl: number; targetMl: number } | null;
};

export function widgetSnapshot(dashboard: Dashboard, target: number, nudge: string | null, nextReminder: Date | null): WidgetSnapshot {
  const sum = (key: 'proteinGrams' | 'carbsGrams' | 'fatGrams') => Math.round(dashboard.meals.reduce((total, meal) => total + (meal[key] ?? 0), 0));
  const goals = dashboard.goal?.macroTargets;
  const fallback = macroTargets(target);
  const water = dashboard.water?.targetMl ? { consumedMl: dashboard.water.consumedMl, targetMl: dashboard.water.targetMl } : null;
  return {
    date: dashboard.date,
    eatenKcal: dashboard.totalCalories,
    macros: {
      carbs: [sum('carbsGrams'), goals?.carbsGrams ?? fallback.c],
      fat: [sum('fatGrams'), goals?.fatGrams ?? fallback.f],
      protein: [sum('proteinGrams'), goals?.proteinGrams ?? fallback.p],
    },
    nextReminder: water && nextReminder ? nextReminder.toISOString() : null,
    nudge,
    targetKcal: target,
    updatedAt: new Date().toISOString(),
    water,
  };
}

/** Pushes today's numbers to the widget; failures never affect the app. */
export function syncWidget(dashboard: Dashboard | null, target: number, nudge: string | null, nextReminder: Date | null): void {
  if (!dashboard) return;
  updateWidget(widgetSnapshot(dashboard, target, nudge, nextReminder)).catch(() => undefined);
}

/** No account data yet (onboarding, or after a reset): the widget asks you to open the app instead
 * of showing numbers from an earlier account or server. */
export function clearWidget(): void {
  updateWidget(null).catch(() => undefined);
}
