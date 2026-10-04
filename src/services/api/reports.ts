import type { HealthReport, ReportDraft, ReportFileType, ReportSummary } from '../../types';
import { ensureGuest, request } from './http';

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
