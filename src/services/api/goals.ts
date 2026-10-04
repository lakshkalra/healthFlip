import type { Goal, GoalType } from '../../types';
import { dateKey } from '../../utils/date';
import { ensureGuest, request } from './http';

export async function getCurrentGoal(): Promise<Goal | null> {
  await ensureGuest();
  const response = await request<{ goal: Goal | null }>('/v1/goals/current');
  return response.goal;
}

export type GoalInput = {
  carbsTargetGrams?: number | null;
  dailyCalorieTarget: number;
  dailyStepsTarget?: number | null;
  fatTargetGrams?: number | null;
  planRationale?: string | null;
  proteinTargetGrams?: number | null;
  type: GoalType;
};

export async function saveGoal(input: GoalInput): Promise<Goal> {
  await ensureGuest();
  const response = await request<{ goal: Goal }>('/v1/goals/current', {
    body: JSON.stringify({ ...input, startsOn: dateKey() }),
    method: 'PUT',
  });
  return response.goal;
}
