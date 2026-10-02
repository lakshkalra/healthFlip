import type { FastifyRequest } from 'fastify';

import { parseOrThrow } from '../../shared/validation.js';
import { replaceGoalSchema } from './goal.schema.js';
import type { createGoalService } from './goal.service.js';

export function createGoalController(service: ReturnType<typeof createGoalService>) {
  return {
    async getCurrent(request: FastifyRequest) {
      return { goal: await service.getCurrent(request.guest!.id) };
    },

    async replaceCurrent(request: FastifyRequest) {
      const input = parseOrThrow(replaceGoalSchema, request.body);
      return { goal: await service.replaceCurrent(request.guest!.id, input) };
    },
  };
}
