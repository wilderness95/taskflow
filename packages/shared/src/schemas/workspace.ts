import { z } from 'zod'
import { INVITABLE_ROLES, WORKSPACE_ROLES } from '../roles'
import { idSchema } from './common'
import { emailSchema } from './auth'

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES)
export const invitableRoleSchema = z.enum(INVITABLE_ROLES)

const workspaceNameSchema = z.string().trim().min(1).max(100)

export const workspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  /** A bejelentkezett felhasználó szerepköre a munkaterületen. */
  role: workspaceRoleSchema,
  createdAt: z.string(),
})
export type WorkspaceDto = z.infer<typeof workspaceSchema>

export const workspaceListSchema = z.object({ data: z.array(workspaceSchema) })

export const createWorkspaceSchema = z.object({ name: workspaceNameSchema })
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export const updateWorkspaceSchema = z.object({ name: workspaceNameSchema })
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>

export const memberSchema = z.object({
  userId: idSchema,
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: workspaceRoleSchema,
  joinedAt: z.string(),
})
export type MemberDto = z.infer<typeof memberSchema>
export const memberListSchema = z.object({ data: z.array(memberSchema) })

export const updateMemberSchema = z.object({ role: workspaceRoleSchema })
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

export const memberParamsSchema = z.object({ id: idSchema, userId: idSchema })
export const invitationParamsSchema = z.object({ id: idSchema, invitationId: idSchema })

export const workspaceInvitationSchema = z.object({
  id: idSchema,
  email: z.string(),
  role: invitableRoleSchema,
  expiresAt: z.string(),
  createdAt: z.string(),
})
export type WorkspaceInvitationDto = z.infer<typeof workspaceInvitationSchema>
export const workspaceInvitationListSchema = z.object({ data: z.array(workspaceInvitationSchema) })

export const createWorkspaceInvitationSchema = z.object({
  email: emailSchema,
  role: invitableRoleSchema.default('member'),
})
export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationSchema>
export type CreateWorkspaceInvitationRequest = z.input<typeof createWorkspaceInvitationSchema>

export const acceptInvitationSchema = z.object({ token: z.string().min(1).max(200) })
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
