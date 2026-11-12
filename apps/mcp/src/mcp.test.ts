import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import { createApiClient, type FetchLike } from './client.js'
import { createTaskflowMcpServer } from './tools.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('api client', () => {
  it('adds an Idempotency-Key to writes only and retries network errors with the same key', async () => {
    const seen: (string | null)[] = []
    let calls = 0
    const fetch: FetchLike = async (_url, init) => {
      calls++
      seen.push(new Headers(init?.headers).get('idempotency-key'))
      if (calls < 3) throw new Error('ECONNRESET')
      return json({ ok: true })
    }
    const api = createApiClient({ baseUrl: 'http://x/api/v1', fetch, retryDelayMs: 1 })
    await api.post('/a', {})
    expect(calls).toBe(3)
    expect(new Set(seen).size).toBe(1)
    expect(seen[0]).toMatch(/^[0-9a-f-]{36}$/)
    await api.get('/a')
    expect(seen.at(-1)).toBeNull()
  })

  it('maps the error format and gives up after the retries', async () => {
    const api = createApiClient({
      baseUrl: 'http://x',
      fetch: async () => json({ error: { code: 'forbidden', message: 'no' } }, 403),
    })
    await expect(api.get('/a')).rejects.toMatchObject({ status: 403, code: 'forbidden' })
    const down = createApiClient({
      baseUrl: 'http://x',
      retries: 1,
      retryDelayMs: 1,
      fetch: async () => {
        throw new Error('down')
      },
    })
    await expect(down.get('/a')).rejects.toMatchObject({ code: 'network_error' })
  })
})

describe('tools', () => {
  const snapshot = {
    board: { id: 'b1', title: 'Board' },
    labels: [{ id: 'l1', name: 'Sürgős' }],
    columns: [
      { id: 'c1', title: 'Teendő', isDone: false, cards: [] },
      { id: 'c2', title: 'Kész', isDone: true, cards: [] },
    ],
  }
  const people = { data: [{ userId: 'u1', name: 'Éva Nagy', email: 'eva@x.hu', role: 'editor' }] }

  async function setup() {
    const log: { method: string; path: string; body: unknown }[] = []
    const fetch: FetchLike = async (url, init) => {
      const u = new URL(url)
      const method = init?.method ?? 'GET'
      const path = u.pathname.replace('/api/v1', '')
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      log.push({ method, path, body })
      if (path === '/boards/b1/snapshot') return json(snapshot)
      if (path === '/boards/b1/participants') return json(people)
      if (path === '/columns/c1/cards') return json({ id: 'k1', title: body.title }, 201)
      if (path === '/cards/k1/checklists') return json({ id: 'cl1' }, 201)
      if (path === '/checklists/cl1/items') return json({ id: 'i' }, 201)
      if (path === '/cards/k1' && method === 'GET')
        return json({ id: 'k1', title: 'T', version: 4 })
      if (path === '/cards/k1/move') return json({ id: 'k1' })
      return json({ error: { code: 'not_found', message: 'nope' } }, 404)
    }
    const server = createTaskflowMcpServer(createApiClient({ baseUrl: 'http://x/api/v1', fetch }))
    const [a, b] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 't', version: '0' })
    await Promise.all([server.connect(a), client.connect(b)])
    return { client, log }
  }

  it('exposes the voice-friendly tool set', async () => {
    const { client } = await setup()
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    expect(names).toEqual(
      [
        'add_comment',
        'create_card',
        'get_board_overview',
        'list_boards',
        'move_card',
        'search_cards',
        'update_card',
      ].sort(),
    )
  })

  it('create_card resolves names and creates labels, assignees and checklist in one call', async () => {
    const { client, log } = await setup()
    const res = await client.callTool({
      name: 'create_card',
      arguments: {
        boardId: 'b1',
        column: 'teendo',
        title: 'Tej',
        labels: ['surgos'],
        assignees: ['eva'],
        checklist: { items: ['a', 'b'] },
      },
    })
    expect(res.isError).toBeFalsy()
    expect(log.find((l) => l.path === '/columns/c1/cards')?.body).toMatchObject({
      labelIds: ['l1'],
      assigneeIds: ['u1'],
    })
    expect(log.filter((l) => l.path === '/checklists/cl1/items')).toHaveLength(2)
  })

  it('create_card creates nothing when a name cannot be resolved', async () => {
    const { client, log } = await setup()
    const res = await client.callTool({
      name: 'create_card',
      arguments: { boardId: 'b1', column: 'Nincs ilyen', title: 'x' },
    })
    expect(res.isError).toBe(true)
    expect(log.some((l) => l.method === 'POST')).toBe(false)
  })

  it('move_card sends the current version', async () => {
    const { client, log } = await setup()
    await client.callTool({
      name: 'move_card',
      arguments: { cardId: 'k1', boardId: 'b1', column: 'kész' },
    })
    expect(log.find((l) => l.path === '/cards/k1/move')?.body).toMatchObject({
      columnId: 'c2',
      version: 4,
    })
  })

  it('reports API errors as tool errors', async () => {
    const { client } = await setup()
    const res = await client.callTool({
      name: 'add_comment',
      arguments: { cardId: 'zz', body: 'hi' },
    })
    expect(res.isError).toBe(true)
  })
})
