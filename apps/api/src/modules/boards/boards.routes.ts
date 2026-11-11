import type { FastifyInstance } from 'fastify'
import {
  createBoardSchema,
  createColumnSchema,
  createLabelSchema,
  idParamsSchema,
  updateBoardSchema,
} from '@taskflow/shared'
import type { BoardsService } from './boards.service.js'

export function boardsRoutes(service: BoardsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/boards', async () => ({ data: service.list() }))

    app.post('/api/v1/boards', async (req, reply) => {
      const board = service.create(req.actor, createBoardSchema.parse(req.body))
      return reply.status(201).send(board)
    })

    app.get('/api/v1/boards/:id', async (req) => service.get(idParamsSchema.parse(req.params).id))

    app.patch('/api/v1/boards/:id', async (req) =>
      service.update(idParamsSchema.parse(req.params).id, updateBoardSchema.parse(req.body)),
    )

    app.delete('/api/v1/boards/:id', async (req, reply) => {
      service.remove(idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.post('/api/v1/boards/:id/columns', async (req, reply) => {
      const column = service.createColumn(
        idParamsSchema.parse(req.params).id,
        createColumnSchema.parse(req.body),
      )
      return reply.status(201).send(column)
    })

    app.post('/api/v1/boards/:id/labels', async (req, reply) => {
      const label = service.createLabel(
        idParamsSchema.parse(req.params).id,
        createLabelSchema.parse(req.body),
      )
      return reply.status(201).send(label)
    })
  }
}
