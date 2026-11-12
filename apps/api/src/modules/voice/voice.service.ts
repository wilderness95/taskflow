import {
  voiceClientMessageSchema,
  type VoiceServerMessage,
  type VoiceState,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { AppError } from '../../errors.js'
import type { AccessService } from '../access/access.service.js'
import type { LiveConnector, LiveSession, ToolCall } from './liveConnector.js'
import { buildSystemInstruction } from './systemInstruction.js'
import type { ToolHost } from './toolHost.js'

/** A kliens oldali kapcsolat (WebSocket) elvonása, hogy a munkamenet-logika tesztelhető legyen. */
export interface VoiceIo {
  sendAudio(pcm: Buffer): void
  sendMessage(message: VoiceServerMessage): void
  close(): void
}

/** A kapcsolat adatai, amivel az eszközök a felhasználó nevében hívják az API-t. */
export interface VoiceConnectionContext {
  cookie: string
  clientIp: string
}

export interface VoiceSession {
  /** A böngésző mikrofonjának nyers PCM-je. */
  audio(pcm: Buffer): void
  /** A böngésző szöveges kerete (nyers JSON szöveg); érvénytelen keret figyelmen kívül marad. */
  message(raw: string): void
  close(): void
}

export interface VoiceServiceDeps {
  access: AccessService
  /** `null`: nincs Gemini API kulcs, a hangvégpont nem elérhető. */
  connector: LiveConnector | null
  createToolHost: (opts: VoiceConnectionContext & { boardId: string }) => Promise<ToolHost>
  maxSessionsPerUser: number
  maxMinutes: number
  now?: () => Date
  logger?: { warn: (obj: object, msg: string) => void }
}

export function createVoiceService(deps: VoiceServiceDeps) {
  const open = new Map<string, number>()

  /** Csatlakozás előtti ellenőrzés (az upgrade előtt hívva, így normál HTTP-hibaként megy ki). */
  function check(actor: Actor, boardId: string) {
    if (actor.type !== 'user') {
      throw new AppError(
        403,
        'session_required',
        'The voice assistant requires a signed-in session',
      )
    }
    if (!deps.connector) {
      throw new AppError(503, 'voice_unavailable', 'The voice assistant is not configured')
    }
    const { board } = deps.access.requireBoard(actor, boardId, 'board:read')
    if ((open.get(actor.id) ?? 0) >= deps.maxSessionsPerUser) {
      throw new AppError(429, 'too_many_sessions', 'Too many open voice sessions')
    }
    return board
  }

  async function start(
    actor: Actor,
    boardId: string,
    io: VoiceIo,
    ctx: VoiceConnectionContext,
  ): Promise<VoiceSession> {
    const board = check(actor, boardId)
    open.set(actor.id, (open.get(actor.id) ?? 0) + 1)

    let closed = false
    let live: LiveSession | undefined
    let host: ToolHost | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let state: VoiceState | null = null

    const setState = (next: VoiceState) => {
      if (state === next) return
      state = next
      io.sendMessage({ type: 'state', state: next })
    }
    const close = () => {
      if (closed) return
      closed = true
      clearTimeout(timer)
      const left = (open.get(actor.id) ?? 1) - 1
      if (left <= 0) open.delete(actor.id)
      else open.set(actor.id, left)
      try {
        live?.close()
      } catch {
        // már lezárt
      }
      void host?.close().catch(() => undefined)
      io.close()
    }
    const fail = (code: string, err?: unknown) => {
      if (err) deps.logger?.warn({ err, code }, 'voice session error')
      if (!closed) io.sendMessage({ type: 'error', code })
      close()
    }

    const handleToolCalls = async (calls: ToolCall[]) => {
      setState('thinking')
      const responses = await Promise.all(
        calls.map(async (c) => {
          let result: { ok: boolean; text: string }
          try {
            result = await host!.call(c.name, c.args)
          } catch (err) {
            result = { ok: false, text: err instanceof Error ? err.message : String(err) }
          }
          if (!closed) io.sendMessage({ type: 'tool', name: c.name, ok: result.ok })
          return {
            id: c.id,
            name: c.name,
            response: result.ok ? { output: result.text } : { error: result.text },
          }
        }),
      )
      if (!closed) live?.sendToolResponses(responses)
    }

    try {
      host = await deps.createToolHost({ ...ctx, boardId: board.id })
      const instruction = buildSystemInstruction({
        now: (deps.now ?? (() => new Date()))(),
        boardId: board.id,
        boardTitle: board.title,
      })
      live = await deps.connector!.connect(
        { systemInstruction: instruction, tools: host.tools },
        {
          onAudio: (b64) => {
            if (closed) return
            setState('speaking')
            io.sendAudio(Buffer.from(b64, 'base64'))
          },
          onInterrupted: () => {
            if (closed) return
            io.sendMessage({ type: 'interrupted' })
            setState('listening')
          },
          onTurnComplete: () => !closed && setState('listening'),
          onToolCalls: (calls) => void handleToolCalls(calls),
          onTranscript: (role, text) => {
            if (closed) return
            io.sendMessage({ type: 'transcript', role, text })
            if (role === 'user') setState('thinking')
          },
          onError: (err) => fail('upstream_error', err),
          onClose: () => close(),
        },
      )
    } catch (err) {
      fail('upstream_error', err)
      throw err instanceof AppError
        ? err
        : new AppError(502, 'upstream_error', 'Voice upstream failed')
    }
    if (closed) {
      // A kapcsolat az összekötés közben bomlott meg.
      live.close()
      return { audio() {}, message() {}, close }
    }

    timer = setTimeout(() => fail('session_expired'), deps.maxMinutes * 60_000)
    timer.unref()
    io.sendMessage({ type: 'ready' })
    setState('listening')

    return {
      audio: (pcm) => {
        if (!closed) live!.sendAudio(pcm)
      },
      message: (raw) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          return
        }
        const msg = voiceClientMessageSchema.safeParse(parsed)
        if (msg.success && !closed) live!.sendAudioEnd()
      },
      close,
    }
  }

  return { check, start, openSessions: (userId: string) => open.get(userId) ?? 0 }
}
export type VoiceService = ReturnType<typeof createVoiceService>
