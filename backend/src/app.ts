import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { createDatabasePool } from './db.js';

export function buildApp(options: { databaseUrl?: string } = {}): FastifyInstance {
  const app = Fastify({ logger: true });
  const database = createDatabasePool(options.databaseUrl);

  app.register(cors, { origin: true });

  app.get('/health', async () => ({
    service: 'healthflip-api',
    status: 'ok',
  }));

  app.get('/health/db', async (_request, reply) => {
    if (!database) {
      return reply.code(503).send({
        service: 'healthflip-api',
        status: 'not_configured',
      });
    }

    try {
      await database.query('SELECT 1');
      return { service: 'healthflip-api', status: 'ok' };
    } catch {
      return reply.code(503).send({
        service: 'healthflip-api',
        status: 'unavailable',
      });
    }
  });

  app.addHook('onClose', async () => {
    await closeDatabase(database);
  });

  return app;
}

async function closeDatabase(database: Pool | null): Promise<void> {
  if (database) {
    await database.end();
  }
}
