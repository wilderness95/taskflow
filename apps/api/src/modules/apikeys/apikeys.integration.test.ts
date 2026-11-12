import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ApiKeyScope } from '@taskflow/shared'
import { apiKeys } from '../../db/schema.js'
import { bearer, client, createTestApp, signUp, tokenFromLastMail } from '../../testing/helpers.js'
import { sha256 } from '../auth/tokens.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

type Person = Awaited<ReturnType<typeof signUp>>

async function makeKey(
  person: Person,
  scopes: ApiKeyScope[] = ['boards:read', 'boards:write', 'workspaces:read'],
  extra: object = {},
) {
  const res = await person.api.post('/api-keys', { name: 'agent', scopes, ...extra })
  expect(res.status).toBe(201)
  return res.body as { id: string; key: string; prefix: string }
}

async function setupBoard(person: Person) {
  const ws = (await person.api.get('/workspaces')).body.data[0]
  const board = (await person.api.post(`/workspaces/${ws.id}/boards`, { title: 'Agent tábla' }))
    .body
  const todo = (await person.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const done = (await person.api.post(`/boards/${board.id}/columns`, { title: 'Done' })).body
  return { ws, board, todo, done }
}

describe('api keys', () => {
  it('creates a key whose secret is shown once and stored only as a hash', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const created = await makeKey(owner)
    expect(created.key).toMatch(/^tfk_/)
    expect(created.prefix).toBe(created.key.slice(0, 8))

    const listed = (await owner.api.get('/api-keys')).body.data
    expect(listed).toHaveLength(1)
    expect(JSON.stringify(listed)).not.toContain(created.key)

    const row = t.db.select().from(apiKeys).where(eq(apiKeys.id, created.id)).get()!
    expect(row.keyHash).toBe(sha256(created.key))
    expect(JSON.stringify(row)).not.toContain(created.key)
  })

  it('validates the body and keeps keys private to their owner', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const other = await signUp(t.app, 'other@example.com')
    expect((await owner.api.post('/api-keys', { name: 'x', scopes: [] })).status).toBe(400)
    expect((await owner.api.post('/api-keys', { name: 'x', scopes: ['admin'] })).status).toBe(400)
    const { id } = await makeKey(owner)
    expect((await other.api.get('/api-keys')).body.data).toEqual([])
    expect((await other.api.delete(`/api-keys/${id}`)).status).toBe(404)
    expect((await client(t.app).get('/api-keys')).status).toBe(401)
  })

  it('lets curl-style calls create and move a card with a key', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const { board, todo, done } = await setupBoard(owner)
    const agent = bearer(t.app, (await makeKey(owner)).key)

    const card = await agent.post(`/columns/${todo.id}/cards`, { title: 'Agent kártya' })
    expect(card.status).toBe(201)
    const moved = await agent.post(`/cards/${card.body.id}/move`, { columnId: done.id })
    expect(moved.status).toBe(200)
    expect(moved.body.columnId).toBe(done.id)
    const read = await agent.get(`/boards/${board.id}`)
    expect(read.body.columns.find((c: { id: string }) => c.id === done.id).cards).toHaveLength(1)
    expect((await agent.get('/auth/me')).body.email).toBe('owner@example.com')
  })

  it('rejects revoked, expired, malformed and unknown keys with 401', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const { id, key } = await makeKey(owner)
    expect((await bearer(t.app, key).get('/workspaces')).status).toBe(200)

    expect((await owner.api.delete(`/api-keys/${id}`)).status).toBe(204)
    const revoked = await bearer(t.app, key).get('/workspaces')
    expect(revoked.status).toBe(401)
    expect(revoked.body.error.code).toBe('invalid_api_key')
    expect((await owner.api.get('/api-keys')).body.data[0].revokedAt).not.toBeNull()

    const expiring = await makeKey(owner)
    t.db
      .update(apiKeys)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apiKeys.id, expiring.id))
      .run()
    expect((await bearer(t.app, expiring.key).get('/workspaces')).status).toBe(401)

    expect((await bearer(t.app, 'tfk_nope').get('/workspaces')).status).toBe(401)
    expect((await bearer(t.app, 'not-a-key').get('/workspaces')).status).toBe(401)
  })

  it('answers 403 for operations outside the key scopes', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const { board, todo } = await setupBoard(owner)
    const readOnly = bearer(t.app, (await makeKey(owner, ['boards:read'])).key)

    expect((await readOnly.get(`/boards/${board.id}`)).status).toBe(200)
    const denied = await readOnly.post(`/columns/${todo.id}/cards`, { title: 'x' })
    expect(denied.status).toBe(403)
    expect(denied.body.error).toMatchObject({
      code: 'insufficient_scope',
      details: { required: 'boards:write' },
    })
    // workspaces:read hiányzik
    expect((await readOnly.get('/workspaces')).status).toBe(403)

    const writeOnly = bearer(t.app, (await makeKey(owner, ['boards:write'])).key)
    expect((await writeOnly.get(`/boards/${board.id}`)).status).toBe(200)
    expect((await writeOnly.get('/workspaces')).status).toBe(403)
  })

  it('keeps account, key and membership management session-only', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const { ws, board } = await setupBoard(owner)
    const agent = bearer(t.app, (await makeKey(owner)).key)
    const calls = [
      agent.get('/api-keys'),
      agent.post('/api-keys', { name: 'x', scopes: ['boards:read'] }),
      agent.post('/workspaces', { name: 'x' }),
      agent.patch(`/workspaces/${ws.id}`, { name: 'x' }),
      agent.post(`/workspaces/${ws.id}/invitations`, { email: 'a@b.hu', role: 'member' }),
      agent.put(`/boards/${board.id}/members/${owner.user.id}`, { role: 'viewer' }),
      agent.patch('/auth/me', { name: 'x' }),
      agent.post('/auth/logout'),
    ]
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('session_required')
    }
  })

  it('intersects the scopes with the owner rights', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const { ws, board, todo } = await setupBoard(owner)
    const viewer = await signUp(t.app, 'viewer@example.com')
    await owner.api.post(`/workspaces/${ws.id}/invitations`, {
      email: 'viewer@example.com',
      role: 'viewer',
    })
    await viewer.api.post('/invitations/accept', { token: tokenFromLastMail(t.mailer) })
    await owner.api.patch(`/boards/${board.id}`, { visibility: 'workspace' })

    // A viewer teljes hatókörű kulcsa sem tud többet, mint maga a viewer.
    const agent = bearer(t.app, (await makeKey(viewer)).key)
    expect((await agent.get(`/boards/${board.id}`)).status).toBe(200)
    expect((await agent.post(`/columns/${todo.id}/cards`, { title: 'x' })).status).toBe(403)

    // Aki nem lát egy táblát, annak a kulcsa sem látja (404).
    const stranger = bearer(t.app, (await makeKey(await signUp(t.app, 's@example.com'))).key)
    expect((await stranger.get(`/boards/${board.id}`)).status).toBe(404)
  })

  it('rate limits per key', async () => {
    t = createTestApp({ REGISTRATION_MODE: 'open', API_KEY_RATE_LIMIT_MAX: '3' })
    const owner = await signUp(t.app, 'owner@example.com')
    const a = bearer(t.app, (await makeKey(owner)).key)
    const b = bearer(t.app, (await makeKey(owner)).key)
    for (let i = 0; i < 3; i++) expect((await a.get('/workspaces')).status).toBe(200)
    const limited = await a.get('/workspaces')
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('rate_limited')
    expect(limited.headers['retry-after']).toBeDefined()
    expect((await b.get('/workspaces')).status).toBe(200)
  })

  it('records when the key was last used', async () => {
    const owner = await signUp(t.app, 'owner@example.com')
    const { key } = await makeKey(owner)
    expect((await owner.api.get('/api-keys')).body.data[0].lastUsedAt).toBeNull()
    await bearer(t.app, key).get('/workspaces')
    expect((await owner.api.get('/api-keys')).body.data[0].lastUsedAt).not.toBeNull()
  })
})
