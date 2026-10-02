import type { FastifyReply, FastifyRequest } from 'fastify';

import { parseOrThrow } from '../../shared/validation.js';
import {
  createMealSchema,
  mealIdParamsSchema,
  mealListQuerySchema,
  updateMealSchema,
} from './meal.schema.js';
import type { createMealService } from './meal.service.js';

export function createMealController(service: ReturnType<typeof createMealService>) {
  return {
    async create(request: FastifyRequest) {
      const input = parseOrThrow(createMealSchema, request.body);
      return { meal: await service.create(request.guest!.id, input) };
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
      const { mealId } = parseOrThrow(mealIdParamsSchema, request.params);
      await service.delete(request.guest!.id, mealId);
      return reply.code(204).send();
    },

    async list(request: FastifyRequest) {
      const query = parseOrThrow(mealListQuerySchema, request.query);
      const meals = await service.list(request.guest!.id, {
        end: new Date(query.to),
        start: new Date(query.from),
      });
      return { meals };
    },

    async update(request: FastifyRequest) {
      const { mealId } = parseOrThrow(mealIdParamsSchema, request.params);
      const input = parseOrThrow(updateMealSchema, request.body);
      return { meal: await service.update(request.guest!.id, mealId, input) };
    },
  };
}
