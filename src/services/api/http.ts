import { clearGuestToken, getGuestToken, saveGuestToken } from '../storage/session';
import { API_BASE_URL } from '../../constants/config';

type ApiErrorPayload = { error?: { message?: string } };

export async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = await getGuestToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // A token the server doesn't know (database reset, or moving from a dev server to production)
  // would fail every request, so start a fresh guest session once and retry.
  if (response.status === 401 && token && path !== '/v1/guests' && !retried) {
    await clearGuestToken();
    await ensureGuest();
    return request<T>(path, options, true);
  }

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

export async function ensureGuest(): Promise<void> {
  if (await getGuestToken()) {
    return;
  }

  const response = await request<{ accessToken: string }>('/v1/guests', { method: 'POST' });
  await saveGuestToken(response.accessToken);
}
