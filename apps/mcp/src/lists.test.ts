import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import { createApiClient, type FetchLike } from './client.js'
import { createTaskflowMcpServer } from './tools.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const LIST = {
  id: 'l1',
  workspaceId: 'w1',
  title: 'Bevásárlás',
  itemCount: 3,
  doneCount: 1,
  sections: [{ id: 's1', title: 'Tejtermék' }],
  items: [
    { id: 'i1', text: 'Tej', done: false, recurring: true, sectionId: 's1' },
    { id: 'i2', text: 'Kenyér', done: true, recurring: false, sectionId: null },
    { id: 'i3', text: 'Só', done: false, recurring: false, sectionId: null },
  ],
}

async function setup(workspaces = [{ id: 'w1', name: 'Család' }]) {
  const log: { method: string; path: string; body: unknown }[] = []
  let sectionCount = 1
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url)
    const method = init?.method ?? 'GET'
    const path = u.pathname.replace('/api/v1', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    log.push({ method, path, body })
    if (path === '/workspaces') return json({ data: workspaces })
    if (path === '/workspaces/w1/lists' && method === 'GET') {
      return json({ data: u.searchParams.get('archived') ? [] : [LIST] })
    }
    if (path === '/workspaces/w1/lists') return json({ ...LIST, id: 'l9', title: body.title }, 201)
    if (path === '/lists/l1' && method === 'GET') return json(LIST)
    if (path.endsWith('/sections'))
      return json({ id: `sx${++sectionCount}`, title: body.title }, 201)
    if (path.endsWith('/items')) return json({ id: 'ix' }, 201)
    if (path.startsWith('/list-items/') && method === 'DELETE')
      return new Response(null, { status: 204 })
    if (path.startsWith('/list-items/')) return json({ id: 'i' })
    if (path.endsWith('/clear-done') || path.endsWith('/reset-recurring'))
      return json({ affected: 2 })
    if (path.startsWith('/lists/')) return json({ id: 'l1' })
    return json({ error: { code: 'not_found', message: 'nope' } }, 404)
  }
  const server = createTaskflowMcpServer(createApiClient({ baseUrl: 'http://x/api/v1', fetch }))
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '0' })
  await Promise.all([server.connect(a), client.connect(b)])
  const call = (name: string, args: Record<string, unknown>) =>
    client.callTool({ name, arguments: args })
  const writes = () => log.filter((l) => l.method !== 'GET')
  return { client, call, log, writes }
}

