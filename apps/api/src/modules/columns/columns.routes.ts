import type { FastifyInstance } from 'fastify'
import { requireActor } from '../../auth/auth.plugin.js'
import {
  createCardSchema,
  deleteColumnQuerySchema,
  idParamsSchema,
  moveColumnSchema,
  updateColumnSchema,
} from '@taskflow/shared'
import type { CardsService } from '../cards/cards.service.js'
import type { ColumnsService } from './columns.service.js'

export function columnsRoutes(service: ColumnsService, cards: CardsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.patch('/api/v1/columns/:id', async (req) =>
      service.update(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateColumnSchema.parse(req.body),
      ),
    )

    app.post('/api/v1/columns/:id/archive', async (req) =>
      service.archive(requireActor(req), idParamsSchema.parse(req.params).id),
    )

    app.post('/api/v1/columns/:id/restore', async (req) =>
      service.restore(requireActor(req), idParamsSchema.parse(req.params).id),
    )

    app.post('/api/v1/columns/:id/move', async (req) =>
      service.move(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        moveColumnSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/columns/:id', async (req, reply) => {
      const { moveCardsTo } = deleteColumnQuerySchema.parse(req.query)
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id, moveCardsTo)
      return reply.status(204).send()
    })

    app.post('/api/v1/columns/:id/cards', async (req, reply) => {
      const card = cards.create(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createCardSchema.parse(req.body),
      )
      return reply.status(201).send(card)
    })
  }
}
