import { NativeModules, Platform } from 'react-native';
import type { Dashboard, Goal, GoalType, Meal, MealType } from '../types';
import { dateKey } from '../meals';
import { getGuestToken, saveGuestToken } from '../storage/session';

// A bundled Debug build has a file:// script URL, so it cannot discover Metro's
// host at runtime. Keep the local iPhone fallback on the Mac's current Wi-Fi IP.
const metroHost = NativeModules.SourceCode?.getConstants?.().scriptURL?.match(/^https?:\/\/([^/:]+)/)?.[1];
const developmentHost = Platform.OS === 'android' ? '10.0.2.2' : metroHost ?? '192.168.0.5';
const API_BASE_URL = __DEV__ ? `http://${developmentHost}:3000` : 'https://healthflip-api.vercel.app';

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

export type AiMealEstimate = {
  assumptions: string[];
  caloriesKcal: number;
  carbsGrams: number | null;
  confidence: 'low' | 'medium' | 'high';
  fatGrams: number | null;
  name: string;
  proteinGrams: number | null;
  source: 'ai' | 'fallback';
};

export type DailyInsight = {
  date: string;
  message: string;
  nextAction: string;
  source: 'ai' | 'fallback';
};

export type LiveSession = {
  expiresAt: string;
  model: string;
  token: string;
  websocketUrl: string;
};

export async function estimateMeal(description: string, mealType: MealType): Promise<AiMealEstimate> {
  await ensureGuest();
  const response = await request<{ estimate: AiMealEstimate }>('/v1/ai/meal-estimate', {
    body: JSON.stringify({ description, mealType }),
    method: 'POST',
  });
  return response.estimate;
}

export async function estimateMealFromImage(imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp', mealType: MealType): Promise<AiMealEstimate> {
  await ensureGuest();
  const response = await request<{ estimate: AiMealEstimate }>('/v1/ai/meal-estimate-image', {
    body: JSON.stringify({ imageBase64, mealType, mimeType }),
    method: 'POST',
  });
  return response.estimate;
}

export async function getDailyInsight(date = dateKey()): Promise<DailyInsight> {
  await ensureGuest();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const response = await request<{ insight: DailyInsight }>(
    `/v1/ai/daily-insight?date=${date}&timezone=${encodeURIComponent(timezone)}`,
  );
  return response.insight;
}

export async function createLiveSession(date = dateKey()): Promise<LiveSession> {
  await ensureGuest();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const response = await request<{ session: LiveSession }>('/v1/ai/live-session', {
    body: JSON.stringify({ date, timezone }),
    method: 'POST',
  });
  return response.session;
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
