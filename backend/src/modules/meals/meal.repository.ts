import { and, asc, eq, gte, isNull, lt, sum } from 'drizzle-orm';

import type { DatabaseClient } from '../../db/client.js';
import { mealEntries } from '../../db/schema.js';
import type { CreateMealInput, UpdateMealInput } from './meal.schema.js';

type MealRecord = typeof mealEntries.$inferSelect;

export interface MealRepository {
  create(guestId: string, input: CreateMealInput): Promise<MealRecord>;
  findActiveById(guestId: string, mealId: string): Promise<MealRecord | null>;
  getDailySummary(guestId: string, start: Date, end: Date): Promise<{ meals: MealRecord[]; totalCalories: number }>;
  list(guestId: string, start: Date, end: Date): Promise<MealRecord[]>;
  softDelete(guestId: string, mealId: string): Promise<void>;
  update(guestId: string, mealId: string, input: UpdateMealInput): Promise<MealRecord>;
}

export function createMealRepository(db: DatabaseClient): MealRepository {
  const activeMealForGuest = (guestId: string, mealId: string) =>
    and(eq(mealEntries.guestId, guestId), eq(mealEntries.id, mealId), isNull(mealEntries.deletedAt));

  const activeMealsInRange = (guestId: string, start: Date, end: Date) =>
    and(
      eq(mealEntries.guestId, guestId),
      isNull(mealEntries.deletedAt),
      gte(mealEntries.loggedAt, start),
      lt(mealEntries.loggedAt, end),
    );

  return {
    async create(guestId, input) {
      const [meal] = await db
        .insert(mealEntries)
        .values({
          ...input,
          guestId,
          loggedAt: new Date(input.loggedAt),
        })
        .returning();

      return meal;
    },

    async findActiveById(guestId, mealId) {
      const [meal] = await db
        .select()
        .from(mealEntries)
        .where(activeMealForGuest(guestId, mealId))
        .limit(1);

      return meal ?? null;
    },

    async getDailySummary(guestId, start, end) {
      const where = activeMealsInRange(guestId, start, end);
      const [total] = await db
        .select({ caloriesKcal: sum(mealEntries.caloriesKcal) })
        .from(mealEntries)
        .where(where);
      const meals = await db
        .select()
        .from(mealEntries)
        .where(where)
        .orderBy(asc(mealEntries.loggedAt), asc(mealEntries.createdAt));

      return { meals, totalCalories: Number(total?.caloriesKcal ?? 0) };
    },

    async list(guestId, start, end) {
      return db
        .select()
        .from(mealEntries)
        .where(activeMealsInRange(guestId, start, end))
        .orderBy(asc(mealEntries.loggedAt), asc(mealEntries.createdAt));
    },

    async softDelete(guestId, mealId) {
      await db
        .update(mealEntries)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(activeMealForGuest(guestId, mealId));
    },

    async update(guestId, mealId, input) {
      const [meal] = await db
        .update(mealEntries)
        .set({
          ...input,
          loggedAt: input.loggedAt ? new Date(input.loggedAt) : undefined,
          updatedAt: new Date(),
        })
        .where(activeMealForGuest(guestId, mealId))
        .returning();

      return meal;
    },
  };
}
