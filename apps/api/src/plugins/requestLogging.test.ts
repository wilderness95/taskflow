import { describe, expect, it } from 'vitest'
import { createTestApp, PASSWORD, register } from '../testing/helpers.js'

type Line = Record<string, unknown> & { msg?: string; level: number }

function setup(env: Record<string, string> = {}) {
  const lines: Line[] = []
  const logStream = { write: (l: string) => void lines.push(JSON.parse(l) as Line) }
  const t = createTestApp({ LOG_LEVEL: 'info', ...env }, { logStream })
  return { ...t, lines }
}

describe('request logging', () => {
  it('returns the request id header and keeps a client supplied one', async () => {
    const { app } = setup()
    const generated = await app.inject('/api/v1/health')
    expect(generated.headers['x-request-id']).toBeTruthy()
    const given = await app.inject({ url: '/nope', headers: { 'x-request-id': 'abc-123' } })
    expect(given.headers['x-request-id']).toBe('abc-123')
  })

  it('does not log the health endpoints', async () => {
    const { app, lines } = setup()
    await app.inject('/healthz')
    await app.inject('/readyz')
    expect(lines.filter((l) => l.msg?.includes('request'))).toEqual([])
  })

  it('adds the actor to the request log lines of authenticated requests', async () => {
    const { app, lines } = setup()
    const { cookie } = await register(app, { email: 'log@example.com' })
    lines.length = 0
    await app.inject({ url: '/api/v1/auth/me', headers: { cookie } })
    const done = lines.find((l) => l.msg === 'request completed')
    expect(done).toMatchObject({ actorType: 'user' })
    expect(typeof done?.actorId).toBe('string')
    expect(done?.reqId).toBeTruthy()
  })

  it('redacts secrets from the log', async () => {
    const { app, lines } = setup()
    const { cookie } = await register(app, { email: 'secret@example.com' })
    await app.inject({
      url: '/api/v1/auth/me',
      headers: { cookie, 'idempotency-key': 'idem-secret-value' },
    })
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'secret@example.com', password: PASSWORD },
    })
    const text = JSON.stringify(lines)
    expect(text).not.toContain(cookie.split('=')[1])
    expect(text).not.toContain('idem-secret-value')
    expect(text).not.toContain(PASSWORD)
  })

  it('logs requests slower than SLOW_REQUEST_MS as a warning with the route', async () => {
    const { app, lines } = setup({ SLOW_REQUEST_MS: '20' })
    app.get('/_slow', async () => {
      await new Promise((r) => setTimeout(r, 40))
      return { ok: true }
    })
    await app.inject('/_slow')
    const slow = lines.find((l) => l.msg === 'slow request')
    expect(slow).toMatchObject({ level: 40, route: '/_slow', statusCode: 200 })
  })

  it('puts the request id into the 500 response and the error log', async () => {
    const { app, lines } = setup()
    app.get('/_boom', async () => {
      throw new Error('boom')
    })
    const res = await app.inject({ url: '/_boom', headers: { 'x-request-id': 'req-500' } })
    expect(res.statusCode).toBe(500)
    expect(res.json().error.details).toEqual({ requestId: 'req-500' })
    expect(lines.find((l) => l.msg === 'unhandled error')).toMatchObject({ reqId: 'req-500' })
  })
})
