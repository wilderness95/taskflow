import type { FastifyInstance } from 'fastify'
import { BOARD_EVENT_NAME, idParamsSchema, type BoardEvent } from '@taskflow/shared'
import type { ServerResponse } from 'node:http'
import { requireActor } from '../../auth/auth.plugin.js'
import type { EventsService } from './events.service.js'

const HEARTBEAT_MS = 25_000

/** `GET /boards/{id}/events`: Server-Sent Events csatorna egy tábla változásairól. */
export function eventsRoutes(service: EventsService) {
  return async (app: FastifyInstance): Promise<void> => {
    const streams = new Set<{ res: ServerResponse; stop: () => void }>()
    // Leálláskor a nyitott csatornák lezárása nélkül az `app.close()` sosem térne vissza.
    app.addHook('onClose', async () => {
      for (const stream of [...streams]) stream.stop()
    })

    app.get('/api/v1/boards/:id/events', async (req, reply) => {
      const boardId = idParamsSchema.parse(req.params).id
      const res = reply.raw
      const write = (event: BoardEvent) =>
        res.write(`id: ${event.id}\nevent: ${BOARD_EVENT_NAME}\ndata: ${JSON.stringify(event)}\n\n`)
      // A feliratkozás még a hijack előtt: a jogosultsági hiba így normál JSON-hibaként megy ki.
      const unsubscribe = service.subscribe(requireActor(req), boardId, write)

      reply.hijack()
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Proxy (nginx / Cloudflare) ne pufferelje.
        'X-Accel-Buffering': 'no',
      })
      res.write('retry: 3000\n: connected\n\n')

      const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
      const stream = {
        res,
        stop: () => {
          clearInterval(heartbeat)
          unsubscribe()
          streams.delete(stream)
          if (!res.writableEnded) res.end()
        },
      }
      streams.add(stream)
      req.raw.on('close', stream.stop)
    })
  }
}
