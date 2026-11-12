import { afterEach, describe, expect, it } from 'vitest'
import type { VoiceServerMessage } from '@taskflow/shared'
import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { createDb, runMigrations } from '../../db/client.js'
import { MemoryMailer } from '../../mail/mailer.js'
import { signUp } from '../../testing/helpers.js'
import type { LiveConnectParams, LiveConnector, LiveEvents } from './liveConnector.js'

const ORIGIN = 'http://localhost:5173'

/** Hamis Gemini: rögzíti, amit a híd küld, és kézzel lehet beleszólni a modell nevében. */
function fakeConnector() {
  const state: {
    params?: LiveConnectParams
    events?: LiveEvents
    audio: Buffer[]
    toolResponses: { id: string; name: string; response: Record<string, unknown> }[]
    closed: boolean
  } = { audio: [], toolResponses: [], closed: false }
  const connector: LiveConnector = {
    async connect(params, events) {
      state.params = params
      state.events = events
      return {
        sendAudio: (pcm) => void state.audio.push(pcm),
        sendAudioEnd: () => undefined,
        sendToolResponses: (r) => void state.toolResponses.push(...r),
        close: () => void (state.closed = true),
      }
    },
  }
  return { connector, state }
}

const apps: ReturnType<typeof buildApp>[] = []
afterEach(async () => {
  for (const a of apps.splice(0)) await a.close()
})

async function setup(
  opts: { connector?: LiveConnector | null; env?: Record<string, string> } = {},
) {
  const { db } = createDb(':memory:')
  runMigrations(db)
  const app = buildApp(
    loadConfig({
      NODE_ENV: 'test',
      APP_URL: ORIGIN,
      REGISTRATION_MODE: 'open',
      REQUIRE_EMAIL_VERIFICATION: 'false',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
      ...opts.env,
    }),
    db,
    { mailer: new MemoryMailer(), liveConnector: opts.connector },
  )
  apps.push(app)
  const owner = await signUp(app, 'owner@example.com', 'Olga')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  const board = (await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'Sprint' })).body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Teendő' })).body
  await app.ready()
  return { app, owner, board, col }
}

/** Az első üzenetek elvesznének, ha a figyelőt csak a csatlakozás után kötnénk fel: `onInit`. */
async function connect(
  app: ReturnType<typeof buildApp>,
  cookie: string,
  boardId: string | undefined,
  origin = ORIGIN,
) {
  const query = boardId?.startsWith('workspace:')
    ? `workspaceId=${boardId.slice('workspace:'.length)}`
    : `boardId=${boardId}`
  const messages: VoiceServerMessage[] = []
  const audio: Buffer[] = []
  const socket = await app.injectWS(
    `/api/v1/voice/live?${query}`,
    { headers: { cookie, origin, 'cf-connecting-ip': '203.0.113.7' } },
    {
      onInit: (ws) =>
        ws.on('message', (d: Buffer, bin: boolean) => {
          if (bin) audio.push(d)
          else messages.push(JSON.parse(d.toString()))
        }),
    },
  )
  const until = async (pred: () => boolean) => {
    for (let i = 0; i < 200 && !pred(); i++) await new Promise((r) => setTimeout(r, 10))
    expect(pred()).toBe(true)
  }
  return { socket, got: { messages, audio, until } }
}

