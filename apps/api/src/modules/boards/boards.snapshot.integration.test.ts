import { beforeEach, describe, expect, it } from 'vitest'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'Sprint' })).body
  const todo = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const done = (
    await owner.api.post(`/boards/${board.id}/columns`, { title: 'Done', isDone: true })
  ).body
  const bug = (await owner.api.post(`/boards/${board.id}/labels`, { name: 'bug', color: 'rose' }))
    .body
  const card = async (columnId: string, body: object) =>
    (await owner.api.post(`/columns/${columnId}/cards`, body)).body
  return { owner, board, todo, done, bug, card }
}

describe('board snapshot', () => {
  it('summarises the board for agents', async () => {
    const { owner, board, todo, done, bug, card } = await setup()
    const a = await card(todo.id, {
      title: 'Régi hiba',
      priority: 'high',
      dueDate: '2020-01-01',
      labelIds: [bug.id],
      description: 'x'.repeat(500),
    })
    await card(done.id, { title: 'Kész', priority: 'low', dueDate: '2020-01-01' })
    const list = (await owner.api.post(`/cards/${a.id}/checklists`, {})).body
    const item = (await owner.api.post(`/checklists/${list.id}/items`, { text: 'egy' })).body
    await owner.api.post(`/checklists/${list.id}/items`, { text: 'kettő' })
    await owner.api.patch(`/checklist-items/${item.id}`, { done: true })

    const snap = (await owner.api.get(`/boards/${board.id}/snapshot`)).body
    expect(snap.board).toMatchObject({ id: board.id, title: 'Sprint', myRole: 'admin' })
    expect(snap.summary).toMatchObject({
      columnCount: 2,
      cardCount: 2,
      doneCount: 1,
      overdueCount: 1,
      byPriority: { high: 1, medium: 0, low: 1 },
    })
    const [todoCol, doneCol] = snap.columns
    expect(todoCol.cards[0]).toMatchObject({
      title: 'Régi hiba',
      overdue: true,
      labels: ['bug'],
      checklist: { done: 1, total: 2 },
    })
    expect(todoCol.cards[0].descriptionExcerpt).toHaveLength(200)
    // A kész oszlopban a lejárt határidő nem számít késésnek.
    expect(doneCol.cards[0].overdue).toBe(false)
    expect(snap.recentActivity.length).toBeGreaterThan(0)
    expect(snap.recentActivity.length).toBeLessThanOrEqual(10)
  })

  it('needs read access and works with a read-only key', async () => {
    const { owner, board } = await setup()
    const stranger = await signUp(t.app, 's@example.com')
    expect((await stranger.api.get(`/boards/${board.id}/snapshot`)).status).toBe(404)
    const key = (await owner.api.post('/api-keys', { name: 'r', scopes: ['boards:read'] })).body
    expect((await bearer(t.app, key.key).get(`/boards/${board.id}/snapshot`)).status).toBe(200)
  })
})

describe('card list', () => {
  it('filters and paginates with a cursor', async () => {
    const { owner, board, todo, done, bug, card } = await setup()
    await card(todo.id, {
      title: 'Alma pite',
      priority: 'high',
      dueDate: '2030-01-10',
      labelIds: [bug.id],
    })
    await card(todo.id, { title: 'Körte', priority: 'low', dueDate: '2030-02-10' })
    await card(done.id, { title: 'Szilva', priority: 'high', description: 'alma lekvár' })
    await card(done.id, { title: '100% kész_' })
    const get = async (qs: string) => (await owner.api.get(`/boards/${board.id}/cards${qs}`)).body
    const titles = (body: { data: { title: string }[] }) => body.data.map((c) => c.title)

    expect(titles(await get(''))).toEqual(['Alma pite', 'Körte', 'Szilva', '100% kész_'])
    expect(titles(await get(`?columnId=${done.id}`))).toEqual(['Szilva', '100% kész_'])
    expect(titles(await get('?priority=high'))).toEqual(['Alma pite', 'Szilva'])
    expect(titles(await get(`?labelId=${bug.id}`))).toEqual(['Alma pite'])
    expect(titles(await get('?dueBefore=2030-01-31'))).toEqual(['Alma pite'])
    expect(titles(await get('?dueAfter=2030-02-01'))).toEqual(['Körte'])
    expect(titles(await get('?q=ALMA'))).toEqual(['Alma pite', 'Szilva'])
    // A LIKE jokerek nem működnek jokerként.
    expect(titles(await get('?q=%25'))).toEqual(['100% kész_'])
    expect(titles(await get('?q=_'))).toEqual(['100% kész_'])

    const p1 = await get('?limit=3')
    expect(p1.data).toHaveLength(3)
    const p2 = await get(`?limit=3&cursor=${p1.nextCursor}`)
    expect(titles(p2)).toEqual(['100% kész_'])
    expect(p2.nextCursor).toBeNull()
  })

  it('validates the query and the column', async () => {
    const { owner, board } = await setup()
    expect((await owner.api.get(`/boards/${board.id}/cards?priority=urgent`)).status).toBe(400)
    expect((await owner.api.get(`/boards/${board.id}/cards?limit=1000`)).status).toBe(400)
    expect((await owner.api.get(`/boards/${board.id}/cards?columnId=nope`)).status).toBe(404)
    const stranger = await signUp(t.app, 's@example.com')
    expect((await stranger.api.get(`/boards/${board.id}/cards`)).status).toBe(404)
  })
})
