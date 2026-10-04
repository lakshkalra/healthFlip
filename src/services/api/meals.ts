import type { Meal } from '../../types';
import { ensureGuest, request } from './http';

export async function createMeal(input: MealInput): Promise<Meal> {
  await ensureGuest();
  const response = await request<{ meal: Meal }>('/v1/meals', {
    body: JSON.stringify({ ...input, loggedAt: new Date().toISOString(), source: input.source ?? 'manual' }),
    method: 'POST',
  });
  return response.meal;
}

export async function updateMeal(mealId: string, input: Partial<MealInput>): Promise<Meal> {
  await ensureGuest();
  const response = await request<{ meal: Meal }>(`/v1/meals/${mealId}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
  return response.meal;
}

export async function deleteMeal(mealId: string): Promise<void> {
  await ensureGuest();
  await request<void>(`/v1/meals/${mealId}`, { method: 'DELETE' });
}

export type MealInput = {
  caloriesKcal: number;
  carbsGrams?: number;
  fatGrams?: number;
  mealType: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  name: string;
  note?: string;
  proteinGrams?: number;
  source?: 'manual' | 'photo' | 'voice';
};
