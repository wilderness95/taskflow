import { z } from 'zod'
import { idSchema } from './common'

/** Egy tábla legfeljebb ennyi webhookot tarthat. */
export const MAX_WEBHOOKS_PER_BOARD = 10
/** Ennyi egymás utáni sikertelen kézbesítés után a webhook automatikusan kikapcsol. */
export const WEBHOOK_MAX_FAILURES = 10

/** A küldött HTTP fejlécek (a kérés törzse `webhookPayloadSchema`). */
export const WEBHOOK_SIGNATURE_HEADER = 'X-TaskFlow-Signature'
export const WEBHOOK_EVENT_HEADER = 'X-TaskFlow-Event'
export const WEBHOOK_DELIVERY_HEADER = 'X-TaskFlow-Delivery'

/** Esemény-minta: `*` (minden), `card.*` (egy entitás összes művelete) vagy pontos név (`card.moved`). */
export const webhookEventPatternSchema = z
  .string()
  .regex(/^(\*|[a-z_]+\.(\*|[a-z_]+))$/, 'invalid_event_pattern')

const webhookUrlSchema = z.url({ protocol: /^https?$/ }).max(2000)

export const webhookSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  url: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  /** Egymás utáni sikertelen kézbesítések száma. */
  failureCount: z.number().int(),
  lastDeliveryAt: z.string().nullable(),
  /** Az utolsó kézbesítés HTTP státusza; `0`: hálózati hiba vagy időtúllépés. */
  lastStatus: z.number().int().nullable(),
  createdAt: z.string(),
})
export type WebhookDto = z.infer<typeof webhookSchema>

/** Létrehozáskor a titok (`secret`) egyszer látszik, az aláíráshoz kell. */
export const createdWebhookSchema = webhookSchema.extend({ secret: z.string() })
export type CreatedWebhookDto = z.infer<typeof createdWebhookSchema>

export const webhookListSchema = z.object({ data: z.array(webhookSchema) })

export const createWebhookSchema = z.object({
  url: webhookUrlSchema,
  events: z.array(webhookEventPatternSchema).min(1).max(20).default(['*']),
})
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>
export type CreateWebhookRequest = z.input<typeof createWebhookSchema>

export const updateWebhookSchema = z
  .object({
    url: webhookUrlSchema,
    events: z.array(webhookEventPatternSchema).min(1).max(20),
    /** Újra bekapcsolva a hibaszámláló nullázódik. */
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update')
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>

/** A webhook kérés törzse (JSON). Az esemény vékony jelzés: a részletekért a hívó az API-t olvassa. */
export const webhookPayloadSchema = z.object({
  /** A kézbesítés azonosítója (újrapróbálkozásnál azonos; a fogadó ezzel deduplikálhat). */
  deliveryId: idSchema,
  /** `entity.verb`, pl. `card.moved`. */
  event: z.string(),
  boardId: idSchema,
  entityType: z.string(),
  entityId: idSchema,
  cardId: idSchema.nullable(),
  actorType: z.string(),
  actorId: idSchema,
  /** Az esemény időpontja (ISO 8601). */
  occurredAt: z.string(),
})
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>
