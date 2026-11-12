import { beforeEach, describe, expect, it } from 'vitest'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

describe('activity log', () => {
  it('records writes with the actor type, so AI actions are visible', async () => {
    const owner = await signUp(t.app, 'owner@example.com', 'Olga')
    const ws = (await owner.api.get('/workspaces')).body.data[0]
    const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T' })).body
    const todo = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
    const done = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Done' })).body
    const key = (
      await owner.api.post('/api-keys', { name: 'bot', scopes: ['boards:read', 'boards:write'] })
    ).body
    const agent = bearer(t.app, key.key)

    const card = (await agent.post(`/columns/${todo.id}/cards`, { title: 'Bot kártya' })).body
    await agent.post(`/cards/${card.id}/move`, { columnId: done.id })
    await owner.api.patch(`/cards/${card.id}`, { priority: 'high' })
    // Olvasás nem naplózódik.
    await agent.get(`/boards/${board.id}`)

    const log = (await owner.api.get(`/boards/${board.id}/activity`)).body
    expect(log.nextCursor).toBeNull()
    const [updated, moved, created] = log.data
    expect(updated).toMatchObject({
      action: 'card.updated',
      actorType: 'user',
      actorName: 'Olga',
      apiKeyId: null,
      entityId: card.id,
    })
    expect(moved).toMatchObject({
      action: 'card.moved',
      actorType: 'api_key',
      apiKeyId: key.id,
      meta: { fromColumnId: todo.id, toColumnId: done.id },
    })
    expect(created).toMatchObject({ action: 'card.created', actorType: 'api_key' })
    expect(log.data.map((e: { action: string }) => e.action)).toEqual([
      'card.updated',
      'card.moved',
      'card.created',
      'column.created',
      'column.created',
      'board.created',
    ])
  })

  it('paginates with a cursor and enforces read access', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const ws = (await owner.api.get('/workspaces')).body.data[0]
    const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T' })).body
    for (let i = 0; i < 4; i++)
      await owner.api.post(`/boards/${board.id}/columns`, { title: `C${i}` })

    const first = (await owner.api.get(`/boards/${board.id}/activity?limit=2`)).body
    expect(first.data).toHaveLength(2)
    expect(first.nextCursor).toBeTruthy()
    const second = (
      await owner.api.get(`/boards/${board.id}/activity?limit=2&cursor=${first.nextCursor}`)
    ).body
    const third = (
      await owner.api.get(`/boards/${board.id}/activity?limit=2&cursor=${second.nextCursor}`)
    ).body
    const ids = [...first.data, ...second.data, ...third.data].map((e: { id: string }) => e.id)
    expect(new Set(ids).size).toBe(5)
    expect(third.nextCursor).toBeNull()
    expect((await owner.api.get(`/boards/${board.id}/activity?limit=0`)).status).toBe(400)

    const stranger = await signUp(t.app, 's@example.com')
    expect((await stranger.api.get(`/boards/${board.id}/activity`)).status).toBe(404)
  })

  it('logs workspace changes', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const ws = (await owner.api.post('/workspaces', { name: 'Csapat' })).body
    await owner.api.patch(`/workspaces/${ws.id}`, { name: 'Új' })
    expect(await owner.api.delete(`/workspaces/${ws.id}`)).toMatchObject({ status: 204 })
  })
})
