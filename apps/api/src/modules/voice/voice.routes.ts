import { voiceQuerySchema } from '@taskflow/shared'
import type { FastifyInstance } from 'fastify'
import { clientIp, requireActor } from '../../auth/auth.plugin.js'
import { AppError } from '../../errors.js'
import type { VoiceService } from './voice.service.js'

/** Egy hangkeret legfeljebb ennyi bájt (~2 s 16 kHz-es PCM), a visszaélés ellen. */
export const MAX_FRAME_BYTES = 128 * 1024
const PING_MS = 25_000

/**
 * `WS /api/v1/voice/live?boardId=...`: élő hangasszisztens. Csak session-nel (a `scopes.ts`
 * az API kulcsot kizárja), és az Origin az `APP_URL`-lel kell egyezzen (a WebSocketre a
 * böngésző nem alkalmaz same-origin szabályt, így ez védi a cross-site kapcsolatfelvételtől).
 * A Gemini API kulcs sosem kerül a böngészőhöz: a híd a szerveren fut.
 */
export function voiceRoutes(service: VoiceService, deps: { allowedOrigin: string }) {
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/api/v1/voice/live',
      {
        websocket: true,
        // Az upgrade előtt: a hibák normál JSON-hibaként (HTTP státusszal) mennek ki.
        preValidation: async (req) => {
          const origin = req.headers.origin
          if (!origin || new URL(origin).origin !== deps.allowedOrigin) {
            throw new AppError(403, 'invalid_origin', 'Request origin is not allowed')
          }
          service.check(requireActor(req), voiceQuerySchema.parse(req.query))
        },
      },
      async (socket, req) => {
        const actor = requireActor(req)
        const scope = voiceQuerySchema.parse(req.query)
        // A hívások a felhasználó sessionjével futnak: a cookie-t továbbadjuk.
        const ctx = { cookie: req.headers.cookie ?? '', clientIp: clientIp(req) }

        // Az üzenetek az összekötés alatt is érkezhetnek: sorba állítjuk őket.
        let session: Awaited<ReturnType<VoiceService['start']>> | null = null
        const pending: { data: Buffer; binary: boolean }[] = []
        const dispatch = (data: Buffer, binary: boolean) => {
          if (binary) session!.audio(data)
          else session!.message(data.toString('utf8'))
        }
        socket.on('message', (data: Buffer, binary: boolean) => {
          if (session) dispatch(data, binary)
          else pending.push({ data, binary })
        })

        const ping = setInterval(() => socket.ping(), PING_MS)
        ping.unref()
        const stop = () => {
          clearInterval(ping)
          session?.close()
        }
        socket.on('close', stop)
        socket.on('error', stop)

        try {
          session = await service.start(
            actor,
            scope,
            {
              sendAudio: (pcm) => socket.send(pcm, { binary: true }),
              sendMessage: (m) => socket.send(JSON.stringify(m)),
              close: () => socket.close(),
            },
            ctx,
          )
          for (const p of pending.splice(0)) dispatch(p.data, p.binary)
        } catch (err) {
          app.log.warn(
            { reason: err instanceof Error ? err.message : 'unknown' },
            'voice session failed to start',
          )
          socket.close()
        }
      },
    )
  }
}
