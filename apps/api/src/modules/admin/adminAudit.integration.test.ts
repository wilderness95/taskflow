import { beforeEach, describe, expect, it } from 'vitest'
import { auditLog } from '../../db/schema.js'
import { bearer, client, createTestApp, login, PASSWORD, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup() {
  const admin = await signUp(t.app, 'admin@example.com', 'Admin')
  const alice = await signUp(t.app, 'alice@example.com', 'Alice')
  return { admin, alice }
}

describe('admin overview and audit: access control', () => {
  it('rejects anonymous, non-admin and API key callers', async () => {
    const { admin, alice } = await setup()
    const key = (await admin.api.post('/api-keys', { name: 'agent', scopes: ['boards:read'] })).body
      .key as string
    for (const url of ['/admin/overview', '/admin/audit']) {
      expect((await client(t.app).get(url)).status).toBe(401)
      expect((await alice.api.get(url)).status).toBe(403)
      expect((await bearer(t.app, key).get(url)).status).toBe(403)
      expect((await admin.api.get(url)).status).toBe(200)
    }
  })
})

describe('admin overview', () => {
  it('counts users and invitations and reports basic health', async () => {
    const { admin, alice } = await setup()
    await admin.api.post(`/admin/users/${alice.user.id}/suspend`, { password: PASSWORD })
    await admin.api.post('/admin/invitations', { email: 'p@example.com' })

    const res = await admin.api.get('/admin/overview')
    expect(res.status).toBe(200)
    expect(res.body.users).toEqual({ total: 2, admins: 1, suspended: 1, unverified: 2 })
    expect(res.body.pendingInvitations).toBe(1)
    expect(res.body.health).toEqual({ database: 'ok', mailTransport: 'console' })
    expect(res.body.recentEvents.length).toBeGreaterThan(0)
    expect(res.body.recentEvents.length).toBeLessThanOrEqual(10)
    // A legújabb esemény elöl áll.
    expect(res.body.recentEvents[0].action).toBe('admin.invitation_created')
  })
})

describe('admin audit log', () => {
  it('lists events newest first with actor and target names', async () => {
    const { admin, alice } = await setup()
    await admin.api.post(`/admin/users/${alice.user.id}/suspend`, { password: PASSWORD })

    const res = await admin.api.get('/admin/audit')
    expect(res.status).toBe(200)
    expect(res.body.data[0]).toMatchObject({
      action: 'admin.user_suspended',
      actorId: admin.user.id,
      actorName: 'Admin',
      targetType: 'user',
      targetUserId: alice.user.id,
      targetUserName: 'Alice',
    })
    expect(res.body.data.map((e: { action: string }) => e.action)).toContain('auth.registered')
  })

  it('filters by action, actor, target user and time range', async () => {
    const { admin, alice } = await setup()
    await admin.api.post(`/admin/users/${alice.user.id}/suspend`, { password: PASSWORD })
    await admin.api.post(`/admin/users/${alice.user.id}/restore`)
    await login(t.app, 'alice@example.com', 'wrong-password-123')

    const byAction = await admin.api.get('/admin/audit?action=admin.user_restored')
    expect(byAction.body.data).toHaveLength(1)

    const byActor = await admin.api.get(`/admin/audit?actorId=${admin.user.id}`)
    expect(byActor.body.data.every((e: { actorId: string }) => e.actorId === admin.user.id)).toBe(
      true,
    )

    const byTarget = await admin.api.get(`/admin/audit?targetUserId=${alice.user.id}`)
    expect(
      byTarget.body.data.every((e: { targetUserId: string }) => e.targetUserId === alice.user.id),
    ).toBe(true)
    expect(byTarget.body.data.map((e: { action: string }) => e.action)).toContain(
      'auth.login_failed',
    )

    const future = new Date(Date.now() + 60_000).toISOString()
    expect(
      (await admin.api.get(`/admin/audit?from=${encodeURIComponent(future)}`)).body.data,
    ).toEqual([])
    expect(
      (await admin.api.get(`/admin/audit?to=${encodeURIComponent(future)}`)).body.data.length,
    ).toBeGreaterThan(0)
    expect((await admin.api.get('/admin/audit?from=yesterday')).status).toBe(400)
  })

  it('paginates with a cursor', async () => {
    const { admin } = await setup()
    await login(t.app, 'alice@example.com')
    await login(t.app, 'admin@example.com')
    const total = t.db.select().from(auditLog).all().length
    const page1 = await admin.api.get('/admin/audit?limit=2')
    expect(page1.body.data).toHaveLength(2)
    expect(page1.body.nextCursor).not.toBeNull()
    const rest = await admin.api.get(`/admin/audit?limit=200&cursor=${page1.body.nextCursor}`)
    expect(rest.body.data).toHaveLength(total - 2)
    expect(rest.body.nextCursor).toBeNull()
  })

  it('never exposes secrets in events', async () => {
    const { admin, alice } = await setup()
    await admin.api.post('/admin/invitations', { email: 'p@example.com' })
    await admin.api.post(`/admin/users/${alice.user.id}/resend-verification`)
    const text = JSON.stringify((await admin.api.get('/admin/audit')).body)
    expect(text).not.toMatch(/token|password|hash|tfk_/i)
  })
})
