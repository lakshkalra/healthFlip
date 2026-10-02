import { notFound } from '../../shared/errors.js';
import type { CreateMealInput, UpdateMealInput } from './meal.schema.js';
import type { MealRepository } from './meal.repository.js';

export function createMealService(mealRepository: MealRepository) {
  return {
    async create(guestId: string, input: CreateMealInput) {
      return serializeMeal(await mealRepository.create(guestId, input));
    },

    async delete(guestId: string, mealId: string) {
      await requireMeal(mealRepository, guestId, mealId);
      await mealRepository.softDelete(guestId, mealId);
    },

    async list(guestId: string, range: { end: Date; start: Date }) {
      const meals = await mealRepository.list(guestId, range.start, range.end);
      return meals.map(serializeMeal);
    },

    async update(guestId: string, mealId: string, input: UpdateMealInput) {
      await requireMeal(mealRepository, guestId, mealId);
      return serializeMeal(await mealRepository.update(guestId, mealId, input));
    },
  };
}

async function requireMeal(mealRepository: MealRepository, guestId: string, mealId: string) {
  const meal = await mealRepository.findActiveById(guestId, mealId);

  if (!meal) {
    throw notFound('Meal');
  }

  return meal;
}

export function serializeMeal(meal: {
  caloriesKcal: number | null;
  carbsGrams: number | null;
  createdAt: Date;
  fatGrams: number | null;
  id: string;
  loggedAt: Date;
  name: string;
  note: string | null;
  proteinGrams: number | null;
  source: 'manual' | 'photo' | 'voice';
  updatedAt: Date;
}) {
  return {
    caloriesKcal: meal.caloriesKcal,
    carbsGrams: meal.carbsGrams,
    createdAt: meal.createdAt.toISOString(),
    fatGrams: meal.fatGrams,
    id: meal.id,
    loggedAt: meal.loggedAt.toISOString(),
    name: meal.name,
    note: meal.note,
    proteinGrams: meal.proteinGrams,
    source: meal.source,
    updatedAt: meal.updatedAt.toISOString(),
  };
}
