import { beforeEach, describe, expect, it } from 'vitest'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T' })).body
  const todo = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const key = (await owner.api.post('/api-keys', { name: 'bot', scopes: ['boards:write'] })).body
  return { owner, board, todo, key: key.key as string }
}

describe('Idempotency-Key', () => {
  it('replays the stored response instead of repeating the write', async () => {
    const { owner, board, todo, key } = await setup()
    const agent = bearer(t.app, key, { 'idempotency-key': 'req-1' })

    const first = await agent.post(`/columns/${todo.id}/cards`, { title: 'Egyszer' })
    const second = await agent.post(`/columns/${todo.id}/cards`, { title: 'Egyszer' })
    expect(first.status).toBe(201)
    expect(first.headers['idempotent-replayed']).toBeUndefined()
    expect(second.status).toBe(201)
    expect(second.headers['idempotent-replayed']).toBe('true')
    expect(second.body).toEqual(first.body)

    const cards = (await owner.api.get(`/boards/${board.id}`)).body.columns[0].cards
    expect(cards).toHaveLength(1)
  })

  it('rejects a reused key with a different request', async () => {
    const { todo, key } = await setup()
    const agent = bearer(t.app, key, { 'idempotency-key': 'req-1' })
    await agent.post(`/columns/${todo.id}/cards`, { title: 'A' })
    const res = await agent.post(`/columns/${todo.id}/cards`, { title: 'B' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('idempotency_key_reuse')
  })

  it('scopes keys per user and works without the header', async () => {
    const { owner, todo, key } = await setup()
    const other = await signUp(t.app, 'other@example.com')
    const mine = bearer(t.app, key, { 'idempotency-key': 'same' })
    await mine.post(`/columns/${todo.id}/cards`, { title: 'A' })
    // Másik felhasználó ugyanazzal a kulccsal nem ütközik (a tábla neki 404, de nem 422/replay).
    const theirs = await other.api.post(`/columns/${todo.id}/cards`, { title: 'A' })
    expect(theirs.status).toBe(404)
    // Fejléc nélkül minden kérés lefut.
    const a = await owner.api.post(`/columns/${todo.id}/cards`, { title: 'X' })
    const b = await owner.api.post(`/columns/${todo.id}/cards`, { title: 'X' })
    expect(a.body.id).not.toBe(b.body.id)
  })

  it('validates the key format', async () => {
    const { todo, key } = await setup()
    const res = await bearer(t.app, key, { 'idempotency-key': 'x'.repeat(300) }).post(
      `/columns/${todo.id}/cards`,
      { title: 'A' },
    )
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_idempotency_key')
  })

  it('does not store failures that can be retried (5xx/429) but stores client errors', async () => {
    const { todo, key } = await setup()
    const agent = bearer(t.app, key, { 'idempotency-key': 'bad' })
    const first = await agent.post(`/columns/${todo.id}/cards`, { title: '' })
    const second = await agent.post(`/columns/${todo.id}/cards`, { title: '' })
    expect(first.status).toBe(400)
    expect(second.status).toBe(400)
    expect(second.headers['idempotent-replayed']).toBe('true')
  })
})
