import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { auditLog, users } from '../../db/schema.js'
import { createAuditRepository } from './audit.repository.js'
import { createAuditService } from './audit.service.js'
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

describe('failed login condensing', () => {
  it('records repeated failures for the same address only once per window', async () => {
    await signUp(t.app, 'a@example.com')
    for (let i = 0; i < 4; i++) await login(t.app, 'a@example.com', 'wrong-password-123')
    await login(t.app, 'b@example.com', 'wrong-password-123')
    await login(t.app, 'b@example.com', 'wrong-password-123')

    const failed = events().filter((r) => r.action === 'auth.login_failed')
    expect(failed.map((r) => JSON.parse(r.meta).email).sort()).toEqual([
      'a@example.com',
      'b@example.com',
    ])
  })
})

describe('audit retention', () => {
  const day = 24 * 60 * 60 * 1000
  const audit = () => createAuditService(createAuditRepository(t.db))

  it('deletes only entries older than the retention period', async () => {
    const person = await signUp(t.app, 'a@example.com')
    const old = new Date(Date.now() - 100 * day)
    const recent = new Date(Date.now() - 10 * day)
    t.db
      .insert(auditLog)
      .values([
        {
          id: 'old',
          actorId: person.user.id,
          action: 'auth.login_succeeded',
          targetType: 'user',
          createdAt: old,
        },
        {
          id: 'recent',
          actorId: person.user.id,
          action: 'auth.login_succeeded',
          targetType: 'user',
          createdAt: recent,
        },
      ])
      .run()

    expect(audit().purge(90)).toBe(1)
    const ids = events().map((r) => r.id)
    expect(ids).toContain('recent')
    expect(ids).not.toContain('old')
    // A mai regisztráció is megmarad.
    expect(events().some((r) => r.action === 'auth.registered')).toBe(true)
  })

  it('keeps everything when the retention is 0', async () => {
    const person = await signUp(t.app, 'a@example.com')
    t.db
      .insert(auditLog)
      .values({
        id: 'old',
        actorId: person.user.id,
        action: 'x',
        targetType: 'user',
        createdAt: new Date(0),
      })
      .run()
    expect(audit().purge(0)).toBe(0)
    expect(events().map((r) => r.id)).toContain('old')
  })
})
