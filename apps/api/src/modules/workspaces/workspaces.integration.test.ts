import { beforeEach, describe, expect, it } from 'vitest'
import { WORKSPACE_ROLES, type WorkspaceRole } from '@taskflow/shared'
import { createTestApp, login, register, signUp, tokenFromLastMail } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

type Person = Awaited<ReturnType<typeof signUp>>

/** `owner` létrehoz egy munkaterületet, és minden megadott szerepkörhöz felvesz egy tagot. */
async function setup(roles: WorkspaceRole[] = []) {
  const owner = await signUp(t.app, 'boss@example.com')
  const ws = (await owner.api.post('/workspaces', { name: 'Csapat' })).body
  const people: Record<string, Person> = {}
  for (const role of roles) {
    const person = await signUp(t.app, `${role}@example.com`)
    if (role === 'owner') {
      await owner.api.post(`/workspaces/${ws.id}/invitations`, {
        email: `${role}@example.com`,
        role: 'admin',
      })
      await person.api.post('/invitations/accept', { token: tokenFromLastMail(t.mailer) })
      await owner.api.patch(`/workspaces/${ws.id}/members/${person.user.id}`, { role: 'owner' })
    } else {
      await owner.api.post(`/workspaces/${ws.id}/invitations`, {
        email: `${role}@example.com`,
        role,
      })
      await person.api.post('/invitations/accept', { token: tokenFromLastMail(t.mailer) })
    }
    people[role] = person
  }
  return { owner, ws, people }
}

describe('workspaces', () => {
  it('every user gets a personal workspace on registration', async () => {
    const a = await signUp(t.app, 'a@example.com', 'Anna')
    const list = (await a.api.get('/workspaces')).body.data
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Anna', role: 'owner', slug: 'anna' })
  })

  it('creates, reads and renames a workspace; non-members see 404', async () => {
    const { owner, ws } = await setup()
    expect(ws).toMatchObject({ name: 'Csapat', role: 'owner' })
    expect((await owner.api.get(`/workspaces/${ws.id}`)).status).toBe(200)
    expect((await owner.api.patch(`/workspaces/${ws.id}`, { name: 'Új név' })).body.name).toBe(
      'Új név',
    )
    expect((await owner.api.post('/workspaces', { name: '  ' })).status).toBe(400)

    const stranger = await signUp(t.app, 'stranger@example.com')
    expect((await stranger.api.get(`/workspaces/${ws.id}`)).status).toBe(404)
    expect((await stranger.api.patch(`/workspaces/${ws.id}`, { name: 'x' })).status).toBe(404)
    expect((await stranger.api.get(`/workspaces/${ws.id}/members`)).status).toBe(404)
    expect((await stranger.api.get(`/workspaces/${ws.id}`)).body.error.code).toBe('not_found')
  })

  it('requires login', async () => {
    const { ws } = await setup()
    const { client } = await import('../../testing/helpers.js')
    expect((await client(t.app).get('/workspaces')).status).toBe(401)
    expect((await client(t.app).get(`/workspaces/${ws.id}`)).status).toBe(401)
  })

  const expectations: Record<
    WorkspaceRole,
    { read: number; rename: number; remove: number; members: number; invite: number }
  > = {
    owner: { read: 200, rename: 200, remove: 204, members: 200, invite: 201 },
    admin: { read: 200, rename: 200, remove: 403, members: 200, invite: 201 },
    member: { read: 200, rename: 403, remove: 403, members: 200, invite: 403 },
    viewer: { read: 200, rename: 403, remove: 403, members: 200, invite: 403 },
  }
  for (const role of WORKSPACE_ROLES) {
    it(`permissions of a ${role}`, async () => {
      const { ws, people } = await setup([role])
      const api = people[role]!.api
      const want = expectations[role]
      expect((await api.get(`/workspaces/${ws.id}`)).status).toBe(want.read)
      expect((await api.get(`/workspaces/${ws.id}/members`)).status).toBe(want.members)
      expect((await api.patch(`/workspaces/${ws.id}`, { name: 'Átnevezve' })).status).toBe(
        want.rename,
      )
      expect(
        (
          await api.post(`/workspaces/${ws.id}/invitations`, {
            email: 'new@example.com',
            role: 'member',
          })
        ).status,
      ).toBe(want.invite)
      expect((await api.get(`/workspaces/${ws.id}/invitations`)).status).toBe(
        want.invite === 201 ? 200 : 403,
      )
      expect((await api.delete(`/workspaces/${ws.id}`)).status).toBe(want.remove)
    })
  }

  it('an empty workspace can be deleted only by its owner; it then disappears', async () => {
    const { owner, ws } = await setup()
    expect((await owner.api.delete(`/workspaces/${ws.id}`)).status).toBe(204)
    expect((await owner.api.get(`/workspaces/${ws.id}`)).status).toBe(404)
  })
})

