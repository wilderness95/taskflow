import { z } from 'zod'
import { idSchema } from './common'

/** Képként (borítóként, előnézetként) kezelhető MIME-típusok; az SVG szándékosan nincs köztük. */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

export const isImageMimeType = (mime: string): boolean =>
  (IMAGE_MIME_TYPES as readonly string[]).includes(mime)

export const attachmentSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  /** Kép-e (borítónak használható, és böngészőben megjeleníthető). */
  isImage: z.boolean(),
  uploadedBy: idSchema,
  createdAt: z.string(),
})
export type AttachmentDto = z.infer<typeof attachmentSchema>
export const attachmentListSchema = z.object({ data: z.array(attachmentSchema) })

/** A feltöltés a fájl nyers tartalma; a fájlnevet a lekérdezés adja, a típust a `Content-Type`. */
export const uploadAttachmentQuerySchema = z.object({
  name: z.string().trim().min(1).max(200),
})
