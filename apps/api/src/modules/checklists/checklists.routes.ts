import type { FastifyInstance } from 'fastify'
import {
  createChecklistItemSchema,
  idParamsSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
} from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { ChecklistsService } from './checklists.service.js'

export function checklistsRoutes(service: ChecklistsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.patch('/api/v1/checklists/:id', async (req) =>
      service.update(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateChecklistSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/checklists/:id', async (req, reply) => {
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.post('/api/v1/checklists/:id/items', async (req, reply) => {
      const item = service.createItem(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createChecklistItemSchema.parse(req.body),
      )
      return reply.status(201).send(item)
    })

    app.patch('/api/v1/checklist-items/:id', async (req) =>
      service.updateItem(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateChecklistItemSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/checklist-items/:id', async (req, reply) => {
      service.removeItem(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })
  }
}
