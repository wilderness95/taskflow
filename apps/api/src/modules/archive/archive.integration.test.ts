import { beforeEach, describe, expect, it } from 'vitest'
import { workspaceMembers } from '../../db/schema.js'
import { createTestApp, signUp } from '../../testing/helpers.js'

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
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const card = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'K' })).body
  return { owner, viewer, stranger, ws, board, col, card }
}

describe('archiving cards', () => {
  it('hides an archived card and restores it to the end of its column', async () => {
    const { owner, board, col, card } = await setup()
    const second = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'L' })).body

    const archived = await owner.api.post(`/cards/${card.id}/archive`)
    expect(archived.status).toBe(200)
    expect((await owner.api.get(`/cards/${card.id}`)).status).toBe(404)
    const view = (await owner.api.get(`/boards/${board.id}`)).body
    expect(view.columns[0].cards.map((c: { id: string }) => c.id)).toEqual([second.id])

    const list = (await owner.api.get(`/boards/${board.id}/archive`)).body
    expect(list.cards.map((c: { id: string }) => c.id)).toEqual([card.id])

    const restored = await owner.api.post(`/cards/${card.id}/restore`)
    expect(restored.status).toBe(200)
    const after = (await owner.api.get(`/boards/${board.id}`)).body
    expect(after.columns[0].cards.map((c: { id: string }) => c.id)).toEqual([second.id, card.id])
    expect((await owner.api.get(`/boards/${board.id}/archive`)).body.cards).toEqual([])
  })

  it('does not restore a card whose column is archived', async () => {
    const { owner, col, card } = await setup()
    await owner.api.post(`/cards/${card.id}/archive`)
    await owner.api.post(`/columns/${col.id}/archive`)
    const res = await owner.api.post(`/cards/${card.id}/restore`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('column_archived')
    await owner.api.post(`/columns/${col.id}/restore`)
    expect((await owner.api.post(`/cards/${card.id}/restore`)).status).toBe(200)
  })

  it('restoring an active card is 404; viewers and strangers cannot archive or restore', async () => {
    const { owner, viewer, stranger, card } = await setup()
    expect((await owner.api.post(`/cards/${card.id}/restore`)).status).toBe(404)
    expect((await viewer.api.post(`/cards/${card.id}/archive`)).status).toBe(403)
    expect((await stranger.api.post(`/cards/${card.id}/archive`)).status).toBe(404)
    await owner.api.post(`/cards/${card.id}/archive`)
    expect((await viewer.api.post(`/cards/${card.id}/restore`)).status).toBe(403)
    expect((await stranger.api.post(`/cards/${card.id}/restore`)).status).toBe(404)
  })
})

describe('archiving columns', () => {
  it('hides the column with its cards and restores it', async () => {
    const { owner, board, col, card } = await setup()
    expect((await owner.api.post(`/columns/${col.id}/archive`)).status).toBe(200)
    expect((await owner.api.get(`/boards/${board.id}`)).body.columns).toEqual([])
    expect((await owner.api.get(`/boards/${board.id}/cards`)).body.data).toEqual([])
    expect((await owner.api.get(`/boards/${board.id}/archive`)).body.columns).toHaveLength(1)
    // archivált oszlopba nem lehet kártyát tenni
    expect((await owner.api.post(`/columns/${col.id}/cards`, { title: 'X' })).status).toBe(404)

    expect((await owner.api.post(`/columns/${col.id}/restore`)).status).toBe(200)
    const view = (await owner.api.get(`/boards/${board.id}`)).body
    expect(view.columns[0].cards[0].id).toBe(card.id)
  })

  it('does not move cards into an archived column; viewers are forbidden', async () => {
    const { owner, viewer, board, card } = await setup()
    const other = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'B' })).body
    await owner.api.post(`/columns/${other.id}/archive`)
    const res = await owner.api.post(`/cards/${card.id}/move`, { columnId: other.id })
    expect(res.status).toBe(404)
    expect((await viewer.api.post(`/columns/${other.id}/restore`)).status).toBe(403)
  })
})

describe('archiving boards', () => {
  it('lists archived boards for admins and restores them', async () => {
    const { owner, ws, board } = await setup()
    expect((await owner.api.delete(`/boards/${board.id}`)).status).toBe(204)
    expect((await owner.api.get(`/workspaces/${ws.id}/boards`)).body.data).toEqual([])
    const archived = (await owner.api.get(`/workspaces/${ws.id}/boards?archived=true`)).body.data
    expect(archived.map((b: { id: string }) => b.id)).toEqual([board.id])

    expect((await owner.api.post(`/boards/${board.id}/restore`)).status).toBe(200)
    expect((await owner.api.get(`/workspaces/${ws.id}/boards`)).body.data).toHaveLength(1)
    expect((await owner.api.post(`/boards/${board.id}/restore`)).status).toBe(404)
  })

  it('hides archived boards from non-admins and forbids their restore', async () => {
    const { owner, viewer, stranger, ws, board } = await setup()
    await owner.api.delete(`/boards/${board.id}`)
    expect((await viewer.api.get(`/workspaces/${ws.id}/boards?archived=true`)).body.data).toEqual(
      [],
    )
    expect((await viewer.api.post(`/boards/${board.id}/restore`)).status).toBe(403)
    expect((await stranger.api.post(`/boards/${board.id}/restore`)).status).toBe(404)
  })
})
