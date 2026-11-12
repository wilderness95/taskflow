import { createHmac } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import {
  matchesWebhookEvent,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_MAX_FAILURES,
  WEBHOOK_SIGNATURE_HEADER,
  type BoardEvent,
  type WebhookPayload,
} from '@taskflow/shared'
import type { EventBus } from '../../events/eventBus.js'
import { isBlockedHostname, isPrivateAddress } from '../../lib/privateAddress.js'
import type { SecretBox } from '../../lib/secretBox.js'
import type { WebhooksRepository, WebhookRow } from './webhooks.repository.js'

export interface DispatcherDeps {
  repo: WebhooksRepository
  secrets: SecretBox
  bus: EventBus
  logger?: { warn: (obj: object, msg: string) => void }
  allowPrivateTargets: boolean
  /** Várakozás az egyes próbálkozások előtt (ms); a hossza a próbálkozások száma. */
  retryDelaysMs?: number[]
  timeoutMs?: number
}

/** Az aláírás: `t=<unix mp>,v1=<hex>`, ahol `v1 = HMAC_SHA256(secret, "<t>.<törzs>")`. */
export const sign = (secret: string, timestamp: number, body: string): string =>
  `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`

/**
 * Webhook-kézbesítő: a tábla eseményeire (a busz minden eseményére) feliratkozik, és a
 * megfelelő webhookoknak aláírt POST-ot küld. Hibánál újrapróbál (azonos `deliveryId`-val); sok
 * egymás utáni hiba után a webhook kikapcsol. A kézbesítés hibája sosem érinti a kiváltó kérést.
 */
export function createWebhookDispatcher(deps: DispatcherDeps) {
  const delays = deps.retryDelaysMs ?? [0, 2_000, 10_000]
  const timeoutMs = deps.timeoutMs ?? 5_000
  const pending = new Set<Promise<void>>()

  /** Egyetlen HTTP POST; a névfeloldott cím is ellenőrzött (DNS-visszaélés/SSRF ellen). Státuszt ad vissza. */
  function post(url: string, body: string, headers: Record<string, string>): Promise<number> {
    const target = new URL(url)
    if (!deps.allowPrivateTargets && isBlockedHostname(target.hostname)) {
      return Promise.reject(new Error('blocked target'))
    }
    const client = target.protocol === 'https:' ? https : http
    return new Promise((resolve, reject) => {
      const req = client.request(
        target,
        {
          method: 'POST',
          headers: { ...headers, 'content-length': Buffer.byteLength(body) },
          timeout: timeoutMs,
          lookup: (hostname, options, callback) => {
            dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
              if (err) return callback(err, '', 4)
              if (!deps.allowPrivateTargets && addresses.some((a) => isPrivateAddress(a.address))) {
                return callback(new Error('blocked target'), '', 4)
              }
              // Node a `lookup` visszatérési alakját az `all` opció szerint várja.
              if ((options as { all?: boolean }).all) {
                return (callback as unknown as (e: null, a: typeof addresses) => void)(
                  null,
                  addresses,
                )
              }
              callback(null, addresses[0]!.address, addresses[0]!.family)
            })
          },
        },
        (res) => {
          res.resume() // a választ nem olvassuk
          resolve(res.statusCode ?? 0)
        },
      )
      req.on('timeout', () => req.destroy(new Error('timeout')))
      req.on('error', reject)
      req.end(body)
    })
  }

  async function deliver(row: WebhookRow, payload: WebhookPayload): Promise<void> {
    const body = JSON.stringify(payload)
    const secret = deps.secrets.decrypt(row.secretEnc)
    let status = 0
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay))
      try {
        status = await post(row.url, body, {
          'content-type': 'application/json',
          'user-agent': 'TaskFlow-Webhook/1',
          [WEBHOOK_EVENT_HEADER]: payload.event,
          [WEBHOOK_DELIVERY_HEADER]: payload.deliveryId,
          [WEBHOOK_SIGNATURE_HEADER]: sign(secret, Math.floor(Date.now() / 1000), body),
        })
      } catch (err) {
        status = 0
        deps.logger?.warn({ err, webhookId: row.id }, 'webhook delivery attempt failed')
      }
      if (status >= 200 && status < 300) break
    }
    const ok = status >= 200 && status < 300
    // A közben törölt webhook frissítése nem hiba.
    const fresh = deps.repo.findById(row.id)
    if (!fresh) return
    const failures = ok ? 0 : fresh.failureCount + 1
    deps.repo.update(row.id, {
      lastStatus: status,
      lastDeliveryAt: new Date(),
      failureCount: failures,
      ...(failures >= WEBHOOK_MAX_FAILURES && { active: false }),
    })
  }

  const unsubscribe = deps.bus.subscribeAll((event: BoardEvent) => {
    const targets = deps.repo
      .listForBoard(event.boardId)
      .filter(
        (w) => w.active && matchesWebhookEvent(JSON.parse(w.events) as string[], event.action),
      )
    for (const row of targets) {
      const payload: WebhookPayload = {
        deliveryId: `${event.id}-${row.id}`,
        event: event.action,
        boardId: event.boardId,
        entityType: event.entityType,
        entityId: event.entityId,
        cardId: event.cardId,
        actorType: event.actorType,
        actorId: event.actorId,
        occurredAt: event.createdAt,
      }
      const job = deliver(row, payload)
        .catch((err) => deps.logger?.warn({ err, webhookId: row.id }, 'webhook delivery failed'))
        .finally(() => pending.delete(job))
      pending.add(job)
    }
  })

  return {
    stop: () => unsubscribe(),
    /** Megvárja a folyamatban lévő kézbesítéseket (leállításkor és tesztben). */
    idle: async () => {
      while (pending.size > 0) await Promise.all([...pending])
    },
  }
}
export type WebhookDispatcher = ReturnType<typeof createWebhookDispatcher>
