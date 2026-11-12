import { beforeEach, describe, expect, it } from 'vitest'
import { auditLog } from '../../db/schema.js'
import {
  bearer,
  client,
  createTestApp,
  register,
  signUp,
  tokenFromLastMail,
} from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  // Zárt rendszer (alapértelmezett): meghívó nélkül nem lehet regisztrálni.
  t = createTestApp()
})

async function setup() {
  const admin = await signUp(t.app, 'admin@example.com', 'Admin')
  t.mailer.sent.length = 0
  return { admin }
}

const actions = () =>
  t.db
    .select()
    .from(auditLog)
    .all()
    .map((r) => r.action)

describe('admin invitations: access control', () => {
  it('rejects anonymous, non-admin and API key callers', async () => {
    const { admin } = await setup()
    const invited = (await admin.api.post('/admin/invitations', { email: 'p@example.com' })).body
    const key = (
      await admin.api.post('/api-keys', { name: 'agent', scopes: ['boards:read', 'boards:write'] })
    ).body.key as string
    // Platform-meghívóval regisztrált, nem admin felhasználó.
    const token = tokenFromLastMail(t.mailer)
    const { res, cookie } = await register(t.app, { email: 'p@example.com', inviteToken: token })
    expect(res.statusCode).toBe(201)
    const regular = client(t.app, cookie)

    const body = { email: 'x@example.com' }
    for (const api of [client(t.app), regular, bearer(t.app, key)]) {
      const results = [
        await api.get('/admin/invitations'),
        await api.post('/admin/invitations', body),
        await api.post(`/admin/invitations/${invited.id}/resend`),
        await api.delete(`/admin/invitations/${invited.id}`),
      ]
      for (const r of results) expect([401, 403]).toContain(r.status)
      if (api === regular) for (const r of results) expect(r.status).toBe(403)
    }
    expect(actions()).not.toContain('admin.invitation_revoked')
  })
})

