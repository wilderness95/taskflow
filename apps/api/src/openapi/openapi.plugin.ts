import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyInstance } from 'fastify'
import { buildOpenApiDocument } from './document.js'

/** `/api/openapi.json` és Swagger UI a `/api/docs` alatt; a leírás a `shared` Zod sémáiból készül. */
export async function openApiPlugin(app: FastifyInstance): Promise<void> {
  const document = buildOpenApiDocument()
  // Statikus mód: a dokumentumot mi állítjuk elő, a plugin csak kiszolgálja.
  await app.register(swagger, {
    mode: 'static',
    specification: { document: document as never },
  })
  await app.register(swaggerUi, { routePrefix: '/api/docs' })
  app.get('/api/openapi.json', async () => document)
}
