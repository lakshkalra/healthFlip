import type { GoalType, PlanRecommendation, Profile } from '../../types';
import { ensureGuest, request } from './http';

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
