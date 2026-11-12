import { createHash } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { AppError } from '../errors.js'
import type { IdempotencyRepository } from '../modules/idempotency/idempotency.repository.js'

/** Az `Idempotency-Key` ennyi ideig őrzi a választ. */
const TTL_MS = 24 * 60 * 60 * 1000
const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

declare module 'fastify' {
  interface FastifyRequest {
    /** A foglalt `Idempotency-Key`; a válasz elmentése után `null`. */
    idempotency: { userId: string; key: string } | null
  }
}

/**
 * `Idempotency-Key` fejléc az író kérésekre: ugyanaz a kulcs és kérés a már elmentett választ kapja
 * vissza (`Idempotent-Replayed: true`), a művelet nem fut le újra; eltérő kéréssel újrahasznált
 * kulcs 422, a még futó kérés kulcsa 409. A kulcs felhasználónként egyedi. A 5xx és 429 válasz
 * nem őrződik meg, azt a kliens ugyanazzal a kulccsal újrapróbálhatja.
 */
export function registerIdempotency(app: FastifyInstance, repo: IdempotencyRepository): void {
  app.decorateRequest('idempotency', null)

  app.addHook('preHandler', async (req, reply) => {
    const header = req.headers['idempotency-key']
    if (!header || !UNSAFE.has(req.method) || !req.actor) return
    const key = Array.isArray(header) ? header[0]! : header
    if (!KEY_PATTERN.test(key)) {
      throw new AppError(
        400,
        'invalid_idempotency_key',
        'Idempotency-Key must be 1-255 printable ASCII characters',
      )
    }
    const userId = req.actor.id
    const fingerprint = createHash('sha256')
      .update(
        `${req.method} ${req.url}\n${
          Buffer.isBuffer(req.body)
            ? createHash('sha256').update(req.body).digest('hex')
            : JSON.stringify(req.body ?? null)
        }`,
      )
      .digest('hex')

    repo.deleteOlderThan(new Date(Date.now() - TTL_MS))
    const existing = repo.find(userId, key)
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new AppError(
          422,
          'idempotency_key_reuse',
          'This Idempotency-Key was already used with a different request',
        )
      }
      if (existing.status === null) {
        throw new AppError(409, 'idempotency_in_progress', 'The original request is still running')
      }
      reply.header('Idempotent-Replayed', 'true')
      if (existing.response) reply.header('content-type', 'application/json; charset=utf-8')
      return reply.status(existing.status).send(existing.response ?? '')
    }
    if (!repo.reserve(userId, key, fingerprint)) {
      throw new AppError(409, 'idempotency_in_progress', 'The original request is still running')
    }
    req.idempotency = { userId, key }
  })

  app.addHook('onSend', async (req, reply, payload) => {
    const reserved = req.idempotency
    if (!reserved) return payload
    req.idempotency = null
    if (reply.statusCode >= 500 || reply.statusCode === 429) {
      repo.release(reserved.userId, reserved.key)
    } else {
      repo.complete(
        reserved.userId,
        reserved.key,
        reply.statusCode,
        typeof payload === 'string' ? payload : '',
      )
    }
    return payload
  })
}
