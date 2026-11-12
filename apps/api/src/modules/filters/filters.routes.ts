import type { FastifyInstance } from 'fastify'
import { createSavedFilterSchema, idParamsSchema } from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { FiltersService } from './filters.service.js'

export function filtersRoutes(service: FiltersService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/boards/:id/filters', async (req) => ({
      data: service.list(requireActor(req), idParamsSchema.parse(req.params).id),
    }))

    app.post('/api/v1/boards/:id/filters', async (req, reply) => {
      const filter = service.create(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createSavedFilterSchema.parse(req.body),
      )
      return reply.status(201).send(filter)
    })

    app.delete('/api/v1/filters/:id', async (req, reply) => {
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })
  }
}
