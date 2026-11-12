import { describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'
import { loadConfig } from '../config.js'
import { createDb, runMigrations } from '../db/client.js'
import { operations } from './operations.js'

const makeApp = () => {
  const { db } = createDb(':memory:')
  runMigrations(db)
  return buildApp(loadConfig({ NODE_ENV: 'test' }), db)
}

describe('openapi', () => {
  it('serves a valid-looking OpenAPI 3.1 document', async () => {
    const res = await makeApp().inject('/api/openapi.json')
    expect(res.statusCode).toBe(200)
    const doc = res.json()
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.paths['/cards/{id}/move'].post.requestBody).toBeDefined()
    const params = doc.paths['/columns/{id}'].delete.parameters as { name: string; in: string }[]
    expect(params.filter((p) => p.in !== 'header').map((p) => p.name)).toEqual([
      'id',
      'moveCardsTo',
    ])
    expect(params.map((p) => p.name)).toContain('Idempotency-Key')
    expect(doc.paths['/boards'].get.parameters).toBeUndefined()
    expect(doc.paths['/boards'].get.responses['200']).toBeDefined()
    expect(doc.components.schemas.ErrorResponse).toBeDefined()
  })

  it('serves Swagger UI', async () => {
    const res = await makeApp().inject('/api/docs/')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
  })

  it('documents every business route and nothing else', async () => {
    const app = makeApp()
    await app.ready()
    const actual = app.routeList
      .filter((r) => r.includes('/api/v1/') && !r.includes('/health'))
      .filter((r) => !r.startsWith('HEAD') && !r.startsWith('OPTIONS'))
      .map((r) => r.replace(/:(\w+)/g, '{$1}'))
      .sort()
    const documented = operations.map((o) => `${o.method.toUpperCase()} /api/v1${o.path}`).sort()
    expect(documented).toEqual(actual)
  })
})
