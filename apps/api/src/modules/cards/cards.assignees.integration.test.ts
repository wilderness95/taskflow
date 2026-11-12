import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup(visibility: 'private' | 'workspace' = 'workspace') {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const member = await signUp(t.app, 'member@example.com', 'Marci')
  const stranger = await signUp(t.app, 'stranger@example.com', 'Samu')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  // A munkaterület tagja lesz a "member" (közvetlen DB-beszúrás helyett meghívó nélkül: tagság API).
  const { workspaceMembers } = await import('../../db/schema.js')
  t.db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: member.user.id, role: 'member' })
    .run()
  const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T', visibility }))
    .body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  return { owner, member, stranger, board, col }
}

describe('card assignees', () => {
  it('assigns participants on create and update, and shows them on the board', async () => {
    const { owner, member, board, col } = await setup()
    const card = (
      await owner.api.post(`/columns/${col.id}/cards`, {
        title: 'K',
        assigneeIds: [member.user.id],
      })
    ).body
    expect(card.assigneeIds).toEqual([member.user.id])

    const updated = (
      await owner.api.patch(`/cards/${card.id}`, { assigneeIds: [owner.user.id, member.user.id] })
    ).body
    expect(updated.assigneeIds).toEqual([owner.user.id, member.user.id])

    const cleared = (await owner.api.patch(`/cards/${card.id}`, { assigneeIds: [] })).body
    expect(cleared.assigneeIds).toEqual([])

    await owner.api.patch(`/cards/${card.id}`, { assigneeIds: [member.user.id] })
    const full = (await owner.api.get(`/boards/${board.id}`)).body
    expect(full.columns[0].cards[0].assigneeIds).toEqual([member.user.id])
    const snapshot = (await owner.api.get(`/boards/${board.id}/snapshot`)).body
    expect(snapshot.columns[0].cards[0].assigneeIds).toEqual([member.user.id])
  })

  it('rejects users without access to the board', async () => {
    const { owner, stranger, col } = await setup()
    const res = await owner.api.post(`/columns/${col.id}/cards`, {
      title: 'K',
      assigneeIds: [stranger.user.id],
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('invalid_assignee')
  })

  it('does not allow assigning workspace members who cannot see a private board', async () => {
    const { owner, member, col } = await setup('private')
    const res = await owner.api.post(`/columns/${col.id}/cards`, {
      title: 'K',
      assigneeIds: [member.user.id],
    })
    expect(res.status).toBe(422)
  })

  it('lists participants for readers only', async () => {
    const { owner, member, stranger, board } = await setup()
    const list = (await owner.api.get(`/boards/${board.id}/participants`)).body.data
    expect(list.map((p: { name: string }) => p.name)).toEqual(['Marci', 'Olga'])
    expect(list[0]).toMatchObject({ userId: member.user.id, role: expect.any(String) })
    expect((await member.api.get(`/boards/${board.id}/participants`)).status).toBe(200)
    expect((await stranger.api.get(`/boards/${board.id}/participants`)).status).toBe(404)
  })

  it('requires write access to change assignees', async () => {
    const { owner, member, board, col } = await setup()
    const card = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'K' })).body
    const { workspaceMembers } = await import('../../db/schema.js')
    t.db
      .update(workspaceMembers)
      .set({ role: 'viewer' })
      .where(eq(workspaceMembers.userId, member.user.id))
      .run()
    expect(
      (await member.api.patch(`/cards/${card.id}`, { assigneeIds: [owner.user.id] })).status,
    ).toBe(403)
    expect((await member.api.get(`/boards/${board.id}/participants`)).status).toBe(200)
  })

  it('works with API keys, and respects the read scope', async () => {
    const { owner, member, board, col } = await setup()
    const card = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'K' })).body
    const readKey = (await owner.api.post('/api-keys', { name: 'r', scopes: ['boards:read'] })).body
    const writeKey = (
      await owner.api.post('/api-keys', { name: 'w', scopes: ['boards:read', 'boards:write'] })
    ).body
    const body = { assigneeIds: [member.user.id] }
    expect((await bearer(t.app, readKey.key).patch(`/cards/${card.id}`, body)).status).toBe(403)
    const ok = await bearer(t.app, writeKey.key).patch(`/cards/${card.id}`, body)
    expect(ok.body.assigneeIds).toEqual([member.user.id])
    expect((await bearer(t.app, readKey.key).get(`/boards/${board.id}/participants`)).status).toBe(
      200,
    )
  })
})
