import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T' })).body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const other = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Done' })).body
  const card = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'K' })).body
  return { owner, col, other, card }
}

describe('optimistic locking', () => {
  it('accepts a matching version and bumps it', async () => {
    const { owner, card } = await setup()
    const res = await owner.api.patch(`/cards/${card.id}`, { title: 'Új', version: card.version })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ title: 'Új', version: card.version + 1 })
  })

  it('rejects a stale version on update with the current card', async () => {
    const { owner, card } = await setup()
    await owner.api.patch(`/cards/${card.id}`, { title: 'Első' })
    const res = await owner.api.patch(`/cards/${card.id}`, {
      title: 'Második',
      version: card.version,
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('version_conflict')
    expect(res.body.error.details).toMatchObject({
      currentVersion: card.version + 1,
      card: { id: card.id, title: 'Első' },
    })
    expect((await owner.api.get(`/cards/${card.id}`)).body.title).toBe('Első')
  })

  it('rejects a stale version on move', async () => {
    const { owner, card, other } = await setup()
    await owner.api.patch(`/cards/${card.id}`, { title: 'Első' })
    const stale = await owner.api.post(`/cards/${card.id}/move`, {
      columnId: other.id,
      version: card.version,
    })
    expect(stale.status).toBe(409)
    const ok = await owner.api.post(`/cards/${card.id}/move`, {
      columnId: other.id,
      version: card.version + 1,
    })
    expect(ok.status).toBe(200)
    expect(ok.body.columnId).toBe(other.id)
  })

  it('stays last-write-wins without a version, and a version alone is not an update', async () => {
    const { owner, card } = await setup()
    await owner.api.patch(`/cards/${card.id}`, { title: 'A' })
    expect((await owner.api.patch(`/cards/${card.id}`, { title: 'B' })).status).toBe(200)
    expect((await owner.api.patch(`/cards/${card.id}`, { version: 1 })).status).toBe(400)
  })
})
