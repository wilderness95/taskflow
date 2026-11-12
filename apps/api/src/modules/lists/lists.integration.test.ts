import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listEventSchema } from '@taskflow/shared'
import { activityLog, workspaceMembers } from '../../db/schema.js'
import { bearer, createTestApp, signUp, type TestClient } from '../../testing/helpers.js'

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

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const member = await signUp(t.app, 'member@example.com', 'Mate')
  const viewer = await signUp(t.app, 'viewer@example.com', 'Vera')
  const stranger = await signUp(t.app, 'stranger@example.com', 'Samu')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  t.db
    .insert(workspaceMembers)
    .values([
      { workspaceId: ws.id, userId: member.user.id, role: 'member' },
      { workspaceId: ws.id, userId: viewer.user.id, role: 'viewer' },
    ])
    .run()
  const list = (await owner.api.post(`/workspaces/${ws.id}/lists`, { title: 'Bevásárlás' })).body
  return { owner, member, viewer, stranger, ws, list }
}

const add = async (api: TestClient, listId: string, text: string, extra = {}) =>
  (await api.post(`/lists/${listId}/items`, { text, ...extra })).body

describe('lists', () => {
  it('creates, renames, lists, archives and restores a list', async () => {
    const { owner, ws, list } = await setup()
    expect(list).toMatchObject({ title: 'Bevásárlás', workspaceId: ws.id, itemCount: 0 })
    const renamed = await owner.api.patch(`/lists/${list.id}`, { title: 'Hétvége' })
    expect(renamed.body.title).toBe('Hétvége')

    const all = (await owner.api.get(`/workspaces/${ws.id}/lists`)).body.data
    expect(all.map((l: { id: string }) => l.id)).toEqual([list.id])

    expect((await owner.api.post(`/lists/${list.id}/archive`)).body.archivedAt).not.toBeNull()
    expect((await owner.api.get(`/workspaces/${ws.id}/lists`)).body.data).toEqual([])
    expect(
      (await owner.api.get(`/workspaces/${ws.id}/lists?archived=true`)).body.data,
    ).toHaveLength(1)
    // archivált listát nem lehet olvasni vagy írni, csak visszaállítani
    expect((await owner.api.get(`/lists/${list.id}`)).status).toBe(404)
    expect((await owner.api.post(`/lists/${list.id}/items`, { text: 'x' })).status).toBe(404)
    expect((await owner.api.post(`/lists/${list.id}/archive`)).status).toBe(404)

    expect((await owner.api.post(`/lists/${list.id}/restore`)).body.archivedAt).toBeNull()
    expect((await owner.api.post(`/lists/${list.id}/restore`)).status).toBe(404)
    expect((await owner.api.get(`/lists/${list.id}`)).status).toBe(200)
  })

  it('adds, orders, checks and deletes items; reports progress', async () => {
    const { owner, list } = await setup()
    const milk = await add(owner.api, list.id, 'Tej')
    const bread = await add(owner.api, list.id, 'Kenyér')
    const eggs = await add(owner.api, list.id, 'Tojás')
    expect(milk.version).toBe(1)

    // Tojás a Tej elé
    const moved = await owner.api.post(`/list-items/${eggs.id}/move`, {
      sectionId: null,
      beforeItemId: milk.id,
    })
    expect(moved.status).toBe(200)
    const checked = await owner.api.patch(`/list-items/${bread.id}`, { done: true })
    expect(checked.body).toMatchObject({ done: true, version: 2 })

    const detail = (await owner.api.get(`/lists/${list.id}`)).body
    expect(detail).toMatchObject({ itemCount: 3, doneCount: 1, myRole: 'owner' })
    expect(detail.items.map((i: { text: string }) => i.text)).toEqual(['Tojás', 'Tej', 'Kenyér'])

    expect((await owner.api.delete(`/list-items/${milk.id}`)).status).toBe(204)
    expect((await owner.api.get(`/lists/${list.id}`)).body.items).toHaveLength(2)
  })

  it('rejects an empty update and a stale version', async () => {
    const { owner, list } = await setup()
    const item = await add(owner.api, list.id, 'Tej')
    expect((await owner.api.patch(`/list-items/${item.id}`, {})).status).toBe(400)
    expect((await owner.api.patch(`/list-items/${item.id}`, { text: 'Zabtej' })).status).toBe(200)
    const stale = await owner.api.patch(`/list-items/${item.id}`, { text: 'X', version: 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('version_conflict')
    expect(stale.body.error.details.item.text).toBe('Zabtej')
  })

  it('groups items into sections and keeps them when a section is deleted', async () => {
    const { owner, list } = await setup()
    const dairy = (await owner.api.post(`/lists/${list.id}/sections`, { title: 'Tejtermék' })).body
    const veg = (await owner.api.post(`/lists/${list.id}/sections`, { title: 'Zöldség' })).body
    const loose = await add(owner.api, list.id, 'Só')
    const milk = await add(owner.api, list.id, 'Tej', { sectionId: dairy.id })
    const cheese = await add(owner.api, list.id, 'Sajt', { sectionId: dairy.id })
    expect(milk.sectionId).toBe(dairy.id)

    // szakaszok sorrendje: Zöldség a Tejtermék elé
    await owner.api.post(`/list-sections/${veg.id}/move`, { beforeSectionId: dairy.id })
    let detail = (await owner.api.get(`/lists/${list.id}`)).body
    expect(detail.sections.map((s: { title: string }) => s.title)).toEqual(['Zöldség', 'Tejtermék'])

    // tétel másik szakaszba, majd szakasz nélkülire
    await owner.api.post(`/list-items/${cheese.id}/move`, { sectionId: veg.id })
    await owner.api.post(`/list-items/${milk.id}/move`, { sectionId: null, beforeItemId: loose.id })

    // a Zöldség törlése után a Sajt szakasz nélkül, a végén marad
    expect((await owner.api.delete(`/list-sections/${veg.id}`)).status).toBe(204)
    detail = (await owner.api.get(`/lists/${list.id}`)).body
    expect(detail.sections.map((s: { id: string }) => s.id)).toEqual([dairy.id])
    const looseItems = detail.items
      .filter((i: { sectionId: string | null }) => i.sectionId === null)
      .sort((a: { position: string }, b: { position: string }) =>
        a.position < b.position ? -1 : 1,
      )
      .map((i: { text: string }) => i.text)
    expect(looseItems).toEqual(['Tej', 'Só', 'Sajt'])
  })

  it('rejects a section of another list', async () => {
    const { owner, ws, list } = await setup()
    const other = (await owner.api.post(`/workspaces/${ws.id}/lists`, { title: 'Más' })).body
    const foreign = (await owner.api.post(`/lists/${other.id}/sections`, { title: 'X' })).body
    const res = await owner.api.post(`/lists/${list.id}/items`, {
      text: 'a',
      sectionId: foreign.id,
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('invalid_section')
    const item = await add(owner.api, list.id, 'b')
    const move = await owner.api.post(`/list-items/${item.id}/move`, { sectionId: foreign.id })
    expect(move.status).toBe(422)
  })

  it('clears done items and reopens recurring ones', async () => {
    const { owner, list } = await setup()
    const once = await add(owner.api, list.id, 'Egyszeri')
    const weekly = await add(owner.api, list.id, 'Kenyér', { recurring: true })
    const open = await add(owner.api, list.id, 'Nyitott')
    for (const i of [once, weekly]) await owner.api.patch(`/list-items/${i.id}`, { done: true })

    expect((await owner.api.post(`/lists/${list.id}/clear-done`)).body).toEqual({ affected: 1 })
    expect((await owner.api.post(`/lists/${list.id}/reset-recurring`)).body).toEqual({
      affected: 1,
    })
    const items = (await owner.api.get(`/lists/${list.id}`)).body.items
    expect(items.map((i: { id: string; done: boolean }) => [i.id, i.done])).toEqual(
      expect.arrayContaining([
        [weekly.id, false],
        [open.id, false],
      ]),
    )
    expect(items).toHaveLength(2)
    expect((await owner.api.post(`/lists/${list.id}/clear-done`)).body).toEqual({ affected: 0 })
  })

  it('enforces the item limit', async () => {
    const { owner, list } = await setup()
    const { listItems } = await import('../../db/schema.js')
    t.db
      .insert(listItems)
      .values(
        Array.from({ length: 500 }, (_, i) => ({
          id: `i${i}`,
          listId: list.id,
          text: 'x',
          position: `a${String(i).padStart(4, '0')}`,
        })),
      )
      .run()
    const res = await owner.api.post(`/lists/${list.id}/items`, { text: 'több' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('too_many_items')
  })
})

describe('list permissions', () => {
  it('lets a member write and a viewer only read', async () => {
    const { member, viewer, ws, list } = await setup()
    expect((await member.api.post(`/lists/${list.id}/items`, { text: 'Tej' })).status).toBe(201)
    expect((await member.api.post(`/workspaces/${ws.id}/lists`, { title: 'Új' })).status).toBe(201)

    const item = (await viewer.api.get(`/lists/${list.id}`)).body.items[0]
    expect((await viewer.api.get(`/workspaces/${ws.id}/lists`)).status).toBe(200)
    expect((await viewer.api.post(`/workspaces/${ws.id}/lists`, { title: 'X' })).status).toBe(403)
    expect((await viewer.api.patch(`/lists/${list.id}`, { title: 'X' })).status).toBe(403)
    expect((await viewer.api.post(`/lists/${list.id}/archive`)).status).toBe(403)
    expect((await viewer.api.post(`/lists/${list.id}/items`, { text: 'X' })).status).toBe(403)
    expect((await viewer.api.patch(`/list-items/${item.id}`, { done: true })).status).toBe(403)
    expect((await viewer.api.post(`/list-items/${item.id}/move`, { sectionId: null })).status).toBe(
      403,
    )
    expect((await viewer.api.delete(`/list-items/${item.id}`)).status).toBe(403)
    expect((await viewer.api.post(`/lists/${list.id}/sections`, { title: 'X' })).status).toBe(403)
    expect((await viewer.api.post(`/lists/${list.id}/clear-done`)).status).toBe(403)
    expect((await viewer.api.post(`/lists/${list.id}/reset-recurring`)).status).toBe(403)
    expect((await viewer.api.get(`/lists/${list.id}`)).body.myRole).toBe('viewer')
  })

  it('hides lists from non-members (404, also for sections and items)', async () => {
    const { owner, stranger, ws, list } = await setup()
    const section = (await owner.api.post(`/lists/${list.id}/sections`, { title: 'S' })).body
    const item = await add(owner.api, list.id, 'Tej')
    const s = stranger.api
    expect((await s.get(`/workspaces/${ws.id}/lists`)).status).toBe(404)
    expect((await s.post(`/workspaces/${ws.id}/lists`, { title: 'X' })).status).toBe(404)
    expect((await s.get(`/lists/${list.id}`)).status).toBe(404)
    expect((await s.patch(`/lists/${list.id}`, { title: 'X' })).status).toBe(404)
    expect((await s.post(`/lists/${list.id}/items`, { text: 'X' })).status).toBe(404)
    expect((await s.patch(`/list-items/${item.id}`, { done: true })).status).toBe(404)
    expect((await s.delete(`/list-items/${item.id}`)).status).toBe(404)
    expect((await s.patch(`/list-sections/${section.id}`, { title: 'X' })).status).toBe(404)
    expect((await s.delete(`/list-sections/${section.id}`)).status).toBe(404)
    expect((await s.get(`/lists/${list.id}/events`)).status).toBe(404)
    const anon = await t.app.inject({ method: 'GET', url: `/api/v1/lists/${list.id}` })
    expect(anon.statusCode).toBe(401)
  })

  it('applies API key scopes: read key cannot write, write key can', async () => {
    const { owner, list } = await setup()
    const read = (await owner.api.post('/api-keys', { name: 'r', scopes: ['boards:read'] })).body
      .key as string
    const write = (
      await owner.api.post('/api-keys', { name: 'w', scopes: ['boards:read', 'boards:write'] })
    ).body.key as string
    expect((await bearer(t.app, read).get(`/lists/${list.id}`)).status).toBe(200)
    const denied = await bearer(t.app, read).post(`/lists/${list.id}/items`, { text: 'Tej' })
    expect(denied.status).toBe(403)
    expect(denied.body.error.code).toBe('insufficient_scope')
    const ok = await bearer(t.app, write).post(`/lists/${list.id}/items`, { text: 'Tej' })
    expect(ok.status).toBe(201)

    const log = t.db
      .select()
      .from(activityLog)
      .all()
      .filter((a) => a.action === 'list_item.created')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ actorType: 'api_key', workspaceId: list.workspaceId })
  })

  it('logs writes to the activity log', async () => {
    const { owner, list } = await setup()
    await add(owner.api, list.id, 'Tej')
    const actions = t.db
      .select()
      .from(activityLog)
      .all()
      .map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['list.created', 'list_item.created']))
  })
})

describe('list event stream', () => {
  async function open(path: string, headers: Record<string, string>) {
    address ??= await t.app.listen({ port: 0, host: '127.0.0.1' })
    const abort = new AbortController()
    aborts.push(abort)
    const res = await fetch(`${address}/api/v1${path}`, { headers, signal: abort.signal })
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const readUntil = async (needle: string) => {
      while (!buffer.includes(needle)) {
        const chunk = await reader!.read()
        if (chunk.done) throw new Error('stream ended')
        buffer += decoder.decode(chunk.value)
      }
      return buffer
    }
    return { res, readUntil }
  }

  it("streams a list's changes to a member of the workspace", async () => {
    const { owner, member, list } = await setup()
    const stream = await open(`/lists/${list.id}/events`, { cookie: member.cookie })
    expect(stream.res.status).toBe(200)
    await stream.readUntil(': connected')

    const item = await add(owner.api, list.id, 'Élő')
    const text = await stream.readUntil('list_item.created')
    const data = text.split('\n').find((l) => l.startsWith('data: '))!
    expect(listEventSchema.parse(JSON.parse(data.slice(6)))).toMatchObject({
      listId: list.id,
      action: 'list_item.created',
      entityId: item.id,
      actorId: owner.user.id,
    })
    expect(text).toContain('event: list')
  })

  it('does not leak events of another list', async () => {
    const { owner, ws, list } = await setup()
    const other = (await owner.api.post(`/workspaces/${ws.id}/lists`, { title: 'Más' })).body
    const stream = await open(`/lists/${list.id}/events`, { cookie: owner.cookie })
    await stream.readUntil(': connected')
    await add(owner.api, other.id, 'Másik')
    await add(owner.api, list.id, 'Ez')
    const text = await stream.readUntil('list_item.created')
    expect(text).not.toContain(other.id)
  })
})
