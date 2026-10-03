import { NativeModules, Platform } from 'react-native';
import type { Dashboard, DietPlanOptions, ExercisePlanOptions, Goal, GoalType, ImageMimeType, Meal, MealItem, MealType, Memory, MemoryCategory, PlanDraft, PlanRecommendation, PlanSummary, Profile, HealthReport, ReportDraft, ReportFileType, ReportSummary, SavedFood, SavedPlan, WaterDay } from '../types';
import { dateKey } from '../meals';
import { clearGuestToken, getGuestToken, saveGuestToken } from '../storage/session';

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

/** Absolute API URL plus the guest's auth header, for native downloads that bypass fetch. */
export async function authorizedRequest(path: string): Promise<{ headers: Record<string, string>; url: string }> {
  await ensureGuest();
  const token = await getGuestToken();
  return { headers: token ? { Authorization: `Bearer ${token}` } : {}, url: `${API_BASE_URL}${path}` };
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

export async function resetGuest(): Promise<void> {
  await ensureGuest();
  await request<void>('/v1/me', { method: 'DELETE' });
  await clearGuestToken();
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

export async function getProfile(): Promise<Profile | null> {
  await ensureGuest();
  return (await request<{ profile: Profile | null }>('/v1/profile')).profile;
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  await ensureGuest();
  return (await request<{ profile: Profile }>('/v1/profile', { body: JSON.stringify(profile), method: 'PUT' })).profile;
}

export async function recommendPlan(goalType: GoalType): Promise<PlanRecommendation> {
  await ensureGuest();
  const response = await request<{ recommendation: PlanRecommendation }>('/v1/ai/plan-recommendation', {
    body: JSON.stringify({ goalType }),
    method: 'POST',
  });
  return response.recommendation;
}

export async function getMemories(): Promise<Memory[]> {
  await ensureGuest();
  return (await request<{ memories: Memory[] }>('/v1/memories')).memories;
}

export async function saveMemory(text: string, category: MemoryCategory = 'other'): Promise<Memory> {
  await ensureGuest();
  return (await request<{ memory: Memory }>('/v1/memories', { body: JSON.stringify({ category, text }), method: 'POST' })).memory;
}

export async function deleteMemory(id: string): Promise<void> {
  await ensureGuest();
  await request<void>(`/v1/memories/${id}`, { method: 'DELETE' });
}

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

/** Reads report pages with Flip. Returns a draft only; nothing is saved until saveReport. */
export async function extractReport(files: { base64: string; mimeType: ReportFileType }[]): Promise<ReportDraft> {
  await ensureGuest();
  return (await request<{ draft: ReportDraft }>('/v1/reports/extract', { body: JSON.stringify({ files }), method: 'POST' })).draft;
}

export async function saveReport(draft: ReportDraft): Promise<HealthReport> {
  await ensureGuest();
  return (await request<{ report: HealthReport }>('/v1/reports', { body: JSON.stringify(draft), method: 'POST' })).report;
}

export async function listReports(): Promise<ReportSummary[]> {
  await ensureGuest();
  return (await request<{ reports: ReportSummary[] }>('/v1/reports')).reports ?? [];
}

export async function getReport(id: string): Promise<HealthReport> {
  await ensureGuest();
  return (await request<{ report: HealthReport }>(`/v1/reports/${id}`)).report;
}

export async function deleteReport(id: string): Promise<void> {
  await ensureGuest();
  await request<void>(`/v1/reports/${id}`, { method: 'DELETE' });
}

export async function setWaterTarget(targetMl: number | null, source: 'user' | 'report' = 'user'): Promise<{ source: WaterDay['source']; targetMl: number | null }> {
  await ensureGuest();
  return (await request<{ target: { source: WaterDay['source']; targetMl: number | null } }>('/v1/water/target', { body: JSON.stringify({ source, targetMl }), method: 'PUT' })).target;
}

export async function logWater(amountMl: number, date = dateKey()): Promise<WaterDay> {
  await ensureGuest();
  return (await request<{ water: WaterDay }>('/v1/water', { body: JSON.stringify({ amountMl, date }), method: 'POST' })).water;
}

export async function undoWater(date = dateKey()): Promise<WaterDay> {
  await ensureGuest();
  return (await request<{ water: WaterDay }>(`/v1/water/last?date=${date}`, { method: 'DELETE' })).water;
}

export type GeneratePlanRequest =
  | { kind: 'diet'; options?: Partial<DietPlanOptions> }
  | { kind: 'exercise'; options?: Partial<ExercisePlanOptions> };

/** Generates an unsaved draft; multi-day plans can take several seconds. */
export async function generatePlan(input: GeneratePlanRequest): Promise<PlanDraft> {
  await ensureGuest();
  return (await request<{ plan: PlanDraft }>('/v1/plans/generate', { body: JSON.stringify(input), method: 'POST' })).plan;
}

export async function savePlan(draft: PlanDraft): Promise<SavedPlan> {
  await ensureGuest();
  const body = { content: draft.content, kind: draft.kind, options: draft.options, source: draft.source };
  return (await request<{ plan: SavedPlan }>('/v1/plans', { body: JSON.stringify(body), method: 'POST' })).plan;
}

export async function listPlans(): Promise<PlanSummary[]> {
  await ensureGuest();
  return (await request<{ plans?: PlanSummary[] }>('/v1/plans')).plans ?? [];
}

export async function getPlan(id: string): Promise<SavedPlan> {
  await ensureGuest();
  return (await request<{ plan: SavedPlan }>(`/v1/plans/${id}`)).plan;
}

export async function deletePlan(id: string): Promise<void> {
  await ensureGuest();
  await request<void>(`/v1/plans/${id}`, { method: 'DELETE' });
}

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
