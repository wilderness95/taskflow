import { beforeEach, describe, expect, it } from 'vitest'
import { BOARD_VISIBILITIES, type BoardVisibility, type WorkspaceRole } from '@taskflow/shared'
import {
  client,
  createTestApp,
  signUp,
  tokenFromLastMail,
  type TestClient,
} from '../testing/helpers.js'

type Person = Awaited<ReturnType<typeof signUp>>

let t: ReturnType<typeof createTestApp>
let owner: Person
let ws: { id: string }
const people = {} as Record<'admin' | 'member' | 'viewer' | 'outsider', Person>
let anonymous: TestClient

beforeEach(async () => {
  t = createTestApp({ REGISTRATION_MODE: 'open' })
  anonymous = client(t.app)
  owner = await signUp(t.app, 'boss@example.com')
  ws = (await owner.api.post('/workspaces', { name: 'Csapat' })).body
  for (const role of ['admin', 'member', 'viewer'] as const satisfies WorkspaceRole[]) {
    people[role] = await signUp(t.app, `${role}@example.com`)
    await owner.api.post(`/workspaces/${ws.id}/invitations`, { email: `${role}@example.com`, role })
    await people[role].api.post('/invitations/accept', { token: tokenFromLastMail(t.mailer) })
  }
  people.outsider = await signUp(t.app, 'outsider@example.com')
})

const createBoard = async (visibility: BoardVisibility, by: Person = owner) =>
  (await by.api.post(`/workspaces/${ws.id}/boards`, { title: `Tábla ${visibility}`, visibility }))
    .body

type Actor = 'owner' | 'admin' | 'member' | 'viewer' | 'outsider' | 'anonymous'
const actors: Actor[] = ['owner', 'admin', 'member', 'viewer', 'outsider', 'anonymous']
const apiOf = (actor: Actor): TestClient =>
  actor === 'anonymous' ? anonymous : actor === 'owner' ? owner.api : people[actor].api

type Outcome = { read: number; write: number; update: number; manage: number; delete: number }
const ADMIN: Outcome = { read: 200, write: 201, update: 200, manage: 200, delete: 204 }
const EDITOR: Outcome = { read: 200, write: 403, update: 403, manage: 403, delete: 403 }
const EDITOR_WRITE: Outcome = { ...EDITOR, write: 201 }
const VIEWER: Outcome = { read: 200, write: 403, update: 403, manage: 403, delete: 403 }
const HIDDEN: Outcome = { read: 404, write: 404, update: 404, manage: 404, delete: 404 }
/** Névtelenül csak az olvasás engedélyezett útvonal; a többi bejelentkezést kér. */
const ANON_PUBLIC: Outcome = { read: 200, write: 401, update: 401, manage: 401, delete: 401 }
const ANON_HIDDEN: Outcome = { read: 404, write: 401, update: 401, manage: 401, delete: 401 }

// Teljes mátrix: láthatóság × szereplő × művelet, az API-n át (HTTP-státuszokkal).
const matrix: Record<BoardVisibility, Record<Actor, Outcome>> = {
  private: {
    owner: ADMIN,
    admin: ADMIN,
    member: HIDDEN,
    viewer: HIDDEN,
    outsider: HIDDEN,
    anonymous: ANON_HIDDEN,
  },
  workspace: {
    owner: ADMIN,
    admin: ADMIN,
    member: EDITOR_WRITE,
    viewer: VIEWER,
    outsider: HIDDEN,
    anonymous: ANON_HIDDEN,
  },
  public: {
    owner: ADMIN,
    admin: ADMIN,
    member: EDITOR_WRITE,
    viewer: VIEWER,
    outsider: VIEWER,
    anonymous: ANON_PUBLIC,
  },
}

