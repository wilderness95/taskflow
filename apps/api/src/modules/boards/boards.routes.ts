import type { FastifyInstance } from 'fastify'
import {
  boardListQuerySchema,
  boardMemberParamsSchema,
  cardListQuerySchema,
  createBoardSchema,
  createColumnSchema,
  createLabelSchema,
  idParamsSchema,
  pageQuerySchema,
  setBoardMemberSchema,
  updateBoardSchema,
} from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { BoardsService } from './boards.service.js'

export function boardsRoutes(service: BoardsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/boards', async (req) => ({ data: service.list(requireActor(req)) }))

    app.get('/api/v1/workspaces/:id/boards', async (req) => ({
      data: service.list(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        boardListQuerySchema.parse(req.query).archived,
      ),
    }))

    app.post('/api/v1/workspaces/:id/boards', async (req, reply) => {
      const board = service.create(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createBoardSchema.parse(req.body),
      )
      return reply.status(201).send(board)
    })

    // Névtelenül is hívható: a `public` táblát bárki olvashatja (a policy dönt, nem a route).
    app.get('/api/v1/boards/:id', async (req) =>
      service.get(req.actor, idParamsSchema.parse(req.params).id),
    )

    app.patch('/api/v1/boards/:id', async (req) =>
      service.update(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateBoardSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/boards/:id', async (req, reply) => {
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.post('/api/v1/boards/:id/restore', async (req) =>
      service.restore(requireActor(req), idParamsSchema.parse(req.params).id),
    )

    app.get('/api/v1/boards/:id/archive', async (req) =>
      service.archive(requireActor(req), idParamsSchema.parse(req.params).id),
    )

    app.put('/api/v1/boards/:id/star', async (req, reply) => {
      service.star(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.delete('/api/v1/boards/:id/star', async (req, reply) => {
      service.unstar(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.post('/api/v1/boards/:id/columns', async (req, reply) => {
      const column = service.createColumn(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createColumnSchema.parse(req.body),
      )
      return reply.status(201).send(column)
    })

    app.post('/api/v1/boards/:id/labels', async (req, reply) => {
      const label = service.createLabel(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createLabelSchema.parse(req.body),
      )
      return reply.status(201).send(label)
    })

    app.get('/api/v1/boards/:id/snapshot', async (req) =>
      service.snapshot(requireActor(req), idParamsSchema.parse(req.params).id),
    )

    app.get('/api/v1/boards/:id/cards', async (req) =>
      service.listCards(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        cardListQuerySchema.parse(req.query),
      ),
    )

    app.get('/api/v1/boards/:id/activity', async (req) =>
      service.activity(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        pageQuerySchema.parse(req.query),
      ),
    )

    app.get('/api/v1/boards/:id/participants', async (req) => ({
      data: service.listParticipants(requireActor(req), idParamsSchema.parse(req.params).id),
    }))

    app.get('/api/v1/boards/:id/members', async (req) => ({
      data: service.listMembers(requireActor(req), idParamsSchema.parse(req.params).id),
    }))

    app.put('/api/v1/boards/:id/members/:userId', async (req) => {
      const { id, userId } = boardMemberParamsSchema.parse(req.params)
      return service.setMember(requireActor(req), id, userId, setBoardMemberSchema.parse(req.body))
    })

    app.delete('/api/v1/boards/:id/members/:userId', async (req, reply) => {
      const { id, userId } = boardMemberParamsSchema.parse(req.params)
      service.removeMember(requireActor(req), id, userId)
      return reply.status(204).send()
    })
  }
}
