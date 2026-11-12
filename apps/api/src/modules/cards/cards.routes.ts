import type { FastifyInstance } from 'fastify'
import {
  createChecklistSchema,
  idParamsSchema,
  moveCardSchema,
  pageQuerySchema,
  updateCardSchema,
} from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { ChecklistsService } from '../checklists/checklists.service.js'
import type { CardsService } from './cards.service.js'

export function cardsRoutes(service: CardsService, checklists: ChecklistsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/cards/:id', async (req) =>
      service.get(requireActor(req), idParamsSchema.parse(req.params).id),
    )

    app.get('/api/v1/cards/:id/activity', async (req) =>
      service.activity(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        pageQuerySchema.parse(req.query),
      ),
    )

    app.patch('/api/v1/cards/:id', async (req) =>
      service.update(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateCardSchema.parse(req.body),
      ),
    )

    app.post('/api/v1/cards/:id/move', async (req) =>
      service.move(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        moveCardSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/cards/:id', async (req, reply) => {
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.post('/api/v1/cards/:id/checklists', async (req, reply) => {
      const checklist = checklists.create(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createChecklistSchema.parse(req.body ?? {}),
      )
      return reply.status(201).send(checklist)
    })
  }
}
