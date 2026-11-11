import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDb, runMigrations } from './db/client.js'
import { AppError } from './errors.js'

const config = loadConfig({ NODE_ENV: 'test' })
const makeApp = () => {
  const { db } = createDb(':memory:')
  runMigrations(db)
  return buildApp(config, db)
}

describe('app', () => {
  it('health check returns ok', async () => {
    const app = makeApp()
    const res = await app.inject('/api/v1/health')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('unknown route uses the unified error format', async () => {
    const app = makeApp()
    const res = await app.inject('/nope')
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('not_found')
  })

  it('maps AppError and hides internal errors', async () => {
    const app = makeApp()
    app.get('/t/app', async () => {
      throw new AppError(409, 'conflict', 'x', { a: 1 })
    })
    app.get('/t/boom', async () => {
      throw new Error('secret')
    })
    const a = await app.inject('/t/app')
    expect(a.statusCode).toBe(409)
    expect(a.json()).toEqual({ error: { code: 'conflict', message: 'x', details: { a: 1 } } })
    const b = await app.inject('/t/boom')
    expect(b.statusCode).toBe(500)
    expect(b.json().error).toEqual({
      code: 'internal_error',
      message: 'Internal server error',
      details: null,
    })
  })

  it('rejects invalid config', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/Invalid environment/)
  })
})