describe('list tools', () => {
  it('are exposed, and their descriptions tell lists apart from boards', async () => {
    const { client } = await setup()
    const tools = (await client.listTools()).tools
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'list_lists',
        'get_list',
        'create_list',
        'add_list_items',
        'update_list_item',
        'set_list_items_done',
        'update_list',
        'clear_list_done',
        'reset_list_recurring',
      ]),
    )
    expect(tools.find((t) => t.name === 'create_list')?.description).toMatch(/NOT a board/)
  })

  it('create_list creates a list (not a board) with plain and sectioned items', async () => {
    const { call, writes } = await setup()
    const res = await call('create_list', {
      title: 'Hétvége',
      items: ['Kenyér'],
      sections: [{ title: 'Tejtermék', items: ['Tej', 'Vaj'] }],
    })
    expect(res.isError).toBeFalsy()
    expect(writes().map((w) => `${w.method} ${w.path}`)).toEqual([
      'POST /workspaces/w1/lists',
      'POST /lists/l9/items',
      'POST /lists/l9/sections',
      'POST /lists/l9/items',
      'POST /lists/l9/items',
    ])
    expect(writes().some((w) => w.path.includes('/boards'))).toBe(false)
    expect(writes()[0]!.body).toEqual({ title: 'Hétvége' })
    expect(writes()[3]!.body).toMatchObject({ text: 'Tej', sectionId: 'sx2' })
  })

  it('needs a workspace when the user has several, and creates nothing then', async () => {
    const { call, writes } = await setup([
      { id: 'w1', name: 'Család' },
      { id: 'w2', name: 'Munka' },
    ])
    const res = await call('create_list', { title: 'Hétvége' })
    expect(res.isError).toBe(true)
    expect(writes()).toEqual([])
  })

  it('add_list_items finds the list by name, reuses a section and creates a new one', async () => {
    const { call, writes } = await setup()
    await call('add_list_items', { list: 'bevasarlas', items: ['Joghurt'], section: 'tejtermek' })
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toMatchObject({ path: '/lists/l1/items', body: { sectionId: 's1' } })

    await call('add_list_items', { list: 'Bevásárlás', items: ['Alma'], section: 'Zöldség' })
    expect(writes().map((w) => w.path)).toEqual([
      '/lists/l1/items',
      '/lists/l1/sections',
      '/lists/l1/items',
    ])
  })

  it('get_list describes sections and items with names, not ids', async () => {
    const { call } = await setup()
    const res = await call('get_list', { list: 'Bevásárlás' })
    const text = (res.content as { text: string }[])[0]!.text
    const list = JSON.parse(text)
    expect(list).toMatchObject({ done: '1/3', sections: ['Tejtermék'] })
    expect(list.items[0]).toEqual({
      text: 'Tej',
      done: false,
      recurring: true,
      section: 'Tejtermék',
    })
    expect(text).not.toContain('"i1"')
  })

  it('set_list_items_done ticks all named items, or none when one is unknown', async () => {
    const { call, writes } = await setup()
    const ok = await call('set_list_items_done', { list: 'Bevásárlás', items: ['tej', 'só'] })
    expect(ok.isError).toBeFalsy()
    expect(writes().map((w) => `${w.path} ${JSON.stringify(w.body)}`)).toEqual([
      '/list-items/i1 {"done":true}',
      '/list-items/i3 {"done":true}',
    ])

    const { call: call2, writes: writes2 } = await setup()
    const bad = await call2('set_list_items_done', { list: 'Bevásárlás', items: ['tej', 'sajt'] })
    expect(bad.isError).toBe(true)
    expect(writes2()).toEqual([])
  })

  it('update_list_item edits, moves to a section, removes, and rejects an empty update', async () => {
    const { call, writes } = await setup()
    await call('update_list_item', {
      list: 'Bevásárlás',
      item: 'kenyér',
      done: false,
      section: 'Tejtermék',
    })
    expect(writes().map((w) => `${w.method} ${w.path}`)).toEqual([
      'PATCH /list-items/i2',
      'POST /list-items/i2/move',
    ])
    expect(writes()[1]!.body).toEqual({ sectionId: 's1' })

    const { call: c2, writes: w2 } = await setup()
    await c2('update_list_item', { list: 'Bevásárlás', item: 'tej', remove: true })
    expect(w2()).toEqual([{ method: 'DELETE', path: '/list-items/i1', body: undefined }])

    const { call: c3, writes: w3 } = await setup()
    expect((await c3('update_list_item', { list: 'Bevásárlás', item: 'tej' })).isError).toBe(true)
    expect(w3()).toEqual([])
  })

  it('update_list renames, archives and restores; bulk tools report the counts', async () => {
    const { call, writes } = await setup()
    await call('update_list', { list: 'Bevásárlás', title: 'Nagybevásárlás', archive: true })
    expect(writes().map((w) => `${w.method} ${w.path}`)).toEqual([
      'PATCH /lists/l1',
      'POST /lists/l1/archive',
    ])
    expect((await call('update_list', { list: 'Bevásárlás' })).isError).toBe(true)

    const cleared = await call('clear_list_done', { list: 'Bevásárlás' })
    expect(JSON.parse((cleared.content as { text: string }[])[0]!.text)).toMatchObject({
      removed: 2,
    })
    const reset = await call('reset_list_recurring', { list: 'Bevásárlás' })
    expect(JSON.parse((reset.content as { text: string }[])[0]!.text)).toMatchObject({
      reopened: 2,
    })
  })
})
