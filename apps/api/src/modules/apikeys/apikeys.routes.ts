import type { FastifyInstance } from 'fastify'
import { createApiKeySchema, idParamsSchema } from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { ApiKeysService } from './apikeys.service.js'

export function apiKeysRoutes(service: ApiKeysService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/api-keys', async (req) => ({ data: service.list(requireActor(req)) }))

    app.post('/api/v1/api-keys', async (req, reply) => {
      const created = service.create(requireActor(req), createApiKeySchema.parse(req.body))
      return reply.status(201).send(created)
    })

    app.delete('/api/v1/api-keys/:id', async (req, reply) => {
      service.revoke(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })
  }
}
