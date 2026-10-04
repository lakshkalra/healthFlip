import type { ImageMimeType, MealItem, MealType } from '../../types';
import { dateKey } from '../../utils/date';
import { ensureGuest, request } from './http';

export type AiMealEstimate = {
  assumptions: string[];
  caloriesKcal: number;
  carbsGrams: number | null;
  confidence: 'low' | 'medium' | 'high';
  fatGrams: number | null;
  /** A short food-level note tied to the user's lab report, when relevant. */
  healthTip?: string | null;
  /** Each distinct item to confirm; older servers may omit it. */
  items?: MealItem[];
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

export async function estimateMealFromImage(imageBase64: string, mimeType: ImageMimeType, mealType: MealType): Promise<AiMealEstimate> {
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
