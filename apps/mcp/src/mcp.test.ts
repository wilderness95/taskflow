import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import { createApiClient, type FetchLike } from './client.js'
import { createTaskflowMcpServer } from './tools.js'

const CARD = 'K'.padStart(26, '0')
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
      if (path === '/workspaces' && method === 'POST')
        return json({ id: 'w1', name: 'Család' }, 201)
      if (path === '/workspaces/w1/boards') return json({ id: 'b9', title: 'Bevásárlás' }, 201)
      if (path === '/boards/b9/columns') return json({ id: 'cx' }, 201)
      if (path === '/boards/b1/snapshot') return json(snapshot)
      if (path === '/boards/b1/participants') return json(people)
      if (path === '/columns/c1/cards') return json({ id: CARD, title: body.title }, 201)
      if (path === `/cards/${CARD}/checklists`) return json({ id: 'cl1' }, 201)
      if (path === '/checklists/cl1/items') return json({ id: 'i' }, 201)
      if (path === `/cards/${CARD}` && method === 'GET') {
        return json({
          id: CARD,
          title: 'T',
          version: 4,
          checklists: [
            { id: 'cl1', title: 'Lista', items: [{ id: 'it1', text: 'Tej', done: false }] },
          ],
        })
      }
      if (path === `/cards/${CARD}` && method === 'PATCH') return json({ id: CARD, title: 'T' })
      if (path === `/cards/${CARD}` && method === 'DELETE')
        return new Response(null, { status: 204 })
      if (path === '/checklist-items/it1') return json({ id: 'it1' })
      if (path === `/cards/${CARD}/move`) return json({ id: CARD })
      return json({ error: { code: 'not_found', message: 'nope' } }, 404)
    }
    const server = createTaskflowMcpServer(createApiClient({ baseUrl: 'http://x/api/v1', fetch }))
    const [a, b] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 't', version: '0' })
    await Promise.all([server.connect(a), client.connect(b)])
    return { client, log }
  }

  it('exposes tools for boards, columns, cards, checklists, labels and comments', async () => {
    const { client } = await setup()
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'create_workspace',
        'delete_workspace',
        'create_board',
        'update_board',
        'archive_board',
        'create_column',
        'update_column',
        'delete_column',
        'get_card',
        'update_card',
        'delete_card',
        'archive_card',
        'update_checklist_item',
        'create_label',
        'list_comments',
      ]),
    )
    expect(names.length).toBeGreaterThanOrEqual(25)
  })

  it('create_workspace creates the workspace, its boards and columns', async () => {
    const { client, log } = await setup()
    const res = await client.callTool({
      name: 'create_workspace',
      arguments: { name: 'Család', boards: [{ title: 'Bevásárlás', columns: ['Kell', 'Megvan'] }] },
    })
    expect(res.isError).toBeFalsy()
    const posts = log.filter((l) => l.method === 'POST').map((l) => l.path)
    expect(posts).toEqual([
      '/workspaces',
      '/workspaces/w1/boards',
      '/boards/b9/columns',
      '/boards/b9/columns',
    ])
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
      arguments: { card: CARD, boardId: 'b1', column: 'kész' },
    })
    expect(log.find((l) => l.path === `/cards/${CARD}/move`)?.body).toMatchObject({
      columnId: 'c2',
      version: 4,
    })
  })

  it('reports API errors as tool errors', async () => {
    const { client } = await setup()
    const res = await client.callTool({
      name: 'add_comment',
      arguments: { card: 'zz'.padStart(26, '0'), body: 'hi' },
    })
    expect(res.isError).toBe(true)
  })

  it('update_card changes more than the title and clears the due date', async () => {
    const { client, log } = await setup()
    const res = await client.callTool({
      name: 'update_card',
      arguments: { card: CARD, description: 'Új leírás', priority: 'high', dueDate: '' },
    })
    expect(res.isError).toBeFalsy()
    expect(log.find((l) => l.method === 'PATCH')?.body).toEqual({
      description: 'Új leírás',
      priority: 'high',
      dueDate: null,
      version: 4,
    })
  })

  it('update_card rejects an empty update and delete_card removes the card', async () => {
    const { client, log } = await setup()
    const empty = await client.callTool({ name: 'update_card', arguments: { card: CARD } })
    expect(empty.isError).toBe(true)
    const del = await client.callTool({ name: 'delete_card', arguments: { card: CARD } })
    expect(del.isError).toBeFalsy()
    expect(log.some((l) => l.method === 'DELETE' && l.path === `/cards/${CARD}`)).toBe(true)
  })

  it('update_checklist_item finds the item by text and ticks it', async () => {
    const { client, log } = await setup()
    await client.callTool({
      name: 'update_checklist_item',
      arguments: { card: CARD, item: 'tej', done: true },
    })
    expect(log.find((l) => l.path === '/checklist-items/it1')?.body).toMatchObject({ done: true })
  })
})
