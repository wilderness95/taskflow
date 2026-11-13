import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { auditLog, sessions, users } from '../../db/schema.js'
import {
  bearer,
  client,
  createTestApp,
  login,
  PASSWORD,
  signUp,
  tokenFromLastMail,
} from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

/** Az első regisztrált felhasználó platform-admin; a többi nem. */
async function setup() {
  const admin = await signUp(t.app, 'admin@example.com', 'Admin')
  const alice = await signUp(t.app, 'alice@example.com', 'Alice')
  const bob = await signUp(t.app, 'bob@example.com', 'Bob')
  return { admin, alice, bob }
}

const actions = () =>
  t.db
    .select()
    .from(auditLog)
    .all()
    .map((r) => r.action)

describe('admin access control', () => {
  it('rejects anonymous, non-admin and API key callers on every endpoint', async () => {
    const { admin, alice } = await setup()
    const calls: [string, string][] = [
      ['get', '/admin/users'],
      ['get', `/admin/users/${alice.user.id}`],
      ['post', `/admin/users/${alice.user.id}/suspend`],
      ['post', `/admin/users/${alice.user.id}/restore`],
      ['post', `/admin/users/${alice.user.id}/revoke-sessions`],
      ['post', `/admin/users/${alice.user.id}/resend-verification`],
      ['put', `/admin/users/${alice.user.id}/admin`],
    ]
    const key = (
      await admin.api.post('/api-keys', { name: 'agent', scopes: ['boards:read', 'boards:write'] })
    ).body.key as string

    for (const [method, url] of calls) {
      const send = (api: ReturnType<typeof client>) =>
        (api as unknown as Record<string, (u: string, b?: object) => Promise<{ status: number }>>)[
          method
        ]!(url, { isAdmin: true, password: PASSWORD })
      expect((await send(client(t.app))).status).toBe(401)
      expect((await send(alice.api)).status).toBe(403)
      // Még platform-admin tulajdonos kulcsa sem érheti el: csak böngészős session.
      const withKey = await send(bearer(t.app, key))
      expect(withKey.status).toBe(403)
    }
    expect(actions()).not.toContain('admin.user_suspended')
  })

  it('does not treat a workspace owner as platform admin', async () => {
    const { alice } = await setup()
    // Alice a saját munkaterületének tulajdonosa, mégsem platform-admin.
    expect((await alice.api.get('/workspaces')).status).toBe(200)
    expect((await alice.api.get('/admin/users')).status).toBe(403)
  })
})

