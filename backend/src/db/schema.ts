import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const goalType = pgEnum('goal_type', ['lose', 'maintain', 'gain']);
export const mealSource = pgEnum('meal_source', ['manual', 'photo', 'voice']);

export const guests = pgTable('guests', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const guestSessions = pgTable(
  'guest_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guestId: uuid('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  table => [
    uniqueIndex('guest_sessions_token_hash_unique').on(table.tokenHash),
    index('guest_sessions_guest_id_idx').on(table.guestId),
  ],
);

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guestId: uuid('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'cascade' }),
    type: goalType('type').notNull(),
    dailyCalorieTarget: integer('daily_calorie_target').notNull(),
    startsOn: date('starts_on').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  table => [
    check(
      'goals_daily_calorie_target_range',
      sql`${table.dailyCalorieTarget} between 800 and 6000`,
    ),
    index('goals_guest_id_idx').on(table.guestId),
    uniqueIndex('goals_one_active_goal_per_guest')
      .on(table.guestId)
      .where(sql`${table.archivedAt} is null`),
  ],
);

export const mealEntries = pgTable(
  'meal_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guestId: uuid('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    source: mealSource('source').default('manual').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull(),
    caloriesKcal: integer('calories_kcal'),
    proteinGrams: integer('protein_grams'),
    carbsGrams: integer('carbs_grams'),
    fatGrams: integer('fat_grams'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  table => [
    check(
      'meal_entries_non_negative_nutrition',
      sql`(${table.caloriesKcal} is null or ${table.caloriesKcal} >= 0)
        and (${table.proteinGrams} is null or ${table.proteinGrams} >= 0)
        and (${table.carbsGrams} is null or ${table.carbsGrams} >= 0)
        and (${table.fatGrams} is null or ${table.fatGrams} >= 0)`,
    ),
    index('meal_entries_guest_logged_at_idx').on(table.guestId, table.loggedAt),
    index('meal_entries_guest_active_idx').on(table.guestId, table.deletedAt),
  ],
);
