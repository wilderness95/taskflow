import { randomBytes } from 'node:crypto'
import {
  API_KEY_PREFIX,
  API_KEY_SCOPES,
  type ApiKeyDto,
  type ApiKeyScope,
  type CreateApiKeyInput,
  type CreatedApiKeyDto,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { notFound } from '../../errors.js'
import { sha256 } from '../auth/tokens.js'
import type { AuthRepository } from '../auth/auth.repository.js'
import type { ActivityService } from '../activity/activity.service.js'
import type { ApiKeyRow, ApiKeysRepository } from './apikeys.repository.js'

/** A „utoljára használva” írása legfeljebb ilyen gyakran történik (ne minden kérésnél írjunk). */
const TOUCH_INTERVAL_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

const parseScopes = (json: string): ApiKeyScope[] => {
  try {
    const parsed = JSON.parse(json) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((s): s is ApiKeyScope => API_KEY_SCOPES.includes(s as ApiKeyScope))
      : []
  } catch {
    return []
  }
}

const toDto = (r: ApiKeyRow): ApiKeyDto => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  scopes: parseScopes(r.scopes),
  expiresAt: r.expiresAt?.toISOString() ?? null,
  revokedAt: r.revokedAt?.toISOString() ?? null,
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
})

export function createApiKeysService(deps: {
  repo: ApiKeysRepository
  users: Pick<AuthRepository, 'findUserById'>
  activity: ActivityService
}) {
  const { repo, users, activity } = deps

  return {
    list: (actor: Actor): ApiKeyDto[] => repo.listForUser(actor.id).map(toDto),

    /** A nyers kulcs csak itt, egyszer látszik; tárolni csak a hash-ét tároljuk. */
    create(actor: Actor, input: CreateApiKeyInput): CreatedApiKeyDto {
      const key = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
      const row = repo.insert({
        id: newId(),
        userId: actor.id,
        name: input.name,
        prefix: key.slice(0, API_KEY_PREFIX.length + 4),
        keyHash: sha256(key),
        scopes: JSON.stringify([...new Set(input.scopes)]),
        expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * DAY_MS) : null,
      })
      activity.record(actor, {
        action: 'api_key.created',
        entityType: 'api_key',
        entityId: row.id,
        meta: { name: row.name },
      })
      return { ...toDto(row), key }
    },

    /** Visszavonás: a kulcs azonnal érvénytelen, a sor megmarad (naplózás, „utoljára használva”). */
    revoke(actor: Actor, id: string): void {
      const row = repo.findOwned(id, actor.id)
      if (!row) throw notFound('API key')
      if (row.revokedAt) return
      repo.update(id, { revokedAt: new Date() })
      activity.record(actor, {
        action: 'api_key.revoked',
        entityType: 'api_key',
        entityId: id,
        meta: { name: row.name },
      })
    },

    /** A nyers kulcsból Actor; ismeretlen, visszavont vagy lejárt kulcsra `null`. */
    authenticate(rawKey: string): Actor | null {
      if (!rawKey.startsWith(API_KEY_PREFIX)) return null
      const row = repo.findByHash(sha256(rawKey))
      if (!row || row.revokedAt) return null
      const now = Date.now()
      if (row.expiresAt && row.expiresAt.getTime() <= now) return null
      const owner = users.findUserById(row.userId)
      if (owner === undefined) return null
      if (!row.lastUsedAt || now - row.lastUsedAt.getTime() >= TOUCH_INTERVAL_MS) {
        repo.update(row.id, { lastUsedAt: new Date(now) })
      }
      return {
        type: 'api_key',
        id: row.userId,
        isAdmin: false,
        emailCleared: owner.emailVerifiedAt !== null || owner.isAdmin,
        keyId: row.id,
        scopes: parseScopes(row.scopes),
      }
    },
  }
}
export type ApiKeysService = ReturnType<typeof createApiKeysService>
