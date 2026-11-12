import type { FastifyInstance } from 'fastify'
import { createWebhookSchema, idParamsSchema, updateWebhookSchema } from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { WebhooksService } from './webhooks.service.js'

export function webhooksRoutes(service: WebhooksService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/boards/:id/webhooks', async (req) => ({
      data: service.list(requireActor(req), idParamsSchema.parse(req.params).id),
    }))

    app.post('/api/v1/boards/:id/webhooks', async (req, reply) => {
      const webhook = service.create(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createWebhookSchema.parse(req.body),
      )
      return reply.status(201).send(webhook)
    })

    app.patch('/api/v1/webhooks/:id', async (req) =>
      service.update(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateWebhookSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/webhooks/:id', async (req, reply) => {
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })
  }
}