describe('voice live', () => {
  it('bridges audio both ways and injects the date and board into the instruction', async () => {
    const { connector, state } = fakeConnector()
    const { app, owner, board } = await setup({ connector })
    const { socket, got } = await connect(app, owner.cookie, board.id)
    await got.until(() => got.messages.some((m) => m.type === 'ready'))

    expect(state.params!.systemInstruction).toContain(board.id)
    expect(state.params!.systemInstruction).toContain('Sprint')
    expect(state.params!.systemInstruction).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(state.params!.tools.map((t) => t.name)).toContain('create_card')

    socket.send(Buffer.from([1, 2, 3, 4]))
    await got.until(() => state.audio.length === 1)
    expect(state.audio[0]).toEqual(Buffer.from([1, 2, 3, 4]))

    state.events!.onAudio(Buffer.from([9, 8]).toString('base64'))
    await got.until(() => got.audio.length === 1)
    expect(got.audio[0]).toEqual(Buffer.from([9, 8]))
    expect(got.messages).toContainEqual({ type: 'state', state: 'speaking' })

    state.events!.onInterrupted()
    await got.until(() => got.messages.some((m) => m.type === 'interrupted'))
    socket.terminate()
    await new Promise((r) => setTimeout(r, 50))
    expect(state.closed).toBe(true)
  })

  it('runs tool calls as the signed-in user and the change is visible in the API', async () => {
    const { connector, state } = fakeConnector()
    const { app, owner, board } = await setup({ connector })
    const { socket, got } = await connect(app, owner.cookie, board.id)
    await got.until(() => got.messages.some((m) => m.type === 'ready'))

    // A boardId elhagyható: a szerver a nézett táblát teszi be.
    state.events!.onToolCalls([
      {
        id: 'c1',
        name: 'create_card',
        args: { column: 'teendo', title: 'Tejet venni', priority: 'high' },
      },
    ])
    await got.until(() => state.toolResponses.length === 1)
    expect(state.toolResponses[0]!.response).toHaveProperty('output')
    expect(got.messages).toContainEqual({ type: 'tool', name: 'create_card', ok: true })

    const list = (await owner.api.get(`/boards/${board.id}/cards?q=Tejet`)).body.data
    expect(list).toHaveLength(1)
    expect(list[0].priority).toBe('high')

    // A felhasználó jogai érvényesek: ismeretlen oszlop hibaként tér vissza a modellnek.
    state.events!.onToolCalls([
      { id: 'c2', name: 'create_card', args: { column: 'nincs ilyen', title: 'x' } },
    ])
    await got.until(() => state.toolResponses.length === 2)
    expect(state.toolResponses[1]!.response).toHaveProperty('error')
    socket.terminate()
  })

  it('does not let a user without access to the board in (404)', async () => {
    const { connector } = fakeConnector()
    const { app, board } = await setup({ connector })
    const other = await signUp(app, 'other@example.com', 'Ödön')
    const res = await app.inject({
      url: `/api/v1/voice/live?boardId=${board.id}`,
      headers: { cookie: other.cookie, origin: ORIGIN },
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects anonymous, API key and foreign-origin connections', async () => {
    const { connector } = fakeConnector()
    const { app, owner, board } = await setup({ connector })
    const url = `/api/v1/voice/live?boardId=${board.id}`
    expect((await app.inject({ url, headers: { origin: ORIGIN } })).statusCode).toBe(401)
    const created = await owner.api.post('/api-keys', { name: 'k', scopes: ['boards:write'] })
    const key = created.body.key as string
    const viaKey = await app.inject({ url, headers: { authorization: `Bearer ${key}` } })
    expect(viaKey.statusCode).toBe(403)
    expect(viaKey.json().error.code).toBe('session_required')
    const evil = await app.inject({
      url,
      headers: { cookie: owner.cookie, origin: 'https://evil.example.com' },
    })
    expect(evil.statusCode).toBe(403)
    expect(evil.json().error.code).toBe('invalid_origin')
  })

  it('is unavailable without a Gemini API key', async () => {
    const { app, owner, board } = await setup({ connector: null })
    const res = await app.inject({
      url: `/api/v1/voice/live?boardId=${board.id}`,
      headers: { cookie: owner.cookie, origin: ORIGIN },
    })
    expect(res.statusCode).toBe(503)
    expect(res.json().error.code).toBe('voice_unavailable')
  })

  it('limits concurrent sessions per user', async () => {
    const { connector } = fakeConnector()
    const { app, owner, board } = await setup({
      connector,
      env: { VOICE_MAX_SESSIONS_PER_USER: '1' },
    })
    const { socket: first, got } = await connect(app, owner.cookie, board.id)
    await got.until(() => got.messages.some((m) => m.type === 'ready'))
    const res = await app.inject({
      url: `/api/v1/voice/live?boardId=${board.id}`,
      headers: { cookie: owner.cookie, origin: ORIGIN },
    })
    expect(res.statusCode).toBe(429)
    first.terminate()
    await new Promise((r) => setTimeout(r, 50))
    await expect(connect(app, owner.cookie, board.id)).resolves.toBeDefined()
  })
  it('works from the workspace page: tools default to the viewed workspace', async () => {
    const { connector, state } = fakeConnector()
    const { app, owner } = await setup({ connector })
    const wsId = (await owner.api.get('/workspaces')).body.data[0].id as string
    const { socket, got } = await connect(app, owner.cookie, `workspace:${wsId}`)
    await got.until(() => got.messages.some((m) => m.type === 'ready'))
    expect(state.params!.systemInstruction).toContain(wsId)

    state.events!.onToolCalls([{ id: 'w1', name: 'create_board', args: { title: 'Új tábla' } }])
    await got.until(() => state.toolResponses.length === 1)
    expect(state.toolResponses[0]!.response).toHaveProperty('output')
    const boards = (await owner.api.get(`/workspaces/${wsId}/boards`)).body.data
    expect(boards.map((b: { title: string }) => b.title)).toContain('Új tábla')
    socket.terminate()
  })

  it('does not let a non-member open a voice session for a workspace (404)', async () => {
    const { connector } = fakeConnector()
    const { app, owner } = await setup({ connector })
    const wsId = (await owner.api.get('/workspaces')).body.data[0].id as string
    const other = await signUp(app, 'other2@example.com', 'Ödön')
    const res = await app.inject({
      url: `/api/v1/voice/live?workspaceId=${wsId}`,
      headers: { cookie: other.cookie, origin: ORIGIN },
    })
    expect(res.statusCode).toBe(404)
  })
})
