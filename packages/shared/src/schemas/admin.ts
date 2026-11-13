import { z } from 'zod'
import { emailSchema } from './auth'
import { pageQuerySchema } from './activity'
import { idSchema } from './common'
import { invitableRoleSchema, workspaceRoleSchema } from './workspace'

/** Platform-adminisztráció (csak platform-admin, csak böngészős session): felhasználók, meghívók, audit. */

export const ADMIN_USER_STATUSES = ['all', 'active', 'suspended', 'unverified'] as const
export const ADMIN_INVITATION_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const

export const adminUserSchema = z.object({
  id: idSchema,
  email: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  isAdmin: z.boolean(),
  suspended: z.boolean(),
  suspendedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type AdminUserDto = z.infer<typeof adminUserSchema>

export const adminUserWorkspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  role: workspaceRoleSchema,
})

export const adminUserDetailSchema = adminUserSchema.extend({
  workspaces: z.array(adminUserWorkspaceSchema),
  /** Az érvényes (nem lejárt) munkamenetek száma. */
  sessionCount: z.number().int(),
})
export type AdminUserDetailDto = z.infer<typeof adminUserDetailSchema>

export const adminUsersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ADMIN_USER_STATUSES).default('all'),
})
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>

export const adminUserListSchema = z.object({
  data: z.array(adminUserSchema),
  nextCursor: z.string().nullable(),
})

/**
 * Jelszó-újrabekérés (step-up) az érzékeny adminműveleteknél: a művelet végrehajtójának saját
 * jelszava, hogy egy ellopott admin munkamenet önmagában ne elég a fiók kizárásához vagy a jog átadásához.
 */
export const stepUpSchema = z.object({ password: z.string().min(1).max(128) })
export type StepUpInput = z.infer<typeof stepUpSchema>

export const suspendUserSchema = stepUpSchema
export type SuspendUserInput = z.infer<typeof suspendUserSchema>

export const setAdminRoleSchema = stepUpSchema.extend({ isAdmin: z.boolean() })
export type SetAdminRoleInput = z.infer<typeof setAdminRoleSchema>

export const adminWorkspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  memberCount: z.number().int(),
})
export type AdminWorkspaceDto = z.infer<typeof adminWorkspaceSchema>

export const adminWorkspaceListSchema = z.object({
  data: z.array(adminWorkspaceSchema),
  nextCursor: z.string().nullable(),
})

export const adminInvitationSchema = z.object({
  id: idSchema,
  email: z.string(),
  /** `null`: platform-regisztrációs meghívó (munkaterület nélkül). */
  workspaceId: idSchema.nullable(),
  workspaceName: z.string().nullable(),
  role: invitableRoleSchema.nullable(),
  invitedByName: z.string().nullable(),
  status: z.enum(ADMIN_INVITATION_STATUSES),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
})
export type AdminInvitationDto = z.infer<typeof adminInvitationSchema>

export const adminInvitationsQuerySchema = pageQuerySchema.extend({
  status: z.enum(ADMIN_INVITATION_STATUSES).optional(),
})
export type AdminInvitationsQuery = z.infer<typeof adminInvitationsQuerySchema>

export const adminInvitationListSchema = z.object({
  data: z.array(adminInvitationSchema),
  nextCursor: z.string().nullable(),
})

/** Munkaterület és szerepkör együtt adandó meg (vagy egyik sem: platform-meghívó). */
export const createAdminInvitationSchema = z
  .object({
    email: emailSchema,
    workspaceId: idSchema.optional(),
    role: invitableRoleSchema.optional(),
  })
  .refine((v) => (v.workspaceId === undefined) === (v.role === undefined), {
    message: 'workspaceId and role must be given together',
    path: ['role'],
  })
export type CreateAdminInvitationInput = z.infer<typeof createAdminInvitationSchema>
export type CreateAdminInvitationRequest = z.input<typeof createAdminInvitationSchema>

export const auditEventSchema = z.object({
  id: idSchema,
  actorId: idSchema.nullable(),
  actorName: z.string().nullable(),
  /** `domain.verb`, pl. `admin.user_suspended`; nyelvfüggetlen, a fordítás a frontenden. */
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  targetUserId: idSchema.nullable(),
  targetUserName: z.string().nullable(),
  ip: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
})
export type AuditEventDto = z.infer<typeof auditEventSchema>

export const auditQuerySchema = pageQuerySchema.extend({
  action: z.string().trim().min(1).max(100).optional(),
  actorId: idSchema.optional(),
  targetUserId: idSchema.optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
})
export type AuditQuery = z.infer<typeof auditQuerySchema>

export const auditListSchema = z.object({
  data: z.array(auditEventSchema),
  nextCursor: z.string().nullable(),
})

export const adminOverviewSchema = z.object({
  users: z.object({
    total: z.number().int(),
    admins: z.number().int(),
    suspended: z.number().int(),
    unverified: z.number().int(),
  }),
  pendingInvitations: z.number().int(),
  health: z.object({
    database: z.enum(['ok', 'error']),
    mailTransport: z.enum(['console', 'smtp']),
  }),
  recentEvents: z.array(auditEventSchema),
})
export type AdminOverviewDto = z.infer<typeof adminOverviewSchema>

/** Az auditnaplóba kerülő események (nyelvfüggetlen kulcsok; a fordítás a frontenden). */
export const AUDIT_ACTIONS = [
  'auth.registered',
  'auth.login_succeeded',
  'auth.login_failed',
  'auth.login_blocked',
  'auth.password_reset',
  'admin.step_up_failed',
  'admin.user_suspended',
  'admin.user_restored',
  'admin.user_sessions_revoked',
  'admin.user_admin_granted',
  'admin.user_admin_revoked',
  'admin.user_verification_resent',
  'admin.invitation_created',
  'admin.invitation_resent',
  'admin.invitation_revoked',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
