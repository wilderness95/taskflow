import { beforeEach, describe, expect, it } from 'vitest'
import { workspaceMembers } from '../../db/schema.js'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

const day = (offset: number, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const member = await signUp(t.app, 'member@example.com', 'Marci')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  t.db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: member.user.id, role: 'member' })
    .run()
  const board = (
    await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T', visibility: 'workspace' })
  ).body
  const todo = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const done = (
    await owner.api.post(`/boards/${board.id}/columns`, { title: 'Done', isDone: true })
  ).body
  return { owner, member, board, todo, done }
}

describe('notifications', () => {
  it('notifies the assignee, but not the actor assigning themselves', async () => {
    const { owner, member, todo } = await setup()
    const card = (
      await owner.api.post(`/columns/${todo.id}/cards`, {
        title: 'Feladat',
        assigneeIds: [owner.user.id, member.user.id],
      })
    ).body

    const mine = (await member.api.get('/notifications')).body
    expect(mine.unreadCount).toBe(1)
    expect(mine.data[0]).toMatchObject({
      type: 'assigned',
      cardId: card.id,
      cardTitle: 'Feladat',
      actorName: 'Olga',
      readAt: null,
    })
    expect((await owner.api.get('/notifications')).body.data).toHaveLength(0)

    // Újabb hozzárendelésnél csak az újonnan felvett kap értesítést.
    await owner.api.patch(`/cards/${card.id}`, { assigneeIds: [member.user.id, owner.user.id] })
    expect((await member.api.get('/notifications')).body.data).toHaveLength(1)
  })

  it('notifies mentioned users, once per mention', async () => {
    const { owner, member, todo } = await setup()
    const card = (await owner.api.post(`/columns/${todo.id}/cards`, { title: 'K' })).body
    const c = (
      await owner.api.post(`/cards/${card.id}/comments`, {
        body: '@Marci nézd',
        mentionIds: [member.user.id],
      })
    ).body
    await owner.api.patch(`/comments/${c.id}`, {
      body: '@Marci nézd meg',
      mentionIds: [member.user.id],
    })
    const list = (await member.api.get('/notifications')).body
    expect(list.data.map((n: { type: string }) => n.type)).toEqual(['mentioned'])
    // Önmagát megemlítő nem kap értesítést.
    await member.api.post(`/cards/${card.id}/comments`, {
      body: '@Marci',
      mentionIds: [member.user.id],
    })
    expect((await member.api.get('/notifications')).body.data).toHaveLength(1)
  })

  it('marks notifications read, one by one and all at once; filters unread', async () => {
    const { owner, member, todo } = await setup()
    for (const title of ['A', 'B', 'C']) {
      await owner.api.post(`/columns/${todo.id}/cards`, { title, assigneeIds: [member.user.id] })
    }
    const list = (await member.api.get('/notifications')).body
    expect(list.unreadCount).toBe(3)
    expect(list.data.map((n: { cardTitle: string }) => n.cardTitle)).toEqual(['C', 'B', 'A'])

    const read = await member.api.post(`/notifications/${list.data[0].id}/read`)
    expect(read.body.readAt).toBeTruthy()
    const unread = (await member.api.get('/notifications?unread=true')).body
    expect(unread.data).toHaveLength(2)
    expect(unread.unreadCount).toBe(2)

    const page = (await member.api.get('/notifications?limit=2')).body
    expect(page.nextCursor).toBeTruthy()
    expect(
      (await member.api.get(`/notifications?limit=2&cursor=${page.nextCursor}`)).body.data,
    ).toHaveLength(1)

    expect((await member.api.post('/notifications/read-all')).status).toBe(204)
    expect((await member.api.get('/notifications')).body.unreadCount).toBe(0)
  })

  it("never shows or changes another user's notifications", async () => {
    const { owner, member, todo } = await setup()
    await owner.api.post(`/columns/${todo.id}/cards`, { title: 'A', assigneeIds: [member.user.id] })
    const id = (await member.api.get('/notifications')).body.data[0].id
    expect((await owner.api.post(`/notifications/${id}/read`)).status).toBe(404)
    await owner.api.post('/notifications/read-all')
    expect((await member.api.get('/notifications')).body.unreadCount).toBe(1)
  })

  it('requires login and is not available with API keys', async () => {
    const { owner } = await setup()
    const key = (
      await owner.api.post('/api-keys', { name: 'k', scopes: ['boards:read', 'boards:write'] })
    ).body
    expect((await bearer(t.app, key.key).get('/notifications')).status).toBe(403)
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/notifications' })
    expect(res.statusCode).toBe(401)
  })
})

describe('due date reminders', () => {
  it('reminds assignees of cards due today or tomorrow, once per due date', async () => {
    const { owner, member, todo, done } = await setup()
    const make = async (title: string, dueDate: string | null, column = todo) =>
      (
        await owner.api.post(`/columns/${column.id}/cards`, {
          title,
          dueDate,
          assigneeIds: [member.user.id],
        })
      ).body
    const today = await make('Ma', day(0))
    await make('Holnap', day(1))
    await make('Később', day(2))
    await make('Tegnap', day(-1))
    await make('Kész', day(0), done)
    await make('Nincs', null)
    await owner.api.post(`/columns/${todo.id}/cards`, { title: 'Gazdátlan', dueDate: day(0) })
    await member.api.post('/notifications/read-all')

    expect(t.app.sendDueReminders()).toBe(2)
    const list = (await member.api.get('/notifications?unread=true')).body
    expect(list.data.map((n: { cardTitle: string }) => n.cardTitle).sort()).toEqual(
      ['Holnap', 'Ma'].filter(Boolean),
    )
    expect(list.data[0]).toMatchObject({ type: 'due_soon', actorId: null, readAt: null })
    expect(list.data.find((n: { cardId: string }) => n.cardId === today.id).dueDate).toBe(day(0))

    // Ugyanarra a határidőre nincs újabb; a határidő módosítása újat ad.
    expect(t.app.sendDueReminders()).toBe(0)
    await owner.api.patch(`/cards/${today.id}`, { dueDate: day(1) })
    expect(t.app.sendDueReminders()).toBe(1)
  })

  it('skips users who lost access to the board', async () => {
    const { owner, member, board, todo } = await setup()
    await owner.api.post(`/columns/${todo.id}/cards`, {
      title: 'Ma',
      dueDate: day(0),
      assigneeIds: [member.user.id],
    })
    await owner.api.patch(`/boards/${board.id}`, { visibility: 'private' })
    expect(t.app.sendDueReminders()).toBe(0)
  })
})
