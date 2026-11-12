import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { workspaceMembers } from '../../db/schema.js'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const member = await signUp(t.app, 'member@example.com', 'Marci')
  const stranger = await signUp(t.app, 'stranger@example.com', 'Samu')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  t.db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: member.user.id, role: 'member' })
    .run()
  const board = (
    await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T', visibility: 'workspace' })
  ).body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const card = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'K' })).body
  return { owner, member, stranger, board, card }
}

describe('comments', () => {
  it('creates, lists (oldest first, paginated), edits and deletes', async () => {
    const { owner, member, card } = await setup()
    const first = (
      await owner.api.post(`/cards/${card.id}/comments`, {
        body: 'Szia @Marci',
        mentionIds: [member.user.id, member.user.id],
      })
    ).body
    expect(first).toMatchObject({
      body: 'Szia @Marci',
      authorName: 'Olga',
      mentionIds: [member.user.id],
      viaApiKey: false,
      editedAt: null,
    })
    await member.api.post(`/cards/${card.id}/comments`, { body: 'Válasz' })

    const page1 = (await owner.api.get(`/cards/${card.id}/comments?limit=1`)).body
    expect(page1.data.map((c: { body: string }) => c.body)).toEqual(['Szia @Marci'])
    const page2 = (await owner.api.get(`/cards/${card.id}/comments?cursor=${page1.nextCursor}`))
      .body
    expect(page2.data.map((c: { body: string }) => c.body)).toEqual(['Válasz'])
    expect(page2.nextCursor).toBeNull()

    const edited = (await owner.api.patch(`/comments/${first.id}`, { body: 'Javítva' })).body
    expect(edited).toMatchObject({ body: 'Javítva', mentionIds: [member.user.id] })
    expect(edited.editedAt).toBeTruthy()
    expect((await owner.api.patch(`/comments/${first.id}`, {})).status).toBe(400)

    expect((await owner.api.delete(`/comments/${first.id}`)).status).toBe(204)
    expect((await owner.api.get(`/cards/${card.id}/comments`)).body.data).toHaveLength(1)
    expect((await owner.api.delete(`/comments/${first.id}`)).status).toBe(404)
  })

  it('validates input and mentions', async () => {
    const { owner, stranger, card } = await setup()
    expect((await owner.api.post(`/cards/${card.id}/comments`, { body: '  ' })).status).toBe(400)
    const res = await owner.api.post(`/cards/${card.id}/comments`, {
      body: 'x',
      mentionIds: [stranger.user.id],
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('invalid_mention')
  })

  it('only the author edits; the author or a board admin deletes', async () => {
    const { owner, member, card } = await setup()
    const mine = (await member.api.post(`/cards/${card.id}/comments`, { body: 'Enyém' })).body
    expect((await owner.api.patch(`/comments/${mine.id}`, { body: 'Hamis' })).status).toBe(403)
    const other = (await owner.api.post(`/cards/${card.id}/comments`, { body: 'Olgáé' })).body
    expect((await member.api.delete(`/comments/${other.id}`)).status).toBe(403)
    // A tábla adminja (a tulajdonos) mások hozzászólását is törölheti.
    expect((await owner.api.delete(`/comments/${mine.id}`)).status).toBe(204)
  })

  it('requires board access: hidden for strangers, read-only for viewers', async () => {
    const { owner, member, stranger, card } = await setup()
    const comment = (await owner.api.post(`/cards/${card.id}/comments`, { body: 'Titok' })).body
    expect((await stranger.api.get(`/cards/${card.id}/comments`)).status).toBe(404)
    expect((await stranger.api.post(`/cards/${card.id}/comments`, { body: 'x' })).status).toBe(404)
    expect((await stranger.api.patch(`/comments/${comment.id}`, { body: 'x' })).status).toBe(404)
    expect((await stranger.api.delete(`/comments/${comment.id}`)).status).toBe(404)

    t.db
      .update(workspaceMembers)
      .set({ role: 'viewer' })
      .where(eq(workspaceMembers.userId, member.user.id))
      .run()
    expect((await member.api.get(`/cards/${card.id}/comments`)).status).toBe(200)
    expect((await member.api.post(`/cards/${card.id}/comments`, { body: 'x' })).status).toBe(403)
  })

  it('marks comments written with an API key and respects scopes', async () => {
    const { owner, card } = await setup()
    const read = (await owner.api.post('/api-keys', { name: 'r', scopes: ['boards:read'] })).body
    const write = (
      await owner.api.post('/api-keys', { name: 'w', scopes: ['boards:read', 'boards:write'] })
    ).body
    expect(
      (await bearer(t.app, read.key).post(`/cards/${card.id}/comments`, { body: 'x' })).status,
    ).toBe(403)
    const posted = await bearer(t.app, write.key).post(`/cards/${card.id}/comments`, {
      body: 'Bot',
    })
    expect(posted.status).toBe(201)
    expect(posted.body.viaApiKey).toBe(true)
    expect(
      (await bearer(t.app, read.key).get(`/cards/${card.id}/comments`)).body.data,
    ).toHaveLength(1)
  })

  it('writes comment events to the activity log', async () => {
    const { owner, member, board, card } = await setup()
    const c = (
      await owner.api.post(`/cards/${card.id}/comments`, {
        body: 'Hi',
        mentionIds: [member.user.id],
      })
    ).body
    await owner.api.delete(`/comments/${c.id}`)
    const log = (await owner.api.get(`/boards/${board.id}/activity`)).body.data
    expect(log.slice(0, 2).map((e: { action: string }) => e.action)).toEqual([
      'comment.deleted',
      'comment.created',
    ])
    expect(log[1].meta).toMatchObject({ cardId: card.id, mentionedIds: [member.user.id] })
  })
})
