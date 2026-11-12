import { beforeEach, describe, expect, it } from 'vitest'
import { workspaceMembers } from '../../db/schema.js'
import { createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
})

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const viewer = await signUp(t.app, 'viewer@example.com', 'Vera')
  const stranger = await signUp(t.app, 'stranger@example.com', 'Samu')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  t.db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: viewer.user.id, role: 'viewer' })
    .run()
  const board = (
    await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T', visibility: 'workspace' })
  ).body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const bug = (await owner.api.post(`/boards/${board.id}/labels`, { name: 'Bug', color: 'rose' }))
    .body
  const feature = (
    await owner.api.post(`/boards/${board.id}/labels`, { name: 'Feature', color: 'blue' })
  ).body
  const card = (
    await owner.api.post(`/columns/${col.id}/cards`, { title: 'K', labelIds: [bug.id] })
  ).body
  return { owner, viewer, stranger, board, bug, feature, card }
}

describe('label management', () => {
  it('renames and recolors a label, visible on the board', async () => {
    const { owner, board, bug } = await setup()
    const res = await owner.api.patch(`/labels/${bug.id}`, { name: 'Hiba', color: 'amber' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: bug.id, name: 'Hiba', color: 'amber' })
    const view = (await owner.api.get(`/boards/${board.id}`)).body
    expect(view.labels.find((l: { id: string }) => l.id === bug.id).name).toBe('Hiba')
  })

  it('rejects a duplicate name (case-insensitive) and an empty update', async () => {
    const { owner, bug, feature } = await setup()
    const dup = await owner.api.patch(`/labels/${bug.id}`, { name: 'feature' })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('label_name_taken')
    expect((await owner.api.patch(`/labels/${feature.id}`, {})).status).toBe(400)
    // a saját nevét kis-nagybetű módosítással megtarthatja
    expect((await owner.api.patch(`/labels/${bug.id}`, { name: 'BUG' })).status).toBe(200)
  })

  it('deleting a label removes it from the cards', async () => {
    const { owner, bug, card } = await setup()
    expect((await owner.api.delete(`/labels/${bug.id}`)).status).toBe(204)
    expect((await owner.api.get(`/cards/${card.id}`)).body.labelIds).toEqual([])
    expect((await owner.api.delete(`/labels/${bug.id}`)).status).toBe(404)
  })

  it('forbids viewers and hides labels from strangers', async () => {
    const { viewer, stranger, bug } = await setup()
    expect((await viewer.api.patch(`/labels/${bug.id}`, { name: 'X' })).status).toBe(403)
    expect((await viewer.api.delete(`/labels/${bug.id}`)).status).toBe(403)
    expect((await stranger.api.patch(`/labels/${bug.id}`, { name: 'X' })).status).toBe(404)
    expect((await stranger.api.delete(`/labels/${bug.id}`)).status).toBe(404)
  })
})
