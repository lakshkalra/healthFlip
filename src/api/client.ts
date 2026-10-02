import type { Dashboard, Goal, GoalType, Meal } from '../types';
import { dateKey } from '../meals';
import { getGuestToken, saveGuestToken } from '../storage/session';

const API_BASE_URL = __DEV__ ? 'http://10.0.2.2:3000' : 'https://healthflip-api.vercel.app';

type ApiErrorPayload = { error?: { message?: string } };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getGuestToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error?.message ?? 'Something went wrong.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function ensureGuest(): Promise<void> {
  if (await getGuestToken()) {
    return;
  }

  const response = await request<{ accessToken: string }>('/v1/guests', { method: 'POST' });
  await saveGuestToken(response.accessToken);
}

export async function getCurrentGoal(): Promise<Goal | null> {
  await ensureGuest();
  const response = await request<{ goal: Goal | null }>('/v1/goals/current');
  return response.goal;
}

export async function saveGoal(input: { dailyCalorieTarget: number; type: GoalType }): Promise<Goal> {
  await ensureGuest();
  const response = await request<{ goal: Goal }>('/v1/goals/current', {
    body: JSON.stringify({ ...input, startsOn: dateKey() }),
    method: 'PUT',
  });
  return response.goal;
}

/** Daily dashboard for a local calendar date (defaults to today). */
export async function getDashboard(date = dateKey()): Promise<Dashboard> {
  await ensureGuest();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const response = await request<{ dashboard: Dashboard }>(
    `/v1/dashboard/daily?date=${date}&timezone=${encodeURIComponent(timezone)}`,
  );
  return response.dashboard;
}

export async function createMeal(input: MealInput): Promise<Meal> {
  await ensureGuest();
  const response = await request<{ meal: Meal }>('/v1/meals', {
    body: JSON.stringify({ ...input, loggedAt: new Date().toISOString(), source: 'manual' }),
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
};