describe('admin users', () => {
  it('lists, searches, filters and paginates users', async () => {
    const { admin, alice } = await setup()
    await admin.api.post(`/admin/users/${alice.user.id}/suspend`, { password: PASSWORD })

    const all = await admin.api.get('/admin/users')
    expect(all.status).toBe(200)
    expect(all.body.data.map((u: { email: string }) => u.email)).toEqual([
      'bob@example.com',
      'alice@example.com',
      'admin@example.com',
    ])
    expect(all.body.nextCursor).toBeNull()
    expect(JSON.stringify(all.body)).not.toContain('passwordHash')

    const q = await admin.api.get('/admin/users?q=ALI')
    expect(q.body.data.map((u: { name: string }) => u.name)).toEqual(['Alice'])
    // A LIKE jokerkarakterek szó szerint értendők.
    expect((await admin.api.get('/admin/users?q=%25')).body.data).toEqual([])

    const suspended = await admin.api.get('/admin/users?status=suspended')
    expect(suspended.body.data.map((u: { name: string }) => u.name)).toEqual(['Alice'])
    const active = await admin.api.get('/admin/users?status=active')
    expect(active.body.data).toHaveLength(2)

    const page1 = await admin.api.get('/admin/users?limit=2')
    expect(page1.body.data).toHaveLength(2)
    const page2 = await admin.api.get(`/admin/users?limit=2&cursor=${page1.body.nextCursor}`)
    expect(page2.body.data.map((u: { name: string }) => u.name)).toEqual(['Admin'])
    expect(page2.body.nextCursor).toBeNull()
  })

  it('shows a detail with workspaces and the live session count', async () => {
    const { admin, alice } = await setup()
    await login(t.app, 'alice@example.com')
    const detail = await admin.api.get(`/admin/users/${alice.user.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({
      email: 'alice@example.com',
      suspended: false,
      isAdmin: false,
      sessionCount: 2,
    })
    expect(detail.body.workspaces).toHaveLength(1)
    expect(detail.body.workspaces[0].role).toBe('owner')
    expect((await admin.api.get('/admin/users/missing')).status).toBe(404)
  })

  it('suspends and restores an account, signing the user out immediately', async () => {
    const { admin, alice } = await setup()
    const suspended = await admin.api.post(`/admin/users/${alice.user.id}/suspend`, {
      password: PASSWORD,
    })
    expect(suspended.status).toBe(200)
    expect(suspended.body.suspended).toBe(true)
    expect(suspended.body.sessionCount).toBe(0)

    expect((await alice.api.get('/workspaces')).status).toBe(401)
    expect((await login(t.app, 'alice@example.com')).res.statusCode).toBe(403)

    const restored = await admin.api.post(`/admin/users/${alice.user.id}/restore`)
    expect(restored.body.suspended).toBe(false)
    expect((await login(t.app, 'alice@example.com')).res.statusCode).toBe(200)
    expect(actions()).toEqual(
      expect.arrayContaining(['admin.user_suspended', 'admin.user_restored']),
    )
  })

  it('repeating a state change does not write duplicate audit events', async () => {
    const { admin, alice } = await setup()
    await admin.api.post(`/admin/users/${alice.user.id}/suspend`, { password: PASSWORD })
    await admin.api.post(`/admin/users/${alice.user.id}/suspend`, { password: PASSWORD })
    expect(actions().filter((a) => a === 'admin.user_suspended')).toHaveLength(1)
  })

  it('does not let an admin suspend themselves or the last active admin', async () => {
    const { admin } = await setup()
    const self = await admin.api.post(`/admin/users/${admin.user.id}/suspend`, {
      password: PASSWORD,
    })
    expect(self.status).toBe(409)
    expect(self.body.error.code).toBe('cannot_suspend_self')

    const revoke = await admin.api.put(`/admin/users/${admin.user.id}/admin`, {
      password: PASSWORD,
      isAdmin: false,
    })
    expect(revoke.status).toBe(409)
    expect(revoke.body.error.code).toBe('last_admin')
  })

  it('revokes sessions and audits the count', async () => {
    const { admin, alice } = await setup()
    const res = await admin.api.post(`/admin/users/${alice.user.id}/revoke-sessions`)
    expect(res.status).toBe(200)
    expect(res.body.sessionCount).toBe(0)
    expect(t.db.select().from(sessions).where(eq(sessions.userId, alice.user.id)).all()).toEqual([])
    expect((await alice.api.get('/workspaces')).status).toBe(401)
    const event = t.db
      .select()
      .from(auditLog)
      .all()
      .find((r) => r.action === 'admin.user_sessions_revoked')!
    expect(JSON.parse(event.meta)).toEqual({ count: 1 })
    expect(event.actorId).toBe(admin.user.id)
    expect(event.targetUserId).toBe(alice.user.id)
  })

  it('resends the confirmation email only to unconfirmed accounts', async () => {
    const { admin, alice } = await setup()
    const before = t.mailer.sent.length
    const res = await admin.api.post(`/admin/users/${alice.user.id}/resend-verification`)
    expect(res.status).toBe(200)
    expect(t.mailer.sent.length).toBe(before + 1)
    expect(tokenFromLastMail(t.mailer)).toBeTruthy()

    t.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, alice.user.id)).run()
    const again = await admin.api.post(`/admin/users/${alice.user.id}/resend-verification`)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('already_verified')
  })

  it('grants the admin role only to confirmed accounts and revokes it again', async () => {
    const { admin, alice } = await setup()
    const unconfirmed = await admin.api.put(`/admin/users/${alice.user.id}/admin`, {
      password: PASSWORD,
      isAdmin: true,
    })
    expect(unconfirmed.status).toBe(409)
    expect(unconfirmed.body.error.code).toBe('email_not_verified')

    t.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, alice.user.id)).run()
    const granted = await admin.api.put(`/admin/users/${alice.user.id}/admin`, {
      password: PASSWORD,
      isAdmin: true,
    })
    expect(granted.body.isAdmin).toBe(true)
    // Az új admin már eléri az adminfelületet.
    expect((await alice.api.get('/admin/users')).status).toBe(200)

    // Most két admin van, ezért az eredeti lemondhat.
    const revoked = await admin.api.put(`/admin/users/${admin.user.id}/admin`, {
      password: PASSWORD,
      isAdmin: false,
    })
    expect(revoked.status).toBe(200)
    expect((await admin.api.get('/admin/users')).status).toBe(403)
    expect(actions()).toEqual(
      expect.arrayContaining(['admin.user_admin_granted', 'admin.user_admin_revoked']),
    )
  })

  it('validates the admin role body', async () => {
    const { admin, alice } = await setup()
    const res = await admin.api.put(`/admin/users/${alice.user.id}/admin`, {
      password: PASSWORD,
      isAdmin: 'yes',
    })
    expect(res.status).toBe(400)
  })
})

describe('step-up password confirmation', () => {
  const stepUpFailures = () =>
    t.db
      .select()
      .from(auditLog)
      .all()
      .filter((r) => r.action === 'admin.step_up_failed')

  it('requires the password to suspend, and changes nothing without the right one', async () => {
    const { admin, alice } = await setup()
    const url = `/admin/users/${alice.user.id}/suspend`

    const missing = await admin.api.post(url)
    expect(missing.status).toBe(400)
    const wrong = await admin.api.post(url, { password: 'wrong-password-123' })
    expect(wrong.status).toBe(403)
    expect(wrong.body.error.code).toBe('invalid_password')

    expect((await admin.api.get(`/admin/users/${alice.user.id}`)).body.suspended).toBe(false)
    expect((await alice.api.get('/workspaces')).status).toBe(200)

    const ok = await admin.api.post(url, { password: PASSWORD })
    expect(ok.status).toBe(200)
    expect(ok.body.suspended).toBe(true)
  })

  it('requires the password to grant and to revoke the admin role', async () => {
    const { admin, alice } = await setup()
    t.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, alice.user.id)).run()
    const url = `/admin/users/${alice.user.id}/admin`

    const wrong = await admin.api.put(url, { isAdmin: true, password: 'wrong-password-123' })
    expect(wrong.status).toBe(403)
    expect(wrong.body.error.code).toBe('invalid_password')
    expect((await alice.api.get('/admin/users')).status).toBe(403)

    expect((await admin.api.put(url, { isAdmin: true, password: PASSWORD })).status).toBe(200)
    expect((await admin.api.put(url, { isAdmin: false })).status).toBe(400)
    expect(
      (await admin.api.put(url, { isAdmin: false, password: 'wrong-password-123' })).status,
    ).toBe(403)
    expect((await alice.api.get('/admin/users')).status).toBe(200)
    expect((await admin.api.put(url, { isAdmin: false, password: PASSWORD })).status).toBe(200)
  })

  it("checks the caller's password, not the target's, and audits failures without the password", async () => {
    const { admin, alice } = await setup()
    // Alice jelszava megegyezik a tesztben, ezért egy külön jelszavú adminnal próbáljuk.
    t.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, alice.user.id)).run()
    await admin.api.put(`/admin/users/${alice.user.id}/admin`, {
      isAdmin: true,
      password: PASSWORD,
    })

    await admin.api.post(`/admin/users/${alice.user.id}/suspend`, {
      password: 'wrong-password-123',
    })
    const failures = stepUpFailures()
    expect(failures).toHaveLength(1)
    expect(failures[0]!.actorId).toBe(admin.user.id)
    expect(JSON.parse(failures[0]!.meta)).toEqual({ operation: 'suspend' })
    expect(JSON.stringify(failures)).not.toContain('wrong-password-123')
  })

  it('does not run the step-up check for non-admins (403 before any password check)', async () => {
    const { alice, bob } = await setup()
    const res = await alice.api.post(`/admin/users/${bob.user.id}/suspend`, { password: PASSWORD })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('forbidden')
    expect(stepUpFailures()).toHaveLength(0)
  })
})