describe('invitations', () => {
  it('invites by email, the invitee accepts and becomes a member with the invited role', async () => {
    const { owner, ws } = await setup()
    const guest = await signUp(t.app, 'guest@example.com')
    const invited = await owner.api.post(`/workspaces/${ws.id}/invitations`, {
      email: 'Guest@Example.com',
      role: 'viewer',
    })
    expect(invited.status).toBe(201)
    expect(invited.body).toMatchObject({ email: 'guest@example.com', role: 'viewer' })
    expect(invited.body).not.toHaveProperty('token')
    expect(t.mailer.last().to).toBe('guest@example.com')
    expect(t.mailer.last().text).toContain('Csapat')

    expect((await owner.api.get(`/workspaces/${ws.id}/invitations`)).body.data).toHaveLength(1)

    const token = tokenFromLastMail(t.mailer)
    const accepted = await guest.api.post('/invitations/accept', { token })
    expect(accepted.status).toBe(200)
    expect(accepted.body).toMatchObject({ id: ws.id, role: 'viewer' })
    expect((await owner.api.get(`/workspaces/${ws.id}/invitations`)).body.data).toHaveLength(0)
    expect((await guest.api.get(`/workspaces/${ws.id}`)).status).toBe(200)

    expect((await guest.api.post('/invitations/accept', { token })).status).toBe(400)
  })

  it('rejects wrong, foreign-address and expired invitations', async () => {
    const { owner, ws } = await setup()
    const guest = await signUp(t.app, 'guest@example.com')
    const other = await signUp(t.app, 'other@example.com')
    await owner.api.post(`/workspaces/${ws.id}/invitations`, { email: 'guest@example.com' })
    const token = tokenFromLastMail(t.mailer)

    expect((await guest.api.post('/invitations/accept', { token: 'nope' })).status).toBe(400)
    const mismatch = await other.api.post('/invitations/accept', { token })
    expect(mismatch.status).toBe(403)
    expect(mismatch.body.error.code).toBe('invitation_email_mismatch')

    const { invitations } = await import('../../db/schema.js')
    t.db
      .update(invitations)
      .set({ expiresAt: new Date(0) })
      .run()
    expect((await guest.api.post('/invitations/accept', { token })).status).toBe(400)
    expect((await guest.api.get(`/workspaces/${ws.id}`)).status).toBe(404)
  })

  it('refuses to invite existing members and replaces older pending invitations', async () => {
    const { owner, ws } = await setup(['member'])
    const dup = await owner.api.post(`/workspaces/${ws.id}/invitations`, {
      email: 'member@example.com',
    })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('already_member')

    await owner.api.post(`/workspaces/${ws.id}/invitations`, { email: 'new@example.com' })
    const first = tokenFromLastMail(t.mailer)
    await owner.api.post(`/workspaces/${ws.id}/invitations`, {
      email: 'new@example.com',
      role: 'admin',
    })
    const second = tokenFromLastMail(t.mailer)
    expect((await owner.api.get(`/workspaces/${ws.id}/invitations`)).body.data).toHaveLength(1)
    const newcomer = await signUp(t.app, 'new@example.com')
    expect((await newcomer.api.post('/invitations/accept', { token: first })).status).toBe(400)
    expect((await newcomer.api.post('/invitations/accept', { token: second })).body.role).toBe(
      'admin',
    )
  })

  it('owners can revoke a pending invitation', async () => {
    const { owner, ws } = await setup()
    const guest = await signUp(t.app, 'guest@example.com')
    const inv = (
      await owner.api.post(`/workspaces/${ws.id}/invitations`, { email: 'guest@example.com' })
    ).body
    expect((await owner.api.delete(`/workspaces/${ws.id}/invitations/${inv.id}`)).status).toBe(204)
    expect(
      (await guest.api.post('/invitations/accept', { token: tokenFromLastMail(t.mailer) })).status,
    ).toBe(400)
    expect((await owner.api.delete(`/workspaces/${ws.id}/invitations/nope`)).status).toBe(404)
  })

  it('an admin cannot be used to escalate: invitable roles exclude owner', async () => {
    const { owner, ws } = await setup()
    expect(
      (
        await owner.api.post(`/workspaces/${ws.id}/invitations`, {
          email: 'x@example.com',
          role: 'owner',
        })
      ).status,
    ).toBe(400)
  })

  it('registering with a workspace invitation in closed mode joins the workspace', async () => {
    const closed = createTestApp()
    const admin = await register(closed.app, { email: 'admin@example.com' })
    const { client } = await import('../../testing/helpers.js')
    const api = client(closed.app, admin.cookie)
    const ws = (await api.post('/workspaces', { name: 'Zárt' })).body
    await api.post(`/workspaces/${ws.id}/invitations`, { email: 'new@example.com', role: 'member' })
    const token = tokenFromLastMail(closed.mailer)

    const denied = await register(closed.app, { email: 'new@example.com' })
    expect(denied.res.statusCode).toBe(403)

    const joined = await register(closed.app, { email: 'new@example.com', inviteToken: token })
    expect(joined.res.statusCode).toBe(201)
    const list = (await client(closed.app, joined.cookie).get('/workspaces')).body.data
    expect(list.map((w: { name: string; role: string }) => `${w.name}:${w.role}`).sort()).toEqual([
      'Teszt Elek:owner',
      'Zárt:member',
    ])
    expect((await login(closed.app, 'new@example.com')).res.statusCode).toBe(200)
  })
})

