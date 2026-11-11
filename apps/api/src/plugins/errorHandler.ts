import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../errors.js'

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => {
    reply
      .status(404)
      .send({ error: { code: 'not_found', message: 'Route not found', details: null } })
  })

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply
        .status(err.statusCode)
        .send({ error: { code: err.code, message: err.message, details: err.details } })
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'validation_error', message: 'Invalid request', details: err.issues },
      })
    }
    const status = (err as { statusCode?: number }).statusCode
    if (typeof status === 'number' && status >= 400 && status < 500) {
      const e = err as { code?: string; message: string }
      return reply.status(status).send({
        error: {
          code: e.code?.toLowerCase() ?? 'bad_request',
          message: e.message,
          details: null,
        },
      })
    }
    req.log.error({ err }, 'unhandled error')
    return reply
      .status(500)
      .send({ error: { code: 'internal_error', message: 'Internal server error', details: null } })
  })
}
