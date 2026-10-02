import type { FastifyRequest } from 'fastify';

import type { createGuestService } from './guest.service.js';

export function createGuestController(service: ReturnType<typeof createGuestService>) {
  return {
    async create() {
      return service.createGuest();
    },

    async getCurrent(request: FastifyRequest) {
      return { guest: await service.getGuest(request.guest!.id) };
    },
  };
}
