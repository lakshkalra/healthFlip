import type { Dashboard } from '../../types';
import { dateKey } from '../../utils/date';
import { ensureGuest, request } from './http';

/** Daily dashboard for a local calendar date (defaults to today). */
export async function getDashboard(date = dateKey()): Promise<Dashboard> {
  await ensureGuest();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const response = await request<{ dashboard: Dashboard }>(
    `/v1/dashboard/daily?date=${date}&timezone=${encodeURIComponent(timezone)}`,
  );
  return response.dashboard;
}
