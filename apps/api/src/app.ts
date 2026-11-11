import Fastify, { type FastifyInstance } from 'fastify'
import type { Config } from './config.js'
import { registerErrorHandler } from './plugins/errorHandler.js'
import { healthRoutes } from './health.routes.js'

export function buildApp(config: Config): FastifyInstance {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
    // Cloudflare mögött: a kliens IP-je a CF-Connecting-IP fejlécből jön.
    trustProxy: true,
    requestIdHeader: 'x-request-id',
  })
  registerErrorHandler(app)
  app.register(healthRoutes)
  return app
}
