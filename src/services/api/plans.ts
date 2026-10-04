import type { DietPlanOptions, ExercisePlanOptions, PlanDraft, PlanSummary, SavedPlan } from '../../types';
import { ensureGuest, request } from './http';

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
