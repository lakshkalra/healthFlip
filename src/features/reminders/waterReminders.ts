import AsyncStorage from '@react-native-async-storage/async-storage';

import { cancelReminders, requestNotificationPermission, scheduleReminders, scheduleTestReminders, type ScheduledReminder } from '../../services/native/healthFlipNative';

// Water reminders are scheduled on the phone (repeating daily), so they work with the app closed.
// Settings live on this device; the target comes from the server.

export type ReminderSettings = {
  enabled: boolean;
  endHour: number;
  intervalHours: 1 | 2 | 3;
  startHour: number;
  /** Testing only: remind every 30 or 60 seconds (10 times) instead of the daily schedule. */
  testSeconds?: 30 | 60 | null;
};

export const TEST_REMINDER_COUNT = 10;

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, endHour: 21, intervalHours: 2, startHour: 9 };
const KEY = 'healthflip.waterReminders';
const PREFIX = 'water-';

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_REMINDERS, ...(JSON.parse(raw) as Partial<ReminderSettings>) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; reminders still use the values passed in.
  }
}

/** Reminder hours from start to end (inclusive) every interval, e.g. 9, 11 … 21. */
export function reminderHours({ endHour, intervalHours, startHour }: ReminderSettings): number[] {
  const hours: number[] = [];
  for (let hour = startHour; hour <= endHour; hour += intervalHours) hours.push(hour);
  return hours;
}

export function waterReminders(targetMl: number, settings: ReminderSettings): ScheduledReminder[] {
  const litres = formatLitres(targetMl);
  return reminderHours(settings).map(hour => ({
    body: `Time for a glass of water. Your goal today is ${litres} L.`,
    hour,
    id: `${PREFIX}${hour}`,
    minute: 0,
    title: 'Flip 💧',
  }));
}

/** The next reminder time today, for the widget and the water card ("Next reminder 3:00 PM"). */
export function nextReminder(settings: ReminderSettings, now = new Date()): Date | null {
  if (!settings.enabled) return null;
  if (settings.testSeconds) return new Date(now.getTime() + settings.testSeconds * 1000);
  const hour = reminderHours(settings).find(candidate => candidate > now.getHours() || (candidate === now.getHours() && now.getMinutes() === 0));
  if (hour === undefined) return null;
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  return next;
}

/**
 * Turns water reminders on for a target (asking for permission first), or off.
 * Returns false when the user declined notifications.
 */
export async function applyWaterReminders(targetMl: number | null, settings: ReminderSettings): Promise<boolean> {
  if (!targetMl || !settings.enabled) {
    await cancelReminders(PREFIX);
    return true;
  }
  if (!(await requestNotificationPermission())) return false;
  if (settings.testSeconds) {
    await scheduleTestReminders(PREFIX, settings.testSeconds, TEST_REMINDER_COUNT, 'Flip 💧 (test)', `Time for a glass of water. Your goal today is ${formatLitres(targetMl)} L.`);
    return true;
  }
  await scheduleReminders(PREFIX, waterReminders(targetMl, settings));
  return true;
}

export const clearAllReminders = () => cancelReminders(PREFIX);

// Nearest 50 ml, so a glass shows as 0.25 L rather than 0.3 L.
export const formatLitres = (ml: number) => String((Math.round(ml / 50) * 50) / 1000);
