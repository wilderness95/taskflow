import type { FastifyInstance } from 'fastify'
import { idParamsSchema, notificationQuerySchema } from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { NotificationsService } from './notifications.service.js'

export function notificationsRoutes(service: NotificationsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/notifications', async (req) =>
      service.list(requireActor(req), notificationQuerySchema.parse(req.query)),
    )

    app.post('/api/v1/notifications/read-all', async (req, reply) => {
      service.markAllRead(requireActor(req))
      return reply.status(204).send()
    })

    app.post('/api/v1/notifications/:id/read', async (req) =>
      service.markRead(requireActor(req), idParamsSchema.parse(req.params).id),
    )
  }
}
