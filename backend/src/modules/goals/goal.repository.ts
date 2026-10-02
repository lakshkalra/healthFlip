import { and, desc, eq, isNull } from 'drizzle-orm';

import type { DatabaseClient } from '../../db/client.js';
import { goals } from '../../db/schema.js';
import type { ReplaceGoalInput } from './goal.schema.js';

type GoalRecord = typeof goals.$inferSelect;

export interface GoalRepository {
  findCurrent(guestId: string): Promise<GoalRecord | null>;
  replaceCurrent(guestId: string, input: ReplaceGoalInput & { startsOn: string }): Promise<GoalRecord>;
}

export function createGoalRepository(db: DatabaseClient): GoalRepository {
  return {
    async findCurrent(guestId) {
      const [goal] = await db
        .select()
        .from(goals)
        .where(and(eq(goals.guestId, guestId), isNull(goals.archivedAt)))
        .orderBy(desc(goals.createdAt))
        .limit(1);

      return goal ?? null;
    },

    async replaceCurrent(guestId, input) {
      return db.transaction(async transaction => {
        await transaction
          .update(goals)
          .set({ archivedAt: new Date() })
          .where(and(eq(goals.guestId, guestId), isNull(goals.archivedAt)));

        const [goal] = await transaction
          .insert(goals)
          .values({
            dailyCalorieTarget: input.dailyCalorieTarget,
            guestId,
            startsOn: input.startsOn,
            type: input.type,
          })
          .returning();

        return goal;
      });
    },
  };
}
