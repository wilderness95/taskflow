import { createHmac } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { webhookPayloadSchema } from '@taskflow/shared'
import { workspaceMembers } from '../../db/schema.js'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>
const servers: http.Server[] = []

beforeEach(() => {
  t = createTestApp(
    { REGISTRATION_MODE: 'open', WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true' },
    { webhookRetryDelaysMs: [0, 0, 0] },
  )
})
afterEach(async () => {
  await t.app.close()
  for (const s of servers.splice(0)) s.close()
})

type Received = { headers: http.IncomingHttpHeaders; body: string }

/** Helyi fogadó: a kapott kéréseket gyűjti; `statuses` adja sorban a válaszkódokat. */
async function receiver(statuses: number[] = [200]) {
  const received: Received[] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      received.push({ headers: req.headers, body })
      res.statusCode = statuses[Math.min(received.length - 1, statuses.length - 1)]!
      res.end()
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  servers.push(server)
  return { received, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook` }
}

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const editor = await signUp(t.app, 'editor@example.com', 'Edit')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  t.db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: editor.user.id, role: 'member' })
    .run()
  const board = (
    await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T', visibility: 'workspace' })
  ).body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  return { owner, editor, board, col }
}

describe('webhooks', () => {
  it('delivers signed events for matching actions only', async () => {
    const { owner, board, col } = await setup()
    const hook = await receiver()
    const created = await owner.api.post(`/boards/${board.id}/webhooks`, {
      url: hook.url,
      events: ['card.created'],
    })
    expect(created.status).toBe(201)
    const secret = created.body.secret as string
    expect(secret).toMatch(/^whsec_/)

    await owner.api.post(`/columns/${col.id}/cards`, { title: 'Egy' })
    const card = (await owner.api.get(`/boards/${board.id}/cards`)).body.data[0]
    await owner.api.patch(`/cards/${card.id}`, { title: 'Átnevezve' }) // nem illeszkedik
    await t.app.close()

    expect(hook.received).toHaveLength(1)
    const [req] = hook.received
    const payload = webhookPayloadSchema.parse(JSON.parse(req!.body))
    expect(payload).toMatchObject({ event: 'card.created', boardId: board.id, entityId: card.id })

    const sig = String(req!.headers['x-taskflow-signature'])
    const [, ts, hex] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(sig)!
    expect(createHmac('sha256', secret).update(`${ts}.${req!.body}`).digest('hex')).toBe(hex)
    expect(req!.headers['x-taskflow-event']).toBe('card.created')
    expect(req!.headers['x-taskflow-delivery']).toBe(payload.deliveryId)
  })

  it('retries failures with the same delivery id, then records success', async () => {
    const { owner, board, col } = await setup()
    const hook = await receiver([500, 500, 204])
    const created = (
      await owner.api.post(`/boards/${board.id}/webhooks`, {
        url: hook.url,
        events: ['card.created'],
      })
    ).body
    await owner.api.post(`/columns/${col.id}/cards`, { title: 'Egy' })
    await t.app.close()

    const ids = hook.received
      .map((r) => JSON.parse(r.body))
      .filter((p) => p.event === 'card.created')
      .map((p) => p.deliveryId)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(1)
    const row = t.db.$client
      .prepare('select failure_count, last_status from webhooks where id=?')
      .get(created.id) as { failure_count: number; last_status: number }
    expect(row).toEqual({ failure_count: 0, last_status: 204 })
  })

  it('disables a webhook after too many consecutive failures', async () => {
    const { owner, board, col } = await setup()
    const hook = await receiver([500])
    const created = (await owner.api.post(`/boards/${board.id}/webhooks`, { url: hook.url })).body
    for (let i = 0; i < 11; i++)
      await owner.api.post(`/columns/${col.id}/cards`, { title: `c${i}` })
    // Az események késleltetés nélkül, sorban kézbesülnek; a leállás megvárja őket.
    await t.app.close()
    const row = t.db.$client
      .prepare('select active, failure_count from webhooks where id=?')
      .get(created.id) as {
      active: number
      failure_count: number
    }
    expect(row.active).toBe(0)
    expect(row.failure_count).toBeGreaterThanOrEqual(10)
  })

  it('never exposes the secret after creation and enforces board admin rights', async () => {
    const { owner, editor, board } = await setup()
    const hook = await receiver()
    const created = (await owner.api.post(`/boards/${board.id}/webhooks`, { url: hook.url })).body

    const list = (await owner.api.get(`/boards/${board.id}/webhooks`)).body.data
    expect(list).toHaveLength(1)
    expect(JSON.stringify(list)).not.toContain('secret')
    const stored = t.db.$client.prepare('select secret_enc from webhooks').get() as {
      secret_enc: string
    }
    expect(stored.secret_enc).not.toContain(created.secret)

    // A szerkesztő (nem admin) nem kezelheti: 403; kívülálló: 404.
    expect((await editor.api.get(`/boards/${board.id}/webhooks`)).status).toBe(403)
    expect((await editor.api.post(`/boards/${board.id}/webhooks`, { url: hook.url })).status).toBe(
      403,
    )
    expect((await editor.api.patch(`/webhooks/${created.id}`, { active: false })).status).toBe(403)
    expect((await editor.api.delete(`/webhooks/${created.id}`)).status).toBe(403)
    const stranger = await signUp(t.app, 'stranger@example.com', 'Samu')
    expect((await stranger.api.get(`/boards/${board.id}/webhooks`)).status).toBe(404)
  })

  it('updates, re-enables and deletes', async () => {
    const { owner, board } = await setup()
    const hook = await receiver()
    const created = (await owner.api.post(`/boards/${board.id}/webhooks`, { url: hook.url })).body
    t.db.$client
      .prepare('update webhooks set active=0, failure_count=10 where id=?')
      .run(created.id)
    const patched = await owner.api.patch(`/webhooks/${created.id}`, {
      active: true,
      events: ['card.*'],
    })
    expect(patched.body).toMatchObject({ active: true, failureCount: 0, events: ['card.*'] })
    expect((await owner.api.patch(`/webhooks/${created.id}`, {})).status).toBe(400)
    expect((await owner.api.delete(`/webhooks/${created.id}`)).status).toBe(204)
    expect((await owner.api.get(`/boards/${board.id}/webhooks`)).body.data).toHaveLength(0)
  })

  it('is not available with API keys (session only)', async () => {
    const { owner, board } = await setup()
    const key = (await owner.api.post('/api-keys', { name: 'k', scopes: ['boards:write'] })).body
      .key
    const api = bearer(t.app, key)
    const res = await api.get(`/boards/${board.id}/webhooks`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('session_required')
    expect(
      (await api.post(`/boards/${board.id}/webhooks`, { url: 'https://example.com/h' })).status,
    ).toBe(403)
  })

  it('validates the URL and events', async () => {
    const { owner, board } = await setup()
    const bad = (body: object) => owner.api.post(`/boards/${board.id}/webhooks`, body)
    expect((await bad({ url: 'ftp://example.com' })).status).toBe(400)
    expect((await bad({ url: 'https://example.com', events: ['nonsense'] })).status).toBe(400)
  })
})

describe('webhooks (private targets blocked by default)', () => {
  it('rejects loopback and private network URLs', async () => {
    const strict = createTestApp({ REGISTRATION_MODE: 'open' }, { webhookRetryDelaysMs: [0] })
    const owner = await signUp(strict.app, 'o@example.com', 'O')
    const ws = (await owner.api.get('/workspaces')).body.data[0]
    const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T' })).body
    for (const url of [
      'http://127.0.0.1/h',
      'http://localhost/h',
      'http://169.254.169.254/latest',
      'http://10.0.0.5/h',
      'http://[::1]/h',
    ]) {
      const res = await owner.api.post(`/boards/${board.id}/webhooks`, { url })
      expect(res.status, url).toBe(422)
      expect(res.body.error.code).toBe('webhook_url_blocked')
    }
    expect(
      (
        await owner.api.post(`/boards/${board.id}/webhooks`, {
          url: 'https://hooks.invalid/x',
          // Nincs illeszkedő esemény: a teszt ne végezzen valódi DNS-feloldást.
          events: ['card.moved'],
        })
      ).status,
    ).toBe(201)
    await strict.app.close()
  })
})
