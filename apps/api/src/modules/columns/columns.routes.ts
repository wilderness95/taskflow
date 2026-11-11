import type { FastifyInstance } from 'fastify'
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
      service.update(idParamsSchema.parse(req.params).id, updateColumnSchema.parse(req.body)),
    )

    app.post('/api/v1/columns/:id/move', async (req) =>
      service.move(idParamsSchema.parse(req.params).id, moveColumnSchema.parse(req.body)),
    )

    app.delete('/api/v1/columns/:id', async (req, reply) => {
      const { moveCardsTo } = deleteColumnQuerySchema.parse(req.query)
      service.remove(idParamsSchema.parse(req.params).id, moveCardsTo)
      return reply.status(204).send()
    })

    app.post('/api/v1/columns/:id/cards', async (req, reply) => {
      const card = cards.create(
        req.actor,
        idParamsSchema.parse(req.params).id,
        createCardSchema.parse(req.body),
      )
      return reply.status(201).send(card)
    })
  }
}