describe('board permission matrix over HTTP', () => {
  for (const visibility of BOARD_VISIBILITIES) {
    for (const actor of actors) {
      const want = matrix[visibility][actor]
      it(`${visibility} board as ${actor}`, async () => {
        const board = await createBoard(visibility)
        const api = apiOf(actor)
        expect((await api.get(`/boards/${board.id}`)).status).toBe(want.read)
        expect((await api.post(`/boards/${board.id}/columns`, { title: 'Új' })).status).toBe(
          want.write,
        )
        expect((await api.patch(`/boards/${board.id}`, { title: 'Átnevezve' })).status).toBe(
          want.update,
        )
        expect(
          (
            await api.put(`/boards/${board.id}/members/${people.viewer.user.id}`, {
              role: 'viewer',
            })
          ).status,
        ).toBe(want.manage)
        const doomed = await createBoard(visibility)
        expect((await api.delete(`/boards/${doomed.id}`)).status).toBe(want.delete)
      })
    }
  }

  it('hides the existence of inaccessible boards (404, never 403)', async () => {
    const board = await createBoard('private')
    for (const actor of ['member', 'viewer', 'outsider'] as const) {
      const res = await apiOf(actor).get(`/boards/${board.id}`)
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('not_found')
    }
  })
})

describe('content endpoints enforce the board role through any child id', () => {
  type Ids = { board: string; column: string; card: string; checklist: string; item: string }

  const seedContent = async (visibility: BoardVisibility): Promise<Ids> => {
    const board = await createBoard(visibility)
    const column = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'A' })).body
    const card = (await owner.api.post(`/columns/${column.id}/cards`, { title: 'K' })).body
    const checklist = (await owner.api.post(`/cards/${card.id}/checklists`, { title: 'L' })).body
    const item = (await owner.api.post(`/checklists/${checklist.id}/items`, { text: 'x' })).body
    return {
      board: board.id,
      column: column.id,
      card: card.id,
      checklist: checklist.id,
      item: item.id,
    }
  }

  const mutations = (ids: Ids): [string, (api: TestClient) => Promise<{ status: number }>][] => [
    ['create label', (a) => a.post(`/boards/${ids.board}/labels`, { name: 'L', color: 'blue' })],
    ['patch column', (a) => a.patch(`/columns/${ids.column}`, { title: 'B' })],
    ['move column', (a) => a.post(`/columns/${ids.column}/move`, {})],
    ['create card', (a) => a.post(`/columns/${ids.column}/cards`, { title: 'N' })],
    ['patch card', (a) => a.patch(`/cards/${ids.card}`, { title: 'M' })],
    ['move card', (a) => a.post(`/cards/${ids.card}/move`, { columnId: ids.column })],
    ['create checklist', (a) => a.post(`/cards/${ids.card}/checklists`, { title: 'N' })],
    ['patch checklist', (a) => a.patch(`/checklists/${ids.checklist}`, { title: 'N' })],
    ['create item', (a) => a.post(`/checklists/${ids.checklist}/items`, { text: 'y' })],
    ['patch item', (a) => a.patch(`/checklist-items/${ids.item}`, { done: true })],
    ['delete item', (a) => a.delete(`/checklist-items/${ids.item}`)],
    ['delete checklist', (a) => a.delete(`/checklists/${ids.checklist}`)],
    ['delete card', (a) => a.delete(`/cards/${ids.card}`)],
    ['delete column', (a) => a.delete(`/columns/${ids.column}`)],
  ]

  it('a workspace viewer cannot change anything, but can read', async () => {
    const ids = await seedContent('workspace')
    const viewer = people.viewer.api
    for (const [name, run] of mutations(ids)) {
      expect(`${name}: ${(await run(viewer)).status}`).toBe(`${name}: 403`)
    }
    expect((await viewer.get(`/cards/${ids.card}`)).status).toBe(200)
    // semmi nem változott
    const board = (await owner.api.get(`/boards/${ids.board}`)).body
    expect(board.columns[0].title).toBe('A')
    expect(board.columns[0].cards[0].title).toBe('K')
  })

  it('an outsider sees nothing of a private board (404 on every id)', async () => {
    const ids = await seedContent('private')
    const outsider = people.outsider.api
    for (const [name, run] of mutations(ids)) {
      expect(`${name}: ${(await run(outsider)).status}`).toBe(`${name}: 404`)
    }
    expect((await outsider.get(`/cards/${ids.card}`)).status).toBe(404)
  })

  it('a workspace member can change content on workspace boards', async () => {
    const ids = await seedContent('workspace')
    const member = people.member.api
    expect((await member.patch(`/cards/${ids.card}`, { title: 'M' })).status).toBe(200)
    expect((await member.patch(`/checklist-items/${ids.item}`, { done: true })).status).toBe(200)
    expect((await member.post(`/cards/${ids.card}/move`, { columnId: ids.column })).status).toBe(
      200,
    )
  })

  it('moving a card to a column of another board is rejected', async () => {
    const a = await seedContent('workspace')
    const b = await seedContent('workspace')
    const res = await people.member.api.post(`/cards/${a.card}/move`, { columnId: b.column })
    expect(res.status).toBe(404)
  })

  it('anonymous clients cannot read cards of a public board by id (only the board itself)', async () => {
    const ids = await seedContent('public')
    expect((await anonymous.get(`/cards/${ids.card}`)).status).toBe(401)
    const board = await anonymous.get(`/boards/${ids.board}`)
    expect(board.status).toBe(200)
    expect(board.body).toMatchObject({ myRole: 'viewer', starred: false })
  })
})

