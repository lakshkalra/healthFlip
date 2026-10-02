import { z } from 'zod';

import { dateSchema } from '../../shared/validation.js';

export const goalTypeSchema = z.enum(['lose', 'maintain', 'gain']);

export const replaceGoalSchema = z
  .object({
    dailyCalorieTarget: z.number().int().min(800).max(6000),
    startsOn: dateSchema.optional(),
    type: goalTypeSchema,
  })
  .strict();

export type ReplaceGoalInput = z.infer<typeof replaceGoalSchema>;
