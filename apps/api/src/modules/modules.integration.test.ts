import type { FastifyInstance } from 'fastify'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'
import { loadConfig } from '../config.js'
import { createDb, runMigrations } from '../db/client.js'
import { SEED_BOARD_ID, seed } from '../db/seed.js'

let app: FastifyInstance

beforeEach(() => {
  const { db } = createDb(':memory:')
  runMigrations(db)
  seed(db)
  app = buildApp(loadConfig({ NODE_ENV: 'test' }), db)
})

const call = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) => {
  const res = await app.inject({ method, url: `/api/v1${url}`, payload })
  return { status: res.statusCode, body: res.body ? res.json() : null }
}

const getBoard = async () => (await call('GET', `/boards/${SEED_BOARD_ID}`)).body

describe('boards', () => {
  it('lists and returns the full seeded board', async () => {
    const list = await call('GET', '/boards')
    expect(list.body.data).toHaveLength(1)
    const board = await getBoard()
    expect(board.columns.map((c: { title: string }) => c.title)).toEqual([
      'Teendők',
      'Folyamatban',
      'Kész',
    ])
    expect(board.columns[0].cards[0].title).toBe('Landing page vázlat')
    expect(board.columns[0].cards[0].checklists[0].items).toHaveLength(4)
    expect(board.labels).toHaveLength(5)
  })

  it('creates, updates and archives a board', async () => {
    const created = await call('POST', '/boards', { title: 'Új' })
    expect(created.status).toBe(201)
    expect(created.body.visibility).toBe('private')
    const id = created.body.id
    expect((await call('PATCH', `/boards/${id}`, { title: 'Átnevezett' })).body.title).toBe(
      'Átnevezett',
    )
    expect((await call('DELETE', `/boards/${id}`)).status).toBe(204)
    expect((await call('GET', `/boards/${id}`)).status).toBe(404)
    expect((await call('GET', '/boards')).body.data).toHaveLength(1)
  })

  it('validates input with the unified error format', async () => {
    const res = await call('POST', '/boards', { title: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('validation_error')
    expect((await call('PATCH', `/boards/${SEED_BOARD_ID}`, {})).status).toBe(400)
    expect((await call('GET', '/boards/nope')).body.error.code).toBe('not_found')
  })
})

describe('columns', () => {
  it('appends new columns at the end and updates them', async () => {
    const col = await call('POST', `/boards/${SEED_BOARD_ID}/columns`, { title: 'Review' })
    expect(col.status).toBe(201)
    const board = await getBoard()
    expect(board.columns.at(-1).id).toBe(col.body.id)
    const upd = await call('PATCH', `/columns/${col.body.id}`, { accent: 'rose', isDone: true })
    expect(upd.body).toMatchObject({ accent: 'rose', isDone: true })
  })

  it('refuses to delete a non-empty column without a target, moves cards with one', async () => {
    const board = await getBoard()
    const [todo, doing] = board.columns
    const refused = await call('DELETE', `/columns/${todo.id}`)
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('column_not_empty')

    const bad = await call('DELETE', `/columns/${todo.id}?moveCardsTo=${todo.id}`)
    expect(bad.status).toBe(422)

    expect((await call('DELETE', `/columns/${todo.id}?moveCardsTo=${doing.id}`)).status).toBe(204)
    const after = await getBoard()
    expect(after.columns).toHaveLength(2)
    expect(after.columns[0].cards.map((c: { title: string }) => c.title)).toEqual([
      'Dashboard felület',
      'Landing page vázlat',
      'Felhasználói visszajelzés',
    ])
  })
})

describe('cards', () => {
  it('creates, reads, updates (version bump) and deletes a card', async () => {
    const board = await getBoard()
    const col = board.columns[0]
    const label = board.labels[0]
    const created = await call('POST', `/columns/${col.id}/cards`, {
      title: 'Új kártya',
      priority: 'low',
      dueDate: '2026-12-01',
      labelIds: [label.id],
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ priority: 'low', labelIds: [label.id], version: 1 })
    const id = created.body.id

    const upd = await call('PATCH', `/cards/${id}`, {
      title: 'Módosított',
      dueDate: null,
      labelIds: [],
    })
    expect(upd.body).toMatchObject({ title: 'Módosított', dueDate: null, labelIds: [], version: 2 })
    expect((await call('GET', `/cards/${id}`)).body.title).toBe('Módosított')

    expect((await call('DELETE', `/cards/${id}`)).status).toBe(204)
    expect((await call('GET', `/cards/${id}`)).status).toBe(404)
  })

  it('rejects invalid priority, date and foreign labels', async () => {
    const board = await getBoard()
    const col = board.columns[0].id
    expect(
      (await call('POST', `/columns/${col}/cards`, { title: 'x', priority: 'urgent' })).status,
    ).toBe(400)
    expect(
      (await call('POST', `/columns/${col}/cards`, { title: 'x', dueDate: 'holnap' })).status,
    ).toBe(400)
    const other = await call('POST', '/boards', { title: 'Másik' })
    const foreign = await call('POST', `/boards/${other.body.id}/labels`, {
      name: 'X',
      color: 'blue',
    })
    expect(foreign.status).toBe(201)
    const res = await call('POST', `/columns/${col}/cards`, {
      title: 'x',
      labelIds: [foreign.body.id],
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('invalid_label')
    expect((await call('POST', '/columns/nope/cards', { title: 'x' })).status).toBe(404)
  })
})

describe('checklists', () => {
  it('manages checklists and items', async () => {
    const board = await getBoard()
    const card = board.columns[0].cards[0]
    const cl = await call('POST', `/cards/${card.id}/checklists`, { title: 'QA' })
    expect(cl.status).toBe(201)

    const item = await call('POST', `/checklists/${cl.body.id}/items`, { text: 'Tesztelni' })
    expect(item.body).toMatchObject({ text: 'Tesztelni', done: false })
    const done = await call('PATCH', `/checklist-items/${item.body.id}`, { done: true })
    expect(done.body.done).toBe(true)
    expect(
      (await call('PATCH', `/checklists/${cl.body.id}`, { title: 'QA 2' })).body.items,
    ).toHaveLength(1)

    const full = (await call('GET', `/cards/${card.id}`)).body
    expect(full.checklists.map((c: { title: string }) => c.title)).toEqual(['Checklist', 'QA 2'])

    expect((await call('DELETE', `/checklist-items/${item.body.id}`)).status).toBe(204)
    expect((await call('DELETE', `/checklists/${cl.body.id}`)).status).toBe(204)
    expect((await call('DELETE', `/checklists/${cl.body.id}`)).status).toBe(404)
    expect((await call('PATCH', '/checklist-items/nope', { done: true })).status).toBe(404)
  })

  it('removes a card together with its checklists', async () => {
    const card = (await getBoard()).columns[0].cards[0]
    expect((await call('DELETE', `/cards/${card.id}`)).status).toBe(204)
    expect((await call('POST', `/cards/${card.id}/checklists`, {})).status).toBe(404)
  })
})

describe('move', () => {
  const titles = (col: { cards: { title: string }[] }) => col.cards.map((c) => c.title)

  it('reorders a card within a column and bumps its version', async () => {
    const [todo] = (await getBoard()).columns
    const [first, second] = todo.cards
    const res = await call('POST', `/cards/${second.id}/move`, {
      columnId: todo.id,
      beforeCardId: first.id,
    })
    expect(res.status).toBe(200)
    expect(res.body.version).toBe(2)
    expect(titles((await getBoard()).columns[0])).toEqual([second.title, first.title])
  })

  it('moves a card across columns, to a given place or to the end', async () => {
    const board = await getBoard()
    const [todo, doing, done] = board.columns
    const card = todo.cards[0]
    await call('POST', `/cards/${card.id}/move`, {
      columnId: doing.id,
      beforeCardId: doing.cards[0].id,
    })
    let after = (await getBoard()).columns
    expect(titles(after[1])).toEqual([card.title, 'Dashboard felület'])
    expect(titles(after[0])).toHaveLength(1)

    await call('POST', `/cards/${card.id}/move`, { columnId: done.id })
    after = (await getBoard()).columns
    expect(titles(after[2])).toEqual(['Brand guideline', card.title])
    // csak a mozgatott kártya sora változott
    expect(after[1].cards[0].position).toBe(doing.cards[0].position)
  })

  it('keeps order after many inserts at the same spot', async () => {
    const [todo] = (await getBoard()).columns
    const [first, second] = todo.cards
    const ids: string[] = []
    for (let i = 0; i < 20; i++) {
      const c = await call('POST', `/columns/${todo.id}/cards`, { title: `n${i}` })
      ids.push(c.body.id)
      await call('POST', `/cards/${c.body.id}/move`, { columnId: todo.id, beforeCardId: second.id })
    }
    const result = titles((await getBoard()).columns[0])
    expect(result).toEqual([
      first.title,
      ...Array.from({ length: 20 }, (_, i) => `n${i}`),
      second.title,
    ])
  })

  it('rejects invalid targets', async () => {
    const board = await getBoard()
    const [todo, doing] = board.columns
    const card = todo.cards[0]
    const wrongList = await call('POST', `/cards/${card.id}/move`, {
      columnId: doing.id,
      beforeCardId: todo.cards[1].id,
    })
    expect(wrongList.status).toBe(422)
    expect(wrongList.body.error.code).toBe('invalid_position_target')
    expect((await call('POST', `/cards/${card.id}/move`, { columnId: 'nope' })).status).toBe(404)
    expect((await call('POST', '/cards/nope/move', { columnId: doing.id })).status).toBe(404)
    expect((await call('POST', `/cards/${card.id}/move`, {})).status).toBe(400)

    const other = await call('POST', '/boards', { title: 'Másik' })
    const foreign = await call('POST', `/boards/${other.body.id}/columns`, { title: 'X' })
    expect(
      (await call('POST', `/cards/${card.id}/move`, { columnId: foreign.body.id })).status,
    ).toBe(404)
  })

  it('moves columns', async () => {
    const [todo, doing, done] = (await getBoard()).columns
    await call('POST', `/columns/${done.id}/move`, { beforeColumnId: todo.id })
    expect((await getBoard()).columns.map((c: { id: string }) => c.id)).toEqual([
      done.id,
      todo.id,
      doing.id,
    ])
    await call('POST', `/columns/${done.id}/move`, {})
    expect((await getBoard()).columns.map((c: { id: string }) => c.id)).toEqual([
      todo.id,
      doing.id,
      done.id,
    ])
    expect(
      (await call('POST', `/columns/${todo.id}/move`, { beforeColumnId: 'nope' })).status,
    ).toBe(422)
    expect((await call('POST', '/columns/nope/move', {})).status).toBe(404)
  })
})