describe('board lists and creation', () => {
  it('lists only the boards the actor can read', async () => {
    await createBoard('private')
    await createBoard('workspace')
    await createBoard('public')
    const titles = async (actor: Actor) =>
      (await apiOf(actor).get('/boards')).body.data
        .filter((b: { workspaceId: string }) => b.workspaceId === ws.id)
        .map((b: { visibility: string }) => b.visibility)
        .sort()
    expect(await titles('owner')).toEqual(['private', 'public', 'workspace'])
    expect(await titles('admin')).toEqual(['private', 'public', 'workspace'])
    expect(await titles('member')).toEqual(['public', 'workspace'])
    expect(await titles('viewer')).toEqual(['public', 'workspace'])
    expect(await titles('outsider')).toEqual([])
    expect((await anonymous.get('/boards')).status).toBe(401)
  })

  it('per-workspace listing requires membership', async () => {
    await createBoard('workspace')
    expect((await people.member.api.get(`/workspaces/${ws.id}/boards`)).body.data).toHaveLength(1)
    expect((await people.outsider.api.get(`/workspaces/${ws.id}/boards`)).status).toBe(404)
  })

  it('viewers and outsiders cannot create boards; members can, and keep their private board', async () => {
    const body = { title: 'Új', visibility: 'private' }
    expect((await people.viewer.api.post(`/workspaces/${ws.id}/boards`, body)).status).toBe(403)
    expect((await people.outsider.api.post(`/workspaces/${ws.id}/boards`, body)).status).toBe(404)
    const mine = await createBoard('private', people.member)
    expect(mine.myRole).toBe('admin')
    expect((await people.member.api.get(`/boards/${mine.id}`)).status).toBe(200)
    // más tagok nem látják, a tulajdonos és az admin igen
    expect((await people.viewer.api.get(`/boards/${mine.id}`)).status).toBe(404)
    expect((await owner.api.get(`/boards/${mine.id}`)).status).toBe(200)
    expect((await people.admin.api.get(`/boards/${mine.id}`)).status).toBe(200)
  })

  it('a non-empty workspace cannot be deleted', async () => {
    await createBoard('workspace')
    const res = await owner.api.delete(`/workspaces/${ws.id}`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('workspace_not_empty')
  })

  it('reports the effective role and visibility changes take effect immediately', async () => {
    const board = await createBoard('workspace')
    expect((await people.member.api.get(`/boards/${board.id}`)).body.myRole).toBe('editor')
    expect((await people.viewer.api.get(`/boards/${board.id}`)).body.myRole).toBe('viewer')
    expect((await owner.api.get(`/boards/${board.id}`)).body.myRole).toBe('admin')
    await owner.api.patch(`/boards/${board.id}`, { visibility: 'private' })
    expect((await people.member.api.get(`/boards/${board.id}`)).status).toBe(404)
    await owner.api.patch(`/boards/${board.id}`, { visibility: 'public' })
    expect((await people.outsider.api.get(`/boards/${board.id}`)).status).toBe(200)
  })
})

describe('explicit board members', () => {
  it('grants a workspace member access to a private board, and revokes it', async () => {
    const board = await createBoard('private')
    const memberId = people.member.user.id
    expect((await people.member.api.get(`/boards/${board.id}`)).status).toBe(404)

    const granted = await owner.api.put(`/boards/${board.id}/members/${memberId}`, {
      role: 'editor',
    })
    expect(granted.status).toBe(200)
    expect(granted.body).toMatchObject({ userId: memberId, role: 'editor' })
    expect((await people.member.api.get(`/boards/${board.id}`)).body.myRole).toBe('editor')
    expect(
      (await people.member.api.post(`/boards/${board.id}/columns`, { title: 'X' })).status,
    ).toBe(201)
    expect((await people.member.api.patch(`/boards/${board.id}`, { title: 'Y' })).status).toBe(403)

    // a tábla admin explicit szerepkörrel kezelheti a tagokat
    await owner.api.put(`/boards/${board.id}/members/${memberId}`, { role: 'admin' })
    expect((await people.member.api.patch(`/boards/${board.id}`, { title: 'Y' })).status).toBe(200)

    expect(
      (await owner.api.get(`/boards/${board.id}/members`)).body.data
        .map((m: { role: string }) => m.role)
        .sort(),
    ).toEqual(['admin', 'admin'])
    expect((await owner.api.delete(`/boards/${board.id}/members/${memberId}`)).status).toBe(204)
    expect((await people.member.api.get(`/boards/${board.id}`)).status).toBe(404)
    expect((await owner.api.delete(`/boards/${board.id}/members/${memberId}`)).status).toBe(404)
  })

  it('only workspace members can get an explicit board role', async () => {
    const board = await createBoard('private')
    const res = await owner.api.put(`/boards/${board.id}/members/${people.outsider.user.id}`, {
      role: 'viewer',
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('not_workspace_member')
  })

  it('removing someone from the workspace revokes their explicit board roles and stars', async () => {
    const board = await createBoard('private')
    const memberId = people.member.user.id
    await owner.api.put(`/boards/${board.id}/members/${memberId}`, { role: 'editor' })
    expect((await people.member.api.put(`/boards/${board.id}/star`)).status).toBe(204)
    expect((await people.member.api.get(`/boards/${board.id}`)).body.starred).toBe(true)

    expect((await owner.api.delete(`/workspaces/${ws.id}/members/${memberId}`)).status).toBe(204)
    expect((await people.member.api.get(`/boards/${board.id}`)).status).toBe(404)
    expect((await owner.api.get(`/boards/${board.id}/members`)).body.data).toHaveLength(1)
  })

  it('only board admins manage members', async () => {
    const board = await createBoard('workspace')
    const viewerId = people.viewer.user.id
    expect(
      (await people.member.api.put(`/boards/${board.id}/members/${viewerId}`, { role: 'editor' }))
        .status,
    ).toBe(403)
    expect((await people.member.api.delete(`/boards/${board.id}/members/${viewerId}`)).status).toBe(
      403,
    )
    expect((await people.outsider.api.get(`/boards/${board.id}/members`)).status).toBe(404)
  })
})

describe('stars', () => {
  it('stars are personal and need read access', async () => {
    const board = await createBoard('workspace')
    expect((await people.viewer.api.put(`/boards/${board.id}/star`)).status).toBe(204)
    expect((await people.viewer.api.get(`/boards/${board.id}`)).body.starred).toBe(true)
    expect((await owner.api.get(`/boards/${board.id}`)).body.starred).toBe(false)
    const list = (await people.viewer.api.get('/boards')).body.data
    expect(list.find((b: { id: string }) => b.id === board.id).starred).toBe(true)
    expect((await people.viewer.api.delete(`/boards/${board.id}/star`)).status).toBe(204)
    expect((await people.viewer.api.get(`/boards/${board.id}`)).body.starred).toBe(false)

    const hidden = await createBoard('private')
    expect((await people.viewer.api.put(`/boards/${hidden.id}/star`)).status).toBe(404)
  })
})
