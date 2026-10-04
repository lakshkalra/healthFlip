import type { WaterDay } from '../../types';
import { dateKey } from '../../utils/date';
import { ensureGuest, request } from './http';

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
