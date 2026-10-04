import type { SavedFood } from '../../types';
import { ensureGuest, request } from './http';

export async function listFoods(): Promise<SavedFood[]> {
  await ensureGuest();
  return (await request<{ foods: SavedFood[] }>('/v1/foods')).foods ?? [];
}

/** Saves a confirmed meal for "Pick from list"; the same name refreshes the existing entry. */
export async function saveFood(food: { caloriesKcal: number; carbsGrams?: number | null; fatGrams?: number | null; name: string; proteinGrams?: number | null; serving?: string }): Promise<SavedFood> {
  await ensureGuest();
  return (await request<{ food: SavedFood }>('/v1/foods', { body: JSON.stringify(food), method: 'POST' })).food;
}

export async function deleteFood(id: string): Promise<void> {
  await ensureGuest();
  await request<void>(`/v1/foods/${id}`, { method: 'DELETE' });
}
