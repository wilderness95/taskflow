import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { auditLog, users } from '../../db/schema.js'
import { bearer, client, createTestApp, login, PASSWORD, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

const events = () => t.db.select().from(auditLog).all()

describe('auth audit events', () => {
  it('records registration, successful and failed logins without secrets', async () => {
    const person = await signUp(t.app, 'a@example.com')
    expect((await login(t.app, 'a@example.com')).res.statusCode).toBe(200)
    expect((await login(t.app, 'a@example.com', 'wrong-password-123')).res.statusCode).toBe(401)
    expect((await login(t.app, 'ghost@example.com', 'wrong-password-123')).res.statusCode).toBe(401)

    const rows = events()
    expect(rows.map((r) => r.action)).toEqual([
      'auth.registered',
      'auth.login_succeeded',
      'auth.login_failed',
      'auth.login_failed',
    ])
    const known = rows[2]!
    expect(known.actorId).toBe(person.user.id)
    const unknown = rows[3]!
    expect(unknown.actorId).toBeNull()
    expect(JSON.parse(unknown.meta)).toEqual({ email: 'ghost@example.com' })
    // Jelszó vagy token sehol nem kerülhet a naplóba.
    expect(JSON.stringify(rows)).not.toContain(PASSWORD)
    expect(JSON.stringify(rows)).not.toContain('wrong-password-123')
  })
})

describe('suspended accounts', () => {
  const suspend = (id: string) =>
    t.db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, id)).run()

  it('blocks login only after a correct password, and audits the attempt', async () => {
    const person = await signUp(t.app, 'a@example.com')
    suspend(person.user.id)

    const wrong = await login(t.app, 'a@example.com', 'wrong-password-123')
    expect(wrong.res.statusCode).toBe(401)

    const blocked = await login(t.app, 'a@example.com')
    expect(blocked.res.statusCode).toBe(403)
    expect(blocked.res.json().error.code).toBe('account_suspended')
    expect(events().map((r) => r.action)).toContain('auth.login_blocked')
  })

  it('invalidates an existing session and API keys', async () => {
    const person = await signUp(t.app, 'a@example.com')
    const key = (await person.api.post('/api-keys', { name: 'agent', scopes: ['workspaces:read'] }))
      .body.key as string
    expect((await person.api.get('/workspaces')).status).toBe(200)
    expect((await bearer(t.app, key).get('/workspaces')).status).toBe(200)

    suspend(person.user.id)
    expect((await client(t.app, person.cookie).get('/workspaces')).status).toBe(401)
    expect((await bearer(t.app, key).get('/workspaces')).status).toBe(401)
  })
})
