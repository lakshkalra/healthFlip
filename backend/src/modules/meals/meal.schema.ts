import { z } from 'zod';

export const mealSourceSchema = z.enum(['manual', 'photo', 'voice']);
const nutritionValueSchema = z.number().int().min(0).max(100_000);

export const createMealSchema = z
  .object({
    caloriesKcal: nutritionValueSchema.optional(),
    carbsGrams: nutritionValueSchema.optional(),
    fatGrams: nutritionValueSchema.optional(),
    loggedAt: z.string().datetime({ offset: true }),
    name: z.string().trim().min(1).max(120),
    note: z.string().trim().max(1000).optional(),
    proteinGrams: nutritionValueSchema.optional(),
    source: mealSourceSchema.default('manual'),
  })
  .strict();

export const updateMealSchema = z
  .object({
    caloriesKcal: nutritionValueSchema.nullable().optional(),
    carbsGrams: nutritionValueSchema.nullable().optional(),
    fatGrams: nutritionValueSchema.nullable().optional(),
    loggedAt: z.string().datetime({ offset: true }).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    proteinGrams: nutritionValueSchema.nullable().optional(),
    source: mealSourceSchema.optional(),
  })
  .strict()
  .refine(value => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const mealIdParamsSchema = z.object({ mealId: z.string().uuid() });

export const mealListQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(value => new Date(value.from) < new Date(value.to), 'The from timestamp must be before to.');

export type CreateMealInput = z.infer<typeof createMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
