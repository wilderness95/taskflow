import type { FastifyInstance } from 'fastify'
import {
  createCommentSchema,
  idParamsSchema,
  pageQuerySchema,
  updateCommentSchema,
} from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { CommentsService } from './comments.service.js'

export function commentsRoutes(service: CommentsService) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/cards/:id/comments', async (req) => {
      const { limit, cursor } = pageQuerySchema.parse(req.query)
      return service.list(requireActor(req), idParamsSchema.parse(req.params).id, limit, cursor)
    })

    app.post('/api/v1/cards/:id/comments', async (req, reply) => {
      const comment = service.create(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createCommentSchema.parse(req.body),
      )
      return reply.status(201).send(comment)
    })

    app.patch('/api/v1/comments/:id', async (req) =>
      service.update(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateCommentSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/comments/:id', async (req, reply) => {
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })
  }
}
