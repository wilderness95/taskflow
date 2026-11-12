import { z } from 'zod'
import { API_KEY_SCOPES } from '../apiKeys'
import { idSchema } from './common'

export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES)

export const apiKeySchema = z.object({
  id: idSchema,
  name: z.string(),
  /** A kulcs eleje (azonosításra); a teljes érték csak létrehozáskor látszik. */
  prefix: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type ApiKeyDto = z.infer<typeof apiKeySchema>
export const apiKeyListSchema = z.object({ data: z.array(apiKeySchema) })

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(apiKeyScopeSchema).min(1),
  /** Hány nap múlva jár le; hiányában nem jár le. */
  expiresInDays: z.number().int().min(1).max(3650).nullish(),
})
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>

/** A létrehozás válasza: a `key` titok, csak ekkor olvasható. */
export const createdApiKeySchema = apiKeySchema.extend({ key: z.string() })
export type CreatedApiKeyDto = z.infer<typeof createdApiKeySchema>