describe('admin invitations', () => {
  it('sends a platform invitation that works for registration and becomes accepted', async () => {
    const { admin } = await setup()
    const created = await admin.api.post('/admin/invitations', { email: 'new@example.com' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      email: 'new@example.com',
      workspaceId: null,
      role: null,
      status: 'pending',
      invitedByName: 'Admin',
    })
    expect(t.mailer.sent).toHaveLength(1)

    const token = tokenFromLastMail(t.mailer)
    expect(
      (await register(t.app, { email: 'new@example.com', inviteToken: token })).res.statusCode,
    ).toBe(201)

    const list = await admin.api.get('/admin/invitations?status=accepted')
    expect(list.body.data.map((i: { email: string }) => i.email)).toEqual(['new@example.com'])
    expect(list.body.data[0].acceptedAt).not.toBeNull()
    // Az egyszer használt meghívó már nem várakozik.
    expect((await admin.api.get('/admin/invitations?status=pending')).body.data).toEqual([])
    // A nyers token sehol nincs a válaszban.
    expect(JSON.stringify(list.body)).not.toContain(token)
  })

  it('rejects an invitation for an already registered email', async () => {
    const { admin } = await setup()
    const res = await admin.api.post('/admin/invitations', { email: 'admin@example.com' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('email_taken')
  })

  it('invites to a workspace with a role', async () => {
    const { admin } = await setup()
    const ws = (await admin.api.get('/workspaces')).body.data[0]
    const created = await admin.api.post('/admin/invitations', {
      email: 'guest@example.com',
      workspaceId: ws.id,
      role: 'viewer',
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      workspaceId: ws.id,
      workspaceName: ws.name,
      role: 'viewer',
      status: 'pending',
    })
    expect(t.mailer.last().text).toContain('/invitations/accept?token=')

    // A meghívottat a munkaterületi folyamat fogadja el, és a tagság létrejön.
    const token = tokenFromLastMail(t.mailer)
    const guest = await register(t.app, { email: 'guest@example.com', inviteToken: token })
    expect(guest.res.statusCode).toBe(201)
    const members = (await admin.api.get(`/workspaces/${ws.id}/members`)).body.data
    expect(members.find((m: { email: string }) => m.email === 'guest@example.com').role).toBe(
      'viewer',
    )

    const again = await admin.api.post('/admin/invitations', {
      email: 'guest@example.com',
      workspaceId: ws.id,
      role: 'member',
    })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('already_member')
  })

  it('validates the body: workspace and role come together, role must be invitable', async () => {
    const { admin } = await setup()
    const ws = (await admin.api.get('/workspaces')).body.data[0]
    expect(
      (await admin.api.post('/admin/invitations', { email: 'a@example.com', workspaceId: ws.id }))
        .status,
    ).toBe(400)
    expect(
      (await admin.api.post('/admin/invitations', { email: 'a@example.com', role: 'member' }))
        .status,
    ).toBe(400)
    expect(
      (
        await admin.api.post('/admin/invitations', {
          email: 'a@example.com',
          workspaceId: ws.id,
          role: 'owner',
        })
      ).status,
    ).toBe(400)
    expect((await admin.api.post('/admin/invitations', { email: 'nope' })).status).toBe(400)
    expect(
      (
        await admin.api.post('/admin/invitations', {
          email: 'a@example.com',
          workspaceId: 'missing',
          role: 'member',
        })
      ).status,
    ).toBe(404)
  })

  it('revokes only pending invitations and shows them as revoked', async () => {
    const { admin } = await setup()
    const inv = (await admin.api.post('/admin/invitations', { email: 'r@example.com' })).body
    expect((await admin.api.delete(`/admin/invitations/${inv.id}`)).status).toBe(204)

    const revoked = await admin.api.get('/admin/invitations?status=revoked')
    expect(revoked.body.data.map((i: { id: string }) => i.id)).toEqual([inv.id])
    // A visszavont meghívó tokenje nem használható regisztrációhoz.
    const token = tokenFromLastMail(t.mailer)
    expect(
      (await register(t.app, { email: 'r@example.com', inviteToken: token })).res.statusCode,
    ).toBe(403)

    const twice = await admin.api.delete(`/admin/invitations/${inv.id}`)
    expect(twice.status).toBe(409)
    expect(twice.body.error.code).toBe('invitation_not_pending')
    expect((await admin.api.delete('/admin/invitations/missing')).status).toBe(404)
    expect(actions()).toContain('admin.invitation_revoked')
  })

  it('resends by issuing a new invitation and expiring the old one', async () => {
    const { admin } = await setup()
    const old = (await admin.api.post('/admin/invitations', { email: 'r@example.com' })).body
    const oldToken = tokenFromLastMail(t.mailer)

    const resent = await admin.api.post(`/admin/invitations/${old.id}/resend`)
    expect(resent.status).toBe(201)
    expect(resent.body.id).not.toBe(old.id)
    expect(resent.body.status).toBe('pending')
    expect(t.mailer.sent).toHaveLength(2)

    // A régi token lejárt, az új működik.
    expect(
      (await register(t.app, { email: 'r@example.com', inviteToken: oldToken })).res.statusCode,
    ).toBe(403)
    const newToken = tokenFromLastMail(t.mailer)
    expect(newToken).not.toBe(oldToken)
    expect(
      (await register(t.app, { email: 'r@example.com', inviteToken: newToken })).res.statusCode,
    ).toBe(201)

    // Az elfogadott meghívó nem küldhető újra.
    const accepted = await admin.api.post(`/admin/invitations/${resent.body.id}/resend`)
    expect(accepted.status).toBe(409)
    expect(accepted.body.error.code).toBe('invitation_not_resendable')
  })

  it('shows a workspace invitation revoked in the workspace as revoked', async () => {
    const { admin } = await setup()
    const ws = (await admin.api.get('/workspaces')).body.data[0]
    const inv = (
      await admin.api.post(`/workspaces/${ws.id}/invitations`, {
        email: 'w@example.com',
        role: 'member',
      })
    ).body
    expect((await admin.api.delete(`/workspaces/${ws.id}/invitations/${inv.id}`)).status).toBe(204)
    const revoked = await admin.api.get('/admin/invitations?status=revoked')
    expect(revoked.body.data.map((i: { id: string }) => i.id)).toEqual([inv.id])
  })

  it('paginates with a cursor and audits creation and resend', async () => {
    const { admin } = await setup()
    for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
      await admin.api.post('/admin/invitations', { email })
    }
    const page1 = await admin.api.get('/admin/invitations?limit=2')
    expect(page1.body.data.map((i: { email: string }) => i.email)).toEqual([
      'c@example.com',
      'b@example.com',
    ])
    const page2 = await admin.api.get(`/admin/invitations?limit=2&cursor=${page1.body.nextCursor}`)
    expect(page2.body.data.map((i: { email: string }) => i.email)).toEqual(['a@example.com'])
    expect(page2.body.nextCursor).toBeNull()

    const first = page2.body.data[0]
    await admin.api.post(`/admin/invitations/${first.id}/resend`)
    expect(actions()).toEqual(
      expect.arrayContaining(['admin.invitation_created', 'admin.invitation_resent']),
    )
  })
})
