import * as nativeModule from '../../src/services/native/healthFlipNative';
import { applyWaterReminders, DEFAULT_REMINDERS, nextReminder, reminderHours, waterReminders } from '../../src/features/reminders/waterReminders';
import { widgetSnapshot } from '../../src/features/widget/widgetSync';

jest.mock('../../src/services/native/healthFlipNative', () => ({
  cancelReminders: jest.fn(() => Promise.resolve()),
  requestNotificationPermission: jest.fn(() => Promise.resolve(true)),
  scheduleReminders: jest.fn(() => Promise.resolve()),
  scheduleTestReminders: jest.fn(() => Promise.resolve()),
  updateWidget: jest.fn(() => Promise.resolve()),
}));

const native = () => nativeModule as unknown as Record<string, jest.Mock>;

describe('water reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  test('every 2 hours from 9:00 to 21:00 gives 7 daily reminders with the goal in litres', () => {
    expect(reminderHours(DEFAULT_REMINDERS)).toEqual([9, 11, 13, 15, 17, 19, 21]);
    const reminders = waterReminders(3000, DEFAULT_REMINDERS);
    expect(reminders).toHaveLength(7);
    expect(reminders[0]).toEqual({ body: 'Time for a glass of water. Your goal today is 3 L.', hour: 9, id: 'water-9', minute: 0, title: 'Flip 💧' });
    expect(reminderHours({ ...DEFAULT_REMINDERS, intervalHours: 3 })).toEqual([9, 12, 15, 18, 21]);
  });

  test('the next reminder is the next slot today, or none after the last one', () => {
    expect(nextReminder(DEFAULT_REMINDERS, new Date('2026-10-03T10:20:00'))?.getHours()).toBe(11);
    expect(nextReminder(DEFAULT_REMINDERS, new Date('2026-10-03T21:30:00'))).toBeNull();
    expect(nextReminder({ ...DEFAULT_REMINDERS, enabled: false }, new Date('2026-10-03T10:20:00'))).toBeNull();
  });

  test('turning on asks for permission and schedules; no target or disabled cancels', async () => {
    expect(await applyWaterReminders(2500, DEFAULT_REMINDERS)).toBe(true);
    expect(native().requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(native().scheduleReminders).toHaveBeenCalledWith('water-', expect.arrayContaining([expect.objectContaining({ body: 'Time for a glass of water. Your goal today is 2.5 L.', hour: 13 })]));

    await applyWaterReminders(null, DEFAULT_REMINDERS);
    expect(native().cancelReminders).toHaveBeenCalledWith('water-');

    // Test mode: 10 one-off reminders 30 s apart instead of the daily schedule.
    await applyWaterReminders(3000, { ...DEFAULT_REMINDERS, testSeconds: 30 });
    expect(native().scheduleTestReminders).toHaveBeenCalledWith('water-', 30, 10, 'Flip 💧 (test)', 'Time for a glass of water. Your goal today is 3 L.');
    expect(native().scheduleReminders).toHaveBeenCalledTimes(1);
    expect(nextReminder({ ...DEFAULT_REMINDERS, testSeconds: 60 }, new Date('2026-10-03T10:20:00'))?.toISOString()).toBe(new Date('2026-10-03T10:21:00').toISOString());

    native().requestNotificationPermission.mockResolvedValueOnce(false);
    expect(await applyWaterReminders(3000, DEFAULT_REMINDERS)).toBe(false);
  });
});

test('the widget snapshot carries today’s calories, macros, water and next reminder', () => {
  const dashboard = {
    date: '2026-10-03',
    goal: { dailyCalorieTarget: 2000, dailyStepsTarget: null, id: 'g1', macroTargets: { carbsGrams: 230, fatGrams: 59, proteinGrams: 96 }, planRationale: null, type: 'maintain' as const },
    meals: [{ caloriesKcal: 420, carbsGrams: 60, fatGrams: 12.4, id: 'm1', loggedAt: '2026-10-03T13:00:00', mealType: 'lunch' as const, name: 'Roti with dal', note: null, proteinGrams: 16, source: 'manual' as const }],
    remainingCalories: 1580,
    timezone: 'UTC',
    totalCalories: 420,
    water: { consumedMl: 750, source: 'report' as const, targetMl: 3000 },
  };
  const next = new Date('2026-10-03T15:00:00');
  const snapshot = widgetSnapshot(dashboard as never, 2000, 'Nice balanced lunch!', next);
  expect(snapshot).toEqual(expect.objectContaining({
    date: '2026-10-03',
    eatenKcal: 420,
    macros: { carbs: [60, 230], fat: [12, 59], protein: [16, 96] },
    nextReminder: next.toISOString(),
    nudge: 'Nice balanced lunch!',
    targetKcal: 2000,
    water: { consumedMl: 750, targetMl: 3000 },
  }));
});
