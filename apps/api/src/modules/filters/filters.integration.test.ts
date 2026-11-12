import { beforeEach, describe, expect, it } from 'vitest'
import { workspaceMembers } from '../../db/schema.js'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const viewer = await signUp(t.app, 'viewer@example.com', 'Vera')
  const stranger = await signUp(t.app, 'stranger@example.com', 'Samu')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  t.db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: viewer.user.id, role: 'viewer' })
    .run()
  const board = (
    await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T', visibility: 'workspace' })
  ).body
  return { owner, viewer, stranger, board }
}

describe('saved filters', () => {
  it('saves, lists and deletes my own filters', async () => {
    const { owner, board } = await setup()
    const created = await owner.api.post(`/boards/${board.id}/filters`, {
      name: 'Sürgős',
      filter: { priorities: ['high'], due: ['overdue', 'soon'] },
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      name: 'Sürgős',
      boardId: board.id,
      filter: { priorities: ['high'], labelIds: [], assigneeIds: [], due: ['overdue', 'soon'] },
    })
    const list = (await owner.api.get(`/boards/${board.id}/filters`)).body.data
    expect(list.map((f: { name: string }) => f.name)).toEqual(['Sürgős'])

    expect((await owner.api.delete(`/filters/${created.body.id}`)).status).toBe(204)
    expect((await owner.api.get(`/boards/${board.id}/filters`)).body.data).toEqual([])
  })

  it('rejects a duplicate name and an invalid filter', async () => {
    const { owner, board } = await setup()
    const body = { name: 'A', filter: {} }
    expect((await owner.api.post(`/boards/${board.id}/filters`, body)).status).toBe(201)
    const dup = await owner.api.post(`/boards/${board.id}/filters`, body)
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('filter_name_taken')
    expect(
      (await owner.api.post(`/boards/${board.id}/filters`, { name: 'B', filter: { due: ['x'] } }))
        .status,
    ).toBe(400)
  })

  it('keeps filters private to their owner', async () => {
    const { owner, viewer, board } = await setup()
    const mine = (await owner.api.post(`/boards/${board.id}/filters`, { name: 'A', filter: {} }))
      .body
    // a megtekintő is menthet saját szűrőt, de nem látja és nem törölheti másét
    expect(
      (await viewer.api.post(`/boards/${board.id}/filters`, { name: 'A', filter: {} })).status,
    ).toBe(201)
    expect((await viewer.api.get(`/boards/${board.id}/filters`)).body.data).toHaveLength(1)
    expect((await viewer.api.delete(`/filters/${mine.id}`)).status).toBe(404)
    expect((await owner.api.get(`/boards/${board.id}/filters`)).body.data).toHaveLength(1)
  })

  it('hides the board from strangers and is session-only for API keys', async () => {
    const { owner, stranger, board } = await setup()
    expect((await stranger.api.get(`/boards/${board.id}/filters`)).status).toBe(404)
    expect(
      (await stranger.api.post(`/boards/${board.id}/filters`, { name: 'A', filter: {} })).status,
    ).toBe(404)
    const key = (await owner.api.post('/api-keys', { name: 'k', scopes: ['boards:read'] })).body
      .key as string
    const res = await bearer(t.app, key).get(`/boards/${board.id}/filters`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('session_required')
  })

  it('filters the card list by assignee', async () => {
    const { owner, board } = await setup()
    const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
    const mine = (
      await owner.api.post(`/columns/${col.id}/cards`, { title: 'Enyém', assigneeIds: [] })
    ).body
    const me = (await owner.api.get('/auth/me')).body.id as string
    await owner.api.patch(`/cards/${mine.id}`, { assigneeIds: [me] })
    await owner.api.post(`/columns/${col.id}/cards`, { title: 'Senkié' })
    const res = (await owner.api.get(`/boards/${board.id}/cards?assigneeId=${me}`)).body
    expect(res.data.map((c: { title: string }) => c.title)).toEqual(['Enyém'])
  })
})