describe('members', () => {
  it('lists members with roles to any member', async () => {
    const { ws, people } = await setup(['viewer'])
    const members = (await people.viewer!.api.get(`/workspaces/${ws.id}/members`)).body.data
    expect(members.map((m: { role: string }) => m.role).sort()).toEqual(['owner', 'viewer'])
    expect(members[0]).toHaveProperty('email')
    expect(members[0]).not.toHaveProperty('passwordHash')
  })

  it('owner changes roles; admin manages only non-owners and cannot grant ownership', async () => {
    const { owner, ws, people } = await setup(['admin', 'member'])
    const admin = people.admin!
    const member = people.member!
    expect(
      (await owner.api.patch(`/workspaces/${ws.id}/members/${member.user.id}`, { role: 'viewer' }))
        .body.role,
    ).toBe('viewer')

    expect(
      (await admin.api.patch(`/workspaces/${ws.id}/members/${member.user.id}`, { role: 'owner' }))
        .status,
    ).toBe(403)
    expect(
      (await admin.api.patch(`/workspaces/${ws.id}/members/${owner.user.id}`, { role: 'member' }))
        .status,
    ).toBe(403)
    expect((await admin.api.delete(`/workspaces/${ws.id}/members/${owner.user.id}`)).status).toBe(
      403,
    )

    expect(
      (await member.api.patch(`/workspaces/${ws.id}/members/${admin.user.id}`, { role: 'viewer' }))
        .status,
    ).toBe(403)
    expect((await member.api.delete(`/workspaces/${ws.id}/members/${admin.user.id}`)).status).toBe(
      403,
    )
    expect(
      (await admin.api.patch(`/workspaces/${ws.id}/members/${member.user.id}`, { role: 'admin' }))
        .status,
    ).toBe(200)
  })

  it('protects the last owner from demotion, removal and leaving', async () => {
    const { owner, ws } = await setup()
    const demote = await owner.api.patch(`/workspaces/${ws.id}/members/${owner.user.id}`, {
      role: 'member',
    })
    expect(demote.status).toBe(409)
    expect(demote.body.error.code).toBe('last_owner')
    expect((await owner.api.delete(`/workspaces/${ws.id}/members/${owner.user.id}`)).status).toBe(
      409,
    )
  })

  it('a second owner lets the first one step down or leave', async () => {
    const { owner, ws, people } = await setup(['owner'])
    expect(
      (await owner.api.patch(`/workspaces/${ws.id}/members/${owner.user.id}`, { role: 'member' }))
        .status,
    ).toBe(200)
    expect(
      (await people.owner!.api.delete(`/workspaces/${ws.id}/members/${owner.user.id}`)).status,
    ).toBe(204)
    expect((await owner.api.get(`/workspaces/${ws.id}`)).status).toBe(404)
  })

  it('members can leave on their own; admins can remove others', async () => {
    const { ws, people } = await setup(['admin', 'member', 'viewer'])
    expect(
      (await people.admin!.api.delete(`/workspaces/${ws.id}/members/${people.viewer!.user.id}`))
        .status,
    ).toBe(204)
    expect((await people.viewer!.api.get(`/workspaces/${ws.id}`)).status).toBe(404)
    expect(
      (await people.member!.api.delete(`/workspaces/${ws.id}/members/${people.member!.user.id}`))
        .status,
    ).toBe(204)
    expect((await people.member!.api.get(`/workspaces/${ws.id}`)).status).toBe(404)
    expect(
      (await people.admin!.api.delete(`/workspaces/${ws.id}/members/${people.member!.user.id}`))
        .status,
    ).toBe(404)
  })
})
