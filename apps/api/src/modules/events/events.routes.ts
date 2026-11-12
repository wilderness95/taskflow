import type { FastifyInstance } from 'fastify'
import {
  BOARD_EVENT_NAME,
  LIST_EVENT_NAME,
  idParamsSchema,
  type BoardEvent,
  type ListEvent,
} from '@taskflow/shared'
import type { ServerResponse } from 'node:http'
import type { FastifyReply, FastifyRequest } from 'fastify'
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

    /** Megnyit egy SSE csatornát; a feliratkozás még a hijack előtt: a jogosultsági hiba normál JSON-hiba. */
    const open = <E extends { id: string }>(
      req: FastifyRequest,
      reply: FastifyReply,
      eventName: string,
      subscribe: (write: (event: E) => void) => () => void,
    ) => {
      const res = reply.raw
      const write = (event: E) =>
        res.write(`id: ${event.id}\nevent: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`)
      const unsubscribe = subscribe(write)

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
    }

    app.get('/api/v1/boards/:id/events', async (req, reply) => {
      const boardId = idParamsSchema.parse(req.params).id
      const actor = requireActor(req)
      open<BoardEvent>(req, reply, BOARD_EVENT_NAME, (write) =>
        service.subscribe(actor, boardId, write),
      )
    })

    app.get('/api/v1/lists/:id/events', async (req, reply) => {
      const listId = idParamsSchema.parse(req.params).id
      const actor = requireActor(req)
      open<ListEvent>(req, reply, LIST_EVENT_NAME, (write) =>
        service.subscribeList(actor, listId, write),
      )
    })
  }
}
