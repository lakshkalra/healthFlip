import { getDayRangeUtc } from '../../shared/time.js';
import type { GoalRepository } from '../goals/goal.repository.js';
import { serializeMeal } from '../meals/meal.service.js';
import type { MealRepository } from '../meals/meal.repository.js';

export function createDashboardService(
  goalRepository: GoalRepository,
  mealRepository: MealRepository,
) {
  return {
    async getDaily(guestId: string, date: string, timeZone: string) {
      const range = getDayRangeUtc(date, timeZone);
      const [goal, summary] = await Promise.all([
        goalRepository.findCurrent(guestId),
        mealRepository.getDailySummary(guestId, range.start, range.end),
      ]);

      const dailyCalorieTarget = goal?.dailyCalorieTarget ?? null;

      return {
        date,
        goal: goal
          ? {
              dailyCalorieTarget,
              id: goal.id,
              type: goal.type,
            }
          : null,
        meals: summary.meals.map(serializeMeal),
        remainingCalories:
          dailyCalorieTarget === null ? null : dailyCalorieTarget - summary.totalCalories,
        timezone: timeZone,
        totalCalories: summary.totalCalories,
      };
    },
  };
}
