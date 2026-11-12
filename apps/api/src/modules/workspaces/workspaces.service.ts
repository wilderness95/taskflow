import {
  can,
  canManageMember,
  type CreateWorkspaceInput,
  type CreateWorkspaceInvitationInput,
  type MemberDto,
  type UpdateMemberInput,
  type UpdateWorkspaceInput,
  type WorkspaceAction,
  type WorkspaceDto,
  type WorkspaceInvitationDto,
  type WorkspaceRole,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import type { Config } from '../../config.js'
import { newId } from '../../db/ids.js'
import { AppError, notFound } from '../../errors.js'
import type { Mailer } from '../../mail/mailer.js'
import { createMailSender } from '../../mail/sendMail.js'
import type { FileStore } from '../../files/fileStore.js'
import type { ActivityService } from '../activity/activity.service.js'
import { randomToken, sha256 } from '../auth/tokens.js'
import type { InvitationRow, WorkspaceRow, WorkspacesRepository } from './workspaces.repository.js'

const DAY = 24 * 60 * 60 * 1000
const INVITE_TTL = 7 * DAY

const toWorkspaceDto = (w: WorkspaceRow, role: WorkspaceRole): WorkspaceDto => ({
  id: w.id,
  name: w.name,
  slug: w.slug,
  role,
  createdAt: w.createdAt.toISOString(),
})

const toInvitationDto = (i: InvitationRow): WorkspaceInvitationDto => ({
  id: i.id,
  email: i.email,
  role: i.role ?? 'member',
  expiresAt: i.expiresAt.toISOString(),
  createdAt: i.createdAt.toISOString(),
})

export function createWorkspacesService(deps: {
  repo: WorkspacesRepository
  mailer: Mailer
  config: Config
  activity: ActivityService
  /** A törölt munkaterület csatolmány-fájljainak eltávolítására. */
  files?: FileStore
  logger: { error: (obj: unknown, msg: string) => void }
}) {
  const { repo, config, activity } = deps
  const log = (
    actor: Actor,
    workspaceId: string | null,
    action: string,
    entityId: string,
    meta: Record<string, unknown> = {},
  ) => activity.record(actor, { workspaceId, action, entityType: 'workspace', entityId, meta })
  const sendMail = createMailSender(deps.mailer, deps.logger)

  /** A nem tag számára a munkaterület nem létezik (404), így a létezése sem derül ki. */
  const membership = (actor: Actor, workspaceId: string) => {
    const workspace = repo.findById(workspaceId)
    const role = workspace ? repo.getRole(workspaceId, actor.id) : null
    if (!workspace || !role) throw notFound('Workspace')
    return { workspace, role }
  }

  const authorize = (actor: Actor, workspaceId: string, action: WorkspaceAction) => {
    const result = membership(actor, workspaceId)
    if (!can(actor, action, { type: 'workspace', role: result.role })) {
      throw new AppError(403, 'forbidden', 'You are not allowed to do this')
    }
    return result
  }

  const assertNotLastOwner = (workspaceId: string, targetRole: WorkspaceRole) => {
    if (targetRole === 'owner' && repo.countOwners(workspaceId) <= 1) {
      throw new AppError(409, 'last_owner', 'A workspace needs at least one owner')
    }
  }

  return {
    list: (actor: Actor): WorkspaceDto[] =>
      repo.listForUser(actor.id).map((w) => toWorkspaceDto(w, w.role)),

    create(actor: Actor, input: CreateWorkspaceInput): WorkspaceDto {
      const workspace = repo.create(input.name, actor.id)
      log(actor, workspace.id, 'workspace.created', workspace.id, { name: workspace.name })
      return toWorkspaceDto(workspace, 'owner')
    },

    get(actor: Actor, id: string): WorkspaceDto {
      const { workspace, role } = authorize(actor, id, 'workspace:read')
      return toWorkspaceDto(workspace, role)
    },

    update(actor: Actor, id: string, input: UpdateWorkspaceInput): WorkspaceDto {
      const { role } = authorize(actor, id, 'workspace:update')
      const updated = repo.updateName(id, input.name)!
      log(actor, id, 'workspace.updated', id, { name: updated.name })
      return toWorkspaceDto(updated, role)
    },

    remove(actor: Actor, id: string): void {
      authorize(actor, id, 'workspace:delete')
      if (repo.countBoards(id) > 0) {
        throw new AppError(409, 'workspace_not_empty', 'Archive or move the active boards first')
      }
      const { workspace } = membership(actor, id)
      // Az archivált táblák a munkaterülettel együtt véglegesen törlődnek.
      const storageKeys = repo.transaction(() => {
        const keys = repo.purgeBoards(id)
        repo.delete(id)
        return keys
      })
      for (const key of storageKeys) void deps.files?.delete(key).catch(() => undefined)
      // A napló a munkaterülethez kötött sorokat törli, ezért ez már nem hivatkozik rá.
      log(actor, null, 'workspace.deleted', id, { name: workspace.name })
    },

    listMembers(actor: Actor, id: string): MemberDto[] {
      authorize(actor, id, 'workspace:read')
      return repo.listMembers(id).map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))
    },

    updateMember(actor: Actor, id: string, userId: string, input: UpdateMemberInput): MemberDto {
      const { role: actorRole } = authorize(actor, id, 'workspace:manage_members')
      const targetRole = repo.getRole(id, userId)
      if (!targetRole) throw notFound('Member')
      if (!canManageMember(actorRole, targetRole, input.role)) {
        throw new AppError(403, 'forbidden', 'You are not allowed to do this')
      }
      if (input.role !== 'owner') assertNotLastOwner(id, targetRole)
      repo.setRole(id, userId, input.role)
      log(actor, id, 'workspace_member.role_changed', id, { userId, role: input.role })
      return repo
        .listMembers(id)
        .map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))
        .find((m) => m.userId === userId)!
    },

    /** Más tagot a kezelői jog alapján lehet eltávolítani; saját magát bárki elhagyhatja. */
    removeMember(actor: Actor, id: string, userId: string): void {
      const { role: actorRole } = membership(actor, id)
      const targetRole = repo.getRole(id, userId)
      if (!targetRole) throw notFound('Member')

      if (userId !== actor.id) {
        const allowed =
          can(actor, 'workspace:manage_members', { type: 'workspace', role: actorRole }) &&
          canManageMember(actorRole, targetRole, null)
        if (!allowed) throw new AppError(403, 'forbidden', 'You are not allowed to do this')
      }
      assertNotLastOwner(id, targetRole)
      repo.transaction(() => repo.removeMember(id, userId))
      log(actor, id, 'workspace_member.removed', id, { userId })
    },

    listInvitations(actor: Actor, id: string): WorkspaceInvitationDto[] {
      authorize(actor, id, 'workspace:manage_members')
      return repo.listPendingInvitations(id, new Date()).map(toInvitationDto)
    },

    invite(
      actor: Actor,
      id: string,
      input: CreateWorkspaceInvitationInput,
    ): WorkspaceInvitationDto {
      const { workspace, role: actorRole } = authorize(actor, id, 'workspace:manage_members')
      if (!canManageMember(actorRole, 'member', input.role)) {
        throw new AppError(403, 'forbidden', 'You are not allowed to do this')
      }
      if (repo.isMemberByEmail(id, input.email)) {
        throw new AppError(409, 'already_member', 'This person is already a member')
      }
      const inviter = repo.findUser(actor.id)!
      const token = randomToken()
      const now = new Date()
      const invitation = repo.transaction(() => {
        repo.expirePendingInvitations(id, input.email, now)
        return repo.insertInvitation({
          id: newId(),
          email: input.email,
          workspaceId: id,
          role: input.role,
          tokenHash: sha256(token),
          invitedBy: actor.id,
          expiresAt: new Date(now.getTime() + INVITE_TTL),
        })
      })
      const base = config.APP_URL.replace(/\/$/, '')
      sendMail({ email: input.email, locale: inviter.locale }, 'workspaceInvitation', {
        inviter: inviter.name,
        workspace: workspace.name,
        role: input.role,
        link: `${base}/invitations/accept?token=${encodeURIComponent(token)}&email=${encodeURIComponent(input.email)}`,
        days: INVITE_TTL / DAY,
      })
      log(actor, id, 'workspace_invitation.created', id, { role: input.role })
      return toInvitationDto(invitation)
    },

    revokeInvitation(actor: Actor, id: string, invitationId: string): void {
      authorize(actor, id, 'workspace:manage_members')
      const invitation = repo.findInvitation(invitationId)
      if (!invitation || invitation.workspaceId !== id) throw notFound('Invitation')
      repo.expireInvitation(invitationId, new Date())
      log(actor, id, 'workspace_invitation.revoked', id)
    },

    /** A meghívott (bejelentkezve, a meghívóval egyező e-mail-címmel) csatlakozik a munkaterülethez. */
    acceptInvitation(actor: Actor, token: string): WorkspaceDto {
      const invitation = repo.findInvitationByTokenHash(sha256(token))
      if (
        !invitation?.workspaceId ||
        !invitation.role ||
        invitation.acceptedAt ||
        invitation.expiresAt.getTime() <= Date.now()
      ) {
        throw new AppError(400, 'invalid_token', 'The invitation is invalid or expired')
      }
      const user = repo.findUser(actor.id)
      if (!user || user.email !== invitation.email) {
        throw new AppError(
          403,
          'invitation_email_mismatch',
          'This invitation was sent to another address',
        )
      }
      const workspace = repo.findById(invitation.workspaceId)
      if (!workspace)
        throw new AppError(400, 'invalid_token', 'The invitation is invalid or expired')

      const existingRole = repo.getRole(workspace.id, actor.id)
      repo.transaction(() => {
        if (!existingRole) repo.addMember(workspace.id, actor.id, invitation.role!)
        repo.markInvitationAccepted(invitation.id, new Date())
      })
      if (!existingRole) {
        log(actor, workspace.id, 'workspace_member.joined', workspace.id, {
          role: invitation.role,
        })
      }
      return toWorkspaceDto(workspace, existingRole ?? invitation.role)
    },
  }
}
export type WorkspacesService = ReturnType<typeof createWorkspacesService>
