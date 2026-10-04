import type { ImageMimeType } from './meals';

export type ReportFlag = 'low' | 'normal' | 'high' | 'critical' | 'unknown';

export type ReportValue = {
  category: string;
  flag: ReportFlag;
  name: string;
  referenceRange: string | null;
  unit: string | null;
  value: string;
};

/** What Flip read from a lab report, for the user to review before anything is saved. */
export type ReportDraft = {
  hydration: { reason: string; suggestedLitres: number | null };
  nutritionNotes: string[];
  reportDate: string | null;
  summary: string;
  title: string;
  urgent: boolean;
  values: ReportValue[];
};

export type HealthReport = Omit<ReportDraft, 'hydration'> & { createdAt: string; id: string };

export type ReportSummary = {
  createdAt: string;
  flaggedCount: number;
  id: string;
  reportDate: string | null;
  title: string;
  urgent: boolean;
  valueCount: number;
};

export type WaterDay = { consumedMl: number; source: 'user' | 'report' | null; targetMl: number | null };

export type ReportFileType = ImageMimeType | 'application/pdf';
