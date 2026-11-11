import type { FastifyInstance } from 'fastify'
import {
  createChecklistSchema,
  idParamsSchema,
  moveCardSchema,
  updateCardSchema,
} from '@taskflow/shared'
import type { ChecklistsService } from '../checklists/checklists.service.js'
import type { CardsService } from './cards.service.js'

export function cardsRoutes(service: CardsService, checklists: ChecklistsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/cards/:id', async (req) => service.get(idParamsSchema.parse(req.params).id))

    app.patch('/api/v1/cards/:id', async (req) =>
      service.update(idParamsSchema.parse(req.params).id, updateCardSchema.parse(req.body)),
    )

    app.post('/api/v1/cards/:id/move', async (req) =>
      service.move(idParamsSchema.parse(req.params).id, moveCardSchema.parse(req.body)),
    )

    app.delete('/api/v1/cards/:id', async (req, reply) => {
      service.remove(idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.post('/api/v1/cards/:id/checklists', async (req, reply) => {
      const checklist = checklists.create(
        idParamsSchema.parse(req.params).id,
        createChecklistSchema.parse(req.body ?? {}),
      )
      return reply.status(201).send(checklist)
    })
  }
}
