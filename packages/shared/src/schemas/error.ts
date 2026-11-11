import { z } from 'zod'

/** Egységes hibaformátum; a `code` géppel olvasható, a fordítás a frontenden történik. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullable(),
  }),
})
export type ErrorResponse = z.infer<typeof errorResponseSchema>
