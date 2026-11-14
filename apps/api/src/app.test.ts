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
    expect(res.json()).toEqual({
      status: 'ok',
      voice: false,
      registrationOpen: true,
      emailVerificationRequired: true,
    })
  })

  it('healthz is anonymous, minimal and exempt from rate limiting', async () => {
    const { db } = createDb(':memory:')
    runMigrations(db)
    const app = buildApp(loadConfig({ NODE_ENV: 'test', RATE_LIMIT_MAX: '2' }), db)
    for (let i = 0; i < 6; i++) {
      const res = await app.inject('/healthz')
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ status: 'ok' })
    }
  })

  it('readyz reports ok when the database, migrations and storage are fine', async () => {
    const res = await makeApp().inject('/readyz')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      status: 'ok',
      checks: { database: 'ok', migrations: 'ok', storage: 'ok' },
    })
  })

  it('readyz returns 503 on a database failure while healthz stays 200', async () => {
    const { db, sqlite } = createDb(':memory:')
    runMigrations(db)
    const app = buildApp(config, db)
    sqlite.close()
    const ready = await app.inject('/readyz')
    expect(ready.statusCode).toBe(503)
    expect(ready.json().status).toBe('unavailable')
    expect(ready.json().checks.database).toBe('error')
    expect((await app.inject('/healthz')).statusCode).toBe(200)
  })

  it('readyz fails when the upload directory is not writable', async () => {
    const { db } = createDb(':memory:')
    runMigrations(db)
    const app = buildApp(loadConfig({ NODE_ENV: 'test', UPLOAD_DIR: '/proc/nope/uploads' }), db)
    const res = await app.inject('/readyz')
    expect(res.statusCode).toBe(503)
    expect(res.json().checks.storage).toBe('error')
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
