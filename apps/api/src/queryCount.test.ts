import { describe, expect, it } from 'vitest'
import { createTestApp, signUp } from './testing/helpers.js'

/**
 * N+1 védelem: a beolvasó végpontok SQL-lekérdezéseinek száma nem függhet a kártyák számától.
 * A drizzle minden lekérdezéshez a `prepare`-t hívja, így annak hívásait számoljuk.
 */
describe('query count (no N+1)', () => {
  async function seed(cardCount: number) {
    const t = createTestApp({ REGISTRATION_MODE: 'open' })
    const owner = await signUp(t.app, 'owner@example.com', 'Olga')
    const ws = (await owner.api.get('/workspaces')).body.data[0]
    const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T' })).body
    const label = (await owner.api.post(`/boards/${board.id}/labels`, { name: 'L', color: 'blue' }))
      .body
    const cols = [
      (await owner.api.post(`/boards/${board.id}/columns`, { title: 'A' })).body,
      (await owner.api.post(`/boards/${board.id}/columns`, { title: 'B' })).body,
    ]
    for (let i = 0; i < cardCount; i++) {
      const card = (
        await owner.api.post(`/columns/${cols[i % 2]!.id}/cards`, {
          title: `c${i}`,
          labelIds: [label.id],
          assigneeIds: [owner.user.id],
        })
      ).body
      const cl = (await owner.api.post(`/cards/${card.id}/checklists`, { title: 'cl' })).body
      await owner.api.post(`/checklists/${cl.id}/items`, { text: 'x' })
      await owner.api.post(`/cards/${card.id}/comments`, { body: 'hi' })
    }
    return { t, owner, board }
  }

  const count = async (t: ReturnType<typeof createTestApp>, fn: () => Promise<unknown>) => {
    const client = t.db.$client
    const original = client.prepare.bind(client)
    let n = 0
    client.prepare = ((sql: string) => {
      n++
      return original(sql)
    }) as typeof client.prepare
    await fn()
    client.prepare = original
    return n
  }

  it('reads cost the same number of queries for 3 and for 30 cards', async () => {
    const small = await seed(3)
    const large = await seed(30)
    const paths = (boardId: string) => [
      `/boards/${boardId}`,
      `/boards/${boardId}/snapshot`,
      `/boards/${boardId}/cards?limit=50`,
      `/boards/${boardId}/activity`,
      '/boards',
    ]
    const measure = async (s: Awaited<ReturnType<typeof seed>>) => {
      const result: Record<string, number> = {}
      for (const p of paths(s.board.id)) {
        result[p.replace(s.board.id, ':id')] = await count(s.t, async () => {
          expect((await s.owner.api.get(p)).status).toBe(200)
        })
      }
      return result
    }
    const smallCounts = await measure(small)
    // Az elszámolás működik (nem nulla), és a méretfüggetlenség teljesül.
    expect(Object.values(smallCounts).every((n) => n > 0)).toBe(true)
    expect(await measure(large)).toEqual(smallCounts)
  }, 60_000)
})
