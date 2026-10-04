import { NativeModules, Platform } from 'react-native';

// healthFlip's small in-repo iOS module (ios/healthFlip/HealthFlipNative.swift): local reminders and
// the Home Screen widget. Every call is a safe no-op where it is missing (Android, Jest, old builds).

export type ScheduledReminder = { body: string; hour: number; id: string; minute: number; title: string };

type NativeApi = {
  cancelReminders: (prefix: string) => Promise<void>;
  notificationStatus: () => Promise<'granted' | 'denied' | 'undetermined'>;
  requestNotificationPermission: () => Promise<boolean>;
  scheduleReminders: (prefix: string, reminders: ScheduledReminder[]) => Promise<void>;
  scheduleTestReminders: (prefix: string, seconds: number, count: number, title: string, body: string) => Promise<void>;
  takeLaunchURL: () => Promise<string | null>;
  updateWidget: (json: string) => Promise<void>;
};

const native: NativeApi | undefined = Platform.OS === 'ios' ? NativeModules.HealthFlipNative : undefined;

export const nativeAvailable = () => !!native;

export async function requestNotificationPermission(): Promise<boolean> {
  return native ? native.requestNotificationPermission() : false;
}

export async function notificationStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  return native ? native.notificationStatus() : 'undetermined';
}

/** Replaces every daily reminder whose id starts with `prefix`. */
export async function scheduleReminders(prefix: string, reminders: ScheduledReminder[]): Promise<void> {
  if (native) await native.scheduleReminders(prefix, reminders);
}

/** Testing only: a burst of one-off reminders every few seconds. */
export async function scheduleTestReminders(prefix: string, seconds: number, count: number, title: string, body: string): Promise<void> {
  if (native) await native.scheduleTestReminders(prefix, seconds, count, title, body);
}

export async function cancelReminders(prefix: string): Promise<void> {
  if (native) await native.cancelReminders(prefix);
}

export async function updateWidget(snapshot: unknown): Promise<void> {
  if (native) await native.updateWidget(JSON.stringify(snapshot));
}

/** The healthflip:// link that cold-started the app (a widget tap), returned once. */
export async function takeLaunchURL(): Promise<string | null> {
  return native ? native.takeLaunchURL() : null;
}
