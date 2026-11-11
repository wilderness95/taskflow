import { z } from 'zod'
import { httpUrlSchema, idSchema } from './common'

export const LOCALES = ['hu'] as const

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))
export const passwordSchema = z.string().min(10).max(128)
const nameSchema = z.string().trim().min(1).max(100)

export const userSchema = z.object({
  id: idSchema,
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  locale: z.enum(LOCALES),
  emailVerified: z.boolean(),
  isAdmin: z.boolean(),
})
export type UserDto = z.infer<typeof userSchema>

export const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  /** Zárt rendszerben (az első felhasználó után) kötelező. */
  inviteToken: z.string().min(1).max(200).optional(),
})
export type RegisterInput = z.infer<typeof registerSchema>
export type RegisterRequest = z.input<typeof registerSchema>

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
})
export type LoginInput = z.infer<typeof loginSchema>
export type LoginRequest = z.input<typeof loginSchema>

export const forgotPasswordSchema = z.object({ email: emailSchema })
export type ForgotPasswordRequest = z.input<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: passwordSchema,
})
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const verifyEmailSchema = z.object({ token: z.string().min(1).max(200) })
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

export const updateProfileSchema = z
  .object({
    name: nameSchema,
    avatarUrl: httpUrlSchema.nullable(),
    locale: z.enum(LOCALES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update')
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const createInvitationSchema = z.object({ email: emailSchema })
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
export type CreateInvitationRequest = z.input<typeof createInvitationSchema>

export const invitationSchema = z.object({
  id: idSchema,
  email: z.string(),
  expiresAt: z.string(),
})
export type InvitationDto = z.infer<typeof invitationSchema>
