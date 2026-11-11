import type { FastifyInstance } from 'fastify'
import {
  createChecklistItemSchema,
  idParamsSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
} from '@taskflow/shared'
import type { ChecklistsService } from './checklists.service.js'

export function checklistsRoutes(service: ChecklistsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.patch('/api/v1/checklists/:id', async (req) =>
      service.update(idParamsSchema.parse(req.params).id, updateChecklistSchema.parse(req.body)),
    )

    app.delete('/api/v1/checklists/:id', async (req, reply) => {
      service.remove(idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.post('/api/v1/checklists/:id/items', async (req, reply) => {
      const item = service.createItem(
        idParamsSchema.parse(req.params).id,
        createChecklistItemSchema.parse(req.body),
      )
      return reply.status(201).send(item)
    })

    app.patch('/api/v1/checklist-items/:id', async (req) =>
      service.updateItem(
        idParamsSchema.parse(req.params).id,
        updateChecklistItemSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/checklist-items/:id', async (req, reply) => {
      service.removeItem(idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })
  }
}
