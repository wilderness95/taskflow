import type { FastifyInstance } from 'fastify'

/** Titkot hordozó pino-útvonalak: sosem kerülhetnek a naplóba (fejlécek, és a hibákba kerülő törzsmezők). */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.confirmPassword',
  '*.newPassword',
  '*.token',
  '*.secret',
  '*.apiKey',
]

/**
 * Egységes naplómezők: a `reqId` mellett a szereplő (`actorId`, `actorType`) minden, a kéréshez
 * tartozó sorba bekerül; a válasz visszaadja a `x-request-id` fejlécet (a felhasználói hiba így a
 * naplóban megkereshető); a lassú kérés (`slowRequestMs`) `warn` szintre kerül, `route`-tal.
 */
export function registerRequestLogging(app: FastifyInstance, slowRequestMs: number): void {
  // A hitelesítés `preValidation`-ben fut, ezért a szereplő itt már ismert.
  app.addHook('preHandler', async (req, reply) => {
    if (!req.actor) return
    req.log = req.log.child({ actorId: req.actor.id, actorType: req.actor.type })
    // A „request completed” sor a `reply.log`-gal készül, ami külön hivatkozás.
    reply.log = req.log
  })

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-request-id', req.id)
    return payload
  })

  app.addHook('onResponse', async (req, reply) => {
    const ms = Math.round(reply.elapsedTime)
    if (slowRequestMs > 0 && ms >= slowRequestMs) {
      req.log.warn(
        { route: req.routeOptions.url, method: req.method, statusCode: reply.statusCode, ms },
        'slow request',
      )
    }
  })
}
