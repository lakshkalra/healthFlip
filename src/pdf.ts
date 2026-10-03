import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { authorizedRequest } from './api/client';

/**
 * Downloads a saved plan's PDF into the app's documents folder and opens the native viewer
 * (iOS Quick Look with Share / Save to Files / Print; Android's PDF app chooser).
 */
export async function downloadPlanPdf(planId: string, fileName: string): Promise<string> {
  const { headers, url } = await authorizedRequest(`/v1/plans/${planId}/pdf`);
  const path = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${fileName}`;
  const response = await ReactNativeBlobUtil.config({ path }).fetch('GET', url, headers);
  const status = response.info().status;
  if (status !== 200) {
    await ReactNativeBlobUtil.fs.unlink(path).catch(() => undefined);
    throw new Error(status === 404 ? 'That plan no longer exists.' : 'The PDF could not be downloaded. Please try again.');
  }
  if (Platform.OS === 'ios') await ReactNativeBlobUtil.ios.openDocument(path);
  else await ReactNativeBlobUtil.android.actionViewIntent(path, 'application/pdf', 'Open plan PDF');
  return path;
}

/** Mirrors the API's file naming, e.g. "Priya's 7-day plan" → "priya-s-7-day-plan.pdf". */
export function pdfFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${slug || 'healthflip-plan'}.pdf`;
}
