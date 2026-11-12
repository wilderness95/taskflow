import type { FastifyInstance } from 'fastify'
import {
  createListItemSchema,
  createListSchema,
  createListSectionSchema,
  idParamsSchema,
  listQuerySchema,
  moveListItemSchema,
  moveListSectionSchema,
  updateListItemSchema,
  updateListSchema,
  updateListSectionSchema,
} from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { ListsService } from './lists.service.js'

export function listsRoutes(service: ListsService) {
  return async (app: FastifyInstance): Promise<void> => {
    const id = (req: { params: unknown }) => idParamsSchema.parse(req.params).id

    app.get('/api/v1/workspaces/:id/lists', async (req) => ({
      data: service.list(requireActor(req), id(req), listQuerySchema.parse(req.query).archived),
    }))
    app.post('/api/v1/workspaces/:id/lists', async (req, reply) =>
      reply
        .status(201)
        .send(service.create(requireActor(req), id(req), createListSchema.parse(req.body))),
    )

    app.get('/api/v1/lists/:id', async (req) => service.get(requireActor(req), id(req)))
    app.patch('/api/v1/lists/:id', async (req) =>
      service.update(requireActor(req), id(req), updateListSchema.parse(req.body)),
    )
    app.post('/api/v1/lists/:id/archive', async (req) =>
      service.archive(requireActor(req), id(req)),
    )
    app.post('/api/v1/lists/:id/restore', async (req) =>
      service.restore(requireActor(req), id(req)),
    )
    app.post('/api/v1/lists/:id/clear-done', async (req) =>
      service.clearDone(requireActor(req), id(req)),
    )
    app.post('/api/v1/lists/:id/reset-recurring', async (req) =>
      service.resetRecurring(requireActor(req), id(req)),
    )

    app.post('/api/v1/lists/:id/sections', async (req, reply) =>
      reply
        .status(201)
        .send(
          service.createSection(
            requireActor(req),
            id(req),
            createListSectionSchema.parse(req.body),
          ),
        ),
    )
    app.patch('/api/v1/list-sections/:id', async (req) =>
      service.updateSection(requireActor(req), id(req), updateListSectionSchema.parse(req.body)),
    )
    app.post('/api/v1/list-sections/:id/move', async (req) =>
      service.moveSection(requireActor(req), id(req), moveListSectionSchema.parse(req.body)),
    )
    app.delete('/api/v1/list-sections/:id', async (req, reply) => {
      service.removeSection(requireActor(req), id(req))
      return reply.status(204).send()
    })

    app.post('/api/v1/lists/:id/items', async (req, reply) =>
      reply
        .status(201)
        .send(service.createItem(requireActor(req), id(req), createListItemSchema.parse(req.body))),
    )
    app.patch('/api/v1/list-items/:id', async (req) =>
      service.updateItem(requireActor(req), id(req), updateListItemSchema.parse(req.body)),
    )
    app.post('/api/v1/list-items/:id/move', async (req) =>
      service.moveItem(requireActor(req), id(req), moveListItemSchema.parse(req.body)),
    )
    app.delete('/api/v1/list-items/:id', async (req, reply) => {
      service.removeItem(requireActor(req), id(req))
      return reply.status(204).send()
    })
  }
}
