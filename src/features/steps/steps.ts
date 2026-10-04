import { Platform } from 'react-native';
import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

// Live step count from Apple Health. Android (Health Connect) is not wired up yet, so it reports
// `unsupported` and the plan card shows the target only.

export type StepsAccess = 'unsupported' | 'needs-permission' | 'ready';

const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount';
const READ_STEPS = { toRead: [STEP_COUNT] } as const;

function healthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}

// HealthKit never reveals whether read access was denied; "ready" only means the prompt was shown.
export async function getStepsAccess(): Promise<StepsAccess> {
  if (!healthKitAvailable()) return 'unsupported';
  try {
    const status = await getRequestStatusForAuthorization(READ_STEPS);
    return status === AuthorizationRequestStatus.unnecessary ? 'ready' : 'needs-permission';
  } catch {
    return 'unsupported';
  }
}

export async function requestStepsAccess(): Promise<StepsAccess> {
  if (!healthKitAvailable()) return 'unsupported';
  try {
    await requestAuthorization(READ_STEPS);
  } catch {
    return 'needs-permission';
  }
  return getStepsAccess();
}

/** Steps since local midnight, or null when Apple Health is unavailable. */
export async function getTodaySteps(now = new Date()): Promise<number | null> {
  if (!healthKitAvailable()) return null;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  try {
    const result = await queryStatisticsForQuantity(STEP_COUNT, ['cumulativeSum'], {
      filter: { date: { endDate: now, startDate: startOfDay } },
      unit: 'count',
    });
    return Math.round(result.sumQuantity?.quantity ?? 0);
  } catch {
    return null;
  }
}
