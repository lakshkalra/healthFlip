import { notFound } from '../../shared/errors.js';
import type { ReplaceGoalInput } from './goal.schema.js';
import type { GoalRepository } from './goal.repository.js';

export function createGoalService(goalRepository: GoalRepository) {
  return {
    async getCurrent(guestId: string) {
      const goal = await goalRepository.findCurrent(guestId);
      return goal ? serializeGoal(goal) : null;
    },

    async replaceCurrent(guestId: string, input: ReplaceGoalInput) {
      const goal = await goalRepository.replaceCurrent(guestId, {
        ...input,
        startsOn: input.startsOn ?? currentDate(),
      });

      if (!goal) {
        throw notFound('Goal');
      }

      return serializeGoal(goal);
    },
  };
}

function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function serializeGoal(goal: {
  createdAt: Date;
  dailyCalorieTarget: number;
  id: string;
  startsOn: string;
  type: 'lose' | 'maintain' | 'gain';
}) {
  return {
    createdAt: goal.createdAt.toISOString(),
    dailyCalorieTarget: goal.dailyCalorieTarget,
    id: goal.id,
    startsOn: goal.startsOn,
    type: goal.type,
  };
}
