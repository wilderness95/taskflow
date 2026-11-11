import { z } from 'zod'
import { PRIORITIES } from '../priority'
import { TAG_COLORS } from '../tags'

export const idSchema = z.string().min(1).max(64)
export const prioritySchema = z.enum(PRIORITIES)
export const tagColorSchema = z.enum(TAG_COLORS)
export const visibilitySchema = z.enum(['private', 'workspace', 'public'])
/** `YYYY-MM-DD` */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const titleSchema = z.string().trim().min(1).max(200)

export const idParamsSchema = z.object({ id: idSchema })

/** Csak http(s) URL; a `javascript:` és `data:` séma tiltott (avatar, borítókép). */
export const httpUrlSchema = z.url({ protocol: /^https?$/ }).max(2000)
