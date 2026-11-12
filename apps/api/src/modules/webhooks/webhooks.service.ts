import { randomBytes } from 'node:crypto'
import {
  MAX_WEBHOOKS_PER_BOARD,
  type CreatedWebhookDto,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type WebhookDto,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { AppError, notFound } from '../../errors.js'
import { isBlockedHostname } from '../../lib/privateAddress.js'
import type { SecretBox } from '../../lib/secretBox.js'
import type { AccessService } from '../access/access.service.js'
import type { ActivityService } from '../activity/activity.service.js'
import type { WebhooksRepository, WebhookRow } from './webhooks.repository.js'

export const toWebhookDto = (r: WebhookRow): WebhookDto => ({
  id: r.id,
  boardId: r.boardId,
  url: r.url,
  events: JSON.parse(r.events) as string[],
  active: r.active,
  failureCount: r.failureCount,
  lastDeliveryAt: r.lastDeliveryAt?.toISOString() ?? null,
  lastStatus: r.lastStatus,
  createdAt: r.createdAt.toISOString(),
})

export interface WebhooksServiceDeps {
  repo: WebhooksRepository
  access: AccessService
  activity: ActivityService
  secrets: SecretBox
  /** Fejlesztés/teszt: a privát hálózati célok engedélyezése. */
  allowPrivateTargets: boolean
}

/**
 * Webhookok kezelése: a tábla admin (`board:update`) joga; csak session-nel érhető el, mert a
 * kulccsal (AI agenttel) nem szabad kimenő hívásokat konfigurálni.
 */
export function createWebhooksService(deps: WebhooksServiceDeps) {
  const { repo, access, activity } = deps

  const checkUrl = (url: string) => {
    if (!deps.allowPrivateTargets && isBlockedHostname(new URL(url).hostname)) {
      throw new AppError(422, 'webhook_url_blocked', 'The webhook URL must be a public address')
    }
  }

  const loadForAdmin = (actor: Actor, id: string): WebhookRow => {
    const row = repo.findById(id)
    if (!row) throw notFound('Webhook')
    access.requireBoard(actor, row.boardId, 'board:update')
    return row
  }

  return {
    list(actor: Actor, boardId: string): WebhookDto[] {
      access.requireBoard(actor, boardId, 'board:update')
      return repo.listForBoard(boardId).map(toWebhookDto)
    },

    create(actor: Actor, boardId: string, input: CreateWebhookInput): CreatedWebhookDto {
      access.requireBoard(actor, boardId, 'board:update')
      checkUrl(input.url)
      if (repo.listForBoard(boardId).length >= MAX_WEBHOOKS_PER_BOARD) {
        throw new AppError(422, 'too_many_webhooks', 'Too many webhooks on this board', {
          limit: MAX_WEBHOOKS_PER_BOARD,
        })
      }
      const secret = `whsec_${randomBytes(24).toString('base64url')}`
      const row = repo.insert({
        id: newId(),
        boardId,
        url: input.url,
        secretEnc: deps.secrets.encrypt(secret),
        events: JSON.stringify(input.events),
        createdBy: actor.id,
      })
      activity.record(actor, {
        boardId,
        action: 'webhook.created',
        entityType: 'webhook',
        entityId: row.id,
        meta: { url: row.url },
      })
      return { ...toWebhookDto(row), secret }
    },

    update(actor: Actor, id: string, input: UpdateWebhookInput): WebhookDto {
      const row = loadForAdmin(actor, id)
      if (input.url !== undefined) checkUrl(input.url)
      const updated = repo.update(id, {
        ...(input.url !== undefined && { url: input.url }),
        ...(input.events !== undefined && { events: JSON.stringify(input.events) }),
        ...(input.active !== undefined && {
          active: input.active,
          // Újra bekapcsolva tiszta lappal indul.
          ...(input.active && { failureCount: 0 }),
        }),
      })!
      activity.record(actor, {
        boardId: row.boardId,
        action: 'webhook.updated',
        entityType: 'webhook',
        entityId: id,
      })
      return toWebhookDto(updated)
    },

    remove(actor: Actor, id: string): void {
      const row = loadForAdmin(actor, id)
      repo.delete(id)
      activity.record(actor, {
        boardId: row.boardId,
        action: 'webhook.deleted',
        entityType: 'webhook',
        entityId: id,
      })
    },
  }
}
export type WebhooksService = ReturnType<typeof createWebhooksService>
