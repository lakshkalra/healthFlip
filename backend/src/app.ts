import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { closeDatabase, createDatabase } from './db/client.js';
import { createDashboardController } from './modules/dashboard/dashboard.controller.js';
import { registerDashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { createDashboardService } from './modules/dashboard/dashboard.service.js';
import { createGoalController } from './modules/goals/goal.controller.js';
import { createGoalRepository } from './modules/goals/goal.repository.js';
import { registerGoalRoutes } from './modules/goals/goal.routes.js';
import { createGoalService } from './modules/goals/goal.service.js';
import { createGuestController } from './modules/guests/guest.controller.js';
import { createGuestRepository } from './modules/guests/guest.repository.js';
import { registerGuestRoutes } from './modules/guests/guest.routes.js';
import { createGuestService } from './modules/guests/guest.service.js';
import { createMealController } from './modules/meals/meal.controller.js';
import { createMealRepository } from './modules/meals/meal.repository.js';
import { registerMealRoutes } from './modules/meals/meal.routes.js';
import { createMealService } from './modules/meals/meal.service.js';
import { createGuestAuth } from './shared/auth/guest-auth.js';
import { AppError } from './shared/errors.js';

export function buildApp(options: { databaseUrl: string }): FastifyInstance {
  const app = Fastify({ logger: true });
  const database = createDatabase(options.databaseUrl);

  app.decorateRequest('guest', null);

  app.register(cors, { origin: true });

  app.get('/health', async () => ({
    service: 'healthflip-api',
    status: 'ok',
  }));

  app.get('/health/db', async (_request, reply) => {
    try {
      await database.pool.query('SELECT 1');
      return { service: 'healthflip-api', status: 'ok' };
    } catch {
      return reply.code(503).send({
        service: 'healthflip-api',
        status: 'unavailable',
      });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          details: error.details,
          message: error.message,
        },
        requestId: request.id,
      });
    }

    if (isUniqueConstraintViolation(error)) {
      return reply.code(409).send({
        error: { code: 'CONFLICT', message: 'The requested resource already exists.' },
        requestId: request.id,
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      requestId: request.id,
    });
  });

  const guestRepository = createGuestRepository(database.db);
  const goalRepository = createGoalRepository(database.db);
  const mealRepository = createMealRepository(database.db);
  const requireGuest = createGuestAuth(guestRepository);

  registerGuestRoutes(app, createGuestController(createGuestService(guestRepository)), requireGuest);
  registerGoalRoutes(app, createGoalController(createGoalService(goalRepository)), requireGuest);
  registerMealRoutes(app, createMealController(createMealService(mealRepository)), requireGuest);
  registerDashboardRoutes(
    app,
    createDashboardController(createDashboardService(goalRepository, mealRepository)),
    requireGuest,
  );

  app.addHook('onClose', async () => {
    await closeDatabase(database);
  });

  return app;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}
