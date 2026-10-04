import { clearGuestToken } from '../storage/session';
import { ensureGuest, request } from './http';

export async function resetGuest(): Promise<void> {
  await ensureGuest();
  await request<void>('/v1/me', { method: 'DELETE' });
  await clearGuestToken();
}
