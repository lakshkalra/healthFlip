import type { Memory, MemoryCategory } from '../../types';
import { ensureGuest, request } from './http';

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
