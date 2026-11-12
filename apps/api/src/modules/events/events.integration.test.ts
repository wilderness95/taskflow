import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { boardEventSchema } from '@taskflow/shared'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'
import { MAX_STREAMS_PER_USER } from './events.service.js'

let t: ReturnType<typeof createTestApp>
let address: string | null = null
const aborts: AbortController[] = []

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
  address = null
})
afterEach(async () => {
  for (const a of aborts.splice(0)) a.abort()
  await t.app.close()
})

/** Valódi HTTP-kapcsolat az SSE-hez (az `inject` nem tud nyitott folyamot olvasni). */
async function open(path: string, headers: Record<string, string>) {
  address ??= await t.app.listen({ port: 0, host: '127.0.0.1' })
  const abort = new AbortController()
  aborts.push(abort)
  const res = await fetch(`${address}/api/v1${path}`, { headers, signal: abort.signal })
  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  /** A következő, `needle`-t tartalmazó adatdarabig olvas. */
  const readUntil = async (needle: string) => {
    while (!buffer.includes(needle)) {
      const chunk = await reader!.read()
      if (chunk.done) throw new Error('stream ended')
      buffer += decoder.decode(chunk.value)
    }
    return buffer
  }
  return { res, readUntil, abort }
}

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T' })).body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  return { owner, board, col }
}

describe('board event stream', () => {
  it('streams changes made by users and by API keys', async () => {
    const { owner, board, col } = await setup()
    const stream = await open(`/boards/${board.id}/events`, { cookie: owner.cookie })
    expect(stream.res.status).toBe(200)
    expect(stream.res.headers.get('content-type')).toContain('text/event-stream')
    await stream.readUntil(': connected')

    const card = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'Élő' })).body
    const text = await stream.readUntil('card.created')
    const data = text.split('\n').find((l) => l.startsWith('data: '))!
    const event = boardEventSchema.parse(JSON.parse(data.slice(6)))
    expect(event).toMatchObject({
      boardId: board.id,
      action: 'card.created',
      cardId: card.id,
      actorType: 'user',
      actorId: owner.user.id,
    })
    expect(text).toContain('event: board')

    const key = (
      await owner.api.post('/api-keys', { name: 'bot', scopes: ['boards:read', 'boards:write'] })
    ).body
    await bearer(t.app, key.key).post(`/cards/${card.id}/comments`, { body: 'Bot' })
    const later = await stream.readUntil('comment.created')
    expect(later).toContain('"actorType":"api_key"')
    expect(later).toContain(`"cardId":"${card.id}"`)
  })

  it('does not leak events of other boards', async () => {
    const { owner, board } = await setup()
    const ws = (await owner.api.get('/workspaces')).body.data[0]
    const other = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'Másik' })).body
    const stream = await open(`/boards/${board.id}/events`, { cookie: owner.cookie })
    await stream.readUntil(': connected')
    await owner.api.post(`/boards/${other.id}/columns`, { title: 'Nem ide' })
    await owner.api.post(`/boards/${board.id}/columns`, { title: 'Ide' })
    const text = await stream.readUntil('column.created')
    expect(text).toContain(board.id)
    expect(text).not.toContain(other.id)
  })

  it('requires authentication and board access', async () => {
    const { board } = await setup()
    const stranger = await signUp(t.app, 's@example.com')
    const anon = await open(`/boards/${board.id}/events`, {})
    expect(anon.res.status).toBe(401)
    const denied = await open(`/boards/${board.id}/events`, { cookie: stranger.cookie })
    expect(denied.res.status).toBe(404)
  })

  it('needs the boards:read scope for API keys', async () => {
    const { owner, board } = await setup()
    const key = (await owner.api.post('/api-keys', { name: 'k', scopes: ['workspaces:read'] })).body
    const res = await open(`/boards/${board.id}/events`, { authorization: `Bearer ${key.key}` })
    expect(res.res.status).toBe(403)
  })

  it('limits the open streams per user', async () => {
    const { owner, board } = await setup()
    for (let i = 0; i < MAX_STREAMS_PER_USER; i++) {
      const s = await open(`/boards/${board.id}/events`, { cookie: owner.cookie })
      expect(s.res.status).toBe(200)
    }
    const extra = await open(`/boards/${board.id}/events`, { cookie: owner.cookie })
    expect(extra.res.status).toBe(429)
  })
})
