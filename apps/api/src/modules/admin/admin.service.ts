import type { VoiceStatsRepository } from '../voice/voiceStats.repository.js'
import { lastBackupAt } from '../../lib/lastBackup.js'
import type {
  AdminInvitationDto,
  AdminOverviewDto,
  AuditQuery,
  AdminInvitationsQuery,
  AdminUserDetailDto,
  AdminUserDto,
  AdminUsersQuery,
  VoiceStatsDto,
  VoiceStatsQuery,
  CreateAdminInvitationInput,
  SetAdminRoleInput,
  SuspendUserInput,
} from '@taskflow/shared'
import { type Actor, requirePlatformAdmin } from '../../auth/actor.js'
import type { Config } from '../../config.js'
import { newId } from '../../db/ids.js'
import { AppError, notFound } from '../../errors.js'
import type { Mailer } from '../../mail/mailer.js'
import { createMailSender } from '../../mail/sendMail.js'
import type { AuditEntry, AuditService } from '../audit/audit.service.js'
import type { AuthService } from '../auth/auth.service.js'
import { verifyPassword } from '../auth/passwords.js'
import { randomToken, sha256 } from '../auth/tokens.js'
import type { AdminInvitationRow, AdminRepository, AdminUserRow } from './admin.repository.js'

export type AdminContext = { ip: string | null }

export const toAdminUserDto = (u: AdminUserRow): AdminUserDto => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarUrl: u.avatarUrl,
  emailVerified: u.emailVerifiedAt !== null,
  isAdmin: u.isAdmin,
  suspended: u.suspendedAt !== null,
  suspendedAt: u.suspendedAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
})

const DAY = 24 * 60 * 60 * 1000
const INVITE_TTL = 7 * DAY

const invitationStatus = (row: AdminInvitationRow, now: Date): AdminInvitationDto['status'] =>
  row.acceptedAt
    ? 'accepted'
    : row.revokedAt
      ? 'revoked'
      : row.expiresAt.getTime() <= now.getTime()
        ? 'expired'
        : 'pending'

export const toAdminInvitationDto = (
  row: AdminInvitationRow,
  now = new Date(),
): AdminInvitationDto => ({
  id: row.id,
  email: row.email,
  workspaceId: row.workspaceId,
  workspaceName: row.workspaceName,
  role: row.role,
  invitedByName: row.invitedByName,
  status: invitationStatus(row, now),
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  acceptedAt: row.acceptedAt?.toISOString() ?? null,
})

/** Platform-adminisztráció: felhasználók kezelése. Minden művelet platform-admint kér és naplózódik. */
export function createAdminService(deps: {
  repo: AdminRepository
  voiceStats: VoiceStatsRepository
  audit: AuditService
  auth: AuthService
  mailer: Mailer
  config: Config
  logger: { error: (obj: unknown, msg: string) => void }
}) {
  const { repo, audit, auth, config } = deps
  const sendMail = createMailSender(deps.mailer, deps.logger)

  const requireUser = (id: string): AdminUserRow => {
    const user = repo.findUser(id)
    if (!user) throw notFound('User')
    return user
  }

  const detail = (user: AdminUserRow): AdminUserDetailDto => ({
    ...toAdminUserDto(user),
    workspaces: repo.listWorkspaces(user.id),
    sessionCount: repo.countSessions(user.id, new Date()),
  })

  const log = (actor: Actor, ctx: AdminContext, entry: Omit<AuditEntry, 'actorId' | 'ip'>) =>
    audit.record({ ...entry, actorId: actor.id, ip: ctx.ip })

  /**
   * Jelszó-újrabekérés: az érzékeny műveletet csak a végrehajtó helyes jelszavával lehet elvégezni.
   * A sikertelen próbát naplózzuk (jelszó nélkül); a route szigorú rate limitet is kap.
   */
  const confirmPassword = async (
    actor: Actor,
    password: string,
    ctx: AdminContext,
    operation: string,
  ): Promise<void> => {
    const me = repo.findAnyUser(actor.id)
    if (!me?.passwordHash || !(await verifyPassword(me.passwordHash, password))) {
      log(actor, ctx, {
        action: 'admin.step_up_failed',
        targetType: 'user',
        targetId: actor.id,
        meta: { operation },
      })
      throw new AppError(403, 'invalid_password', 'The password is incorrect')
    }
  }

  /** Az utolsó aktív platform-admin nem veszítheti el a jogosultságát vagy a hozzáférését. */
  const assertNotLastAdmin = (user: AdminUserRow) => {
    if (user.isAdmin && !user.suspendedAt && repo.countActiveAdmins() <= 1) {
      throw new AppError(409, 'last_admin', 'The last active admin cannot be changed')
    }
  }

  const requireInvitation = (id: string): AdminInvitationRow => {
    const row = repo.findInvitation(id)
    if (!row) throw notFound('Invitation')
    return row
  }

  /** Új meghívó (munkaterülethez kötött vagy platform-regisztrációs); a levelet is kiküldi. */
  const issueInvitation = async (
    actor: Actor,
    input: {
      email: string
      workspaceId: string | null
      role: NonNullable<CreateAdminInvitationInput['role']> | null
    },
  ): Promise<string> => {
    if (!input.workspaceId || !input.role) {
      return (await auth.createInvitation(actor, { email: input.email })).id
    }
    const workspace = repo.findWorkspace(input.workspaceId)
    if (!workspace) throw notFound('Workspace')
    if (repo.isMemberByEmail(workspace.id, input.email)) {
      throw new AppError(409, 'already_member', 'This person is already a member')
    }
    const inviter = repo.findAnyUser(actor.id)!
    const token = randomToken()
    const invitationId = newId()
    repo.insertInvitation({
      id: invitationId,
      email: input.email,
      workspaceId: workspace.id,
      role: input.role,
      tokenHash: sha256(token),
      invitedBy: actor.id,
      expiresAt: new Date(Date.now() + INVITE_TTL),
    })
    const base = config.APP_URL.replace(/\/$/, '')
    sendMail({ email: input.email, locale: inviter.locale }, 'workspaceInvitation', {
      inviter: inviter.name,
      workspace: workspace.name,
      role: input.role,
      link: `${base}/invitations/accept?token=${encodeURIComponent(token)}&email=${encodeURIComponent(input.email)}`,
      days: INVITE_TTL / DAY,
    })
    return invitationId
  }

  return {
    listUsers(actor: Actor, query: AdminUsersQuery) {
      requirePlatformAdmin(actor)
      const rows = repo.listUsers(query, query.limit + 1, query.cursor)
      const page = rows.slice(0, query.limit)
      return {
        data: page.map(toAdminUserDto),
        nextCursor: rows.length > query.limit ? page[page.length - 1]!.id : null,
      }
    },

    getUser(actor: Actor, id: string): AdminUserDetailDto {
      requirePlatformAdmin(actor)
      return detail(requireUser(id))
    },

    async suspendUser(
      actor: Actor,
      id: string,
      input: SuspendUserInput,
      ctx: AdminContext,
    ): Promise<AdminUserDetailDto> {
      requirePlatformAdmin(actor)
      const user = requireUser(id)
      await confirmPassword(actor, input.password, ctx, 'suspend')
      if (user.suspendedAt) return detail(user)
      if (user.id === actor.id) {
        throw new AppError(409, 'cannot_suspend_self', 'You cannot suspend your own account')
      }
      assertNotLastAdmin(user)
      const updated = repo.transaction(() => {
        const row = repo.updateUser(id, { suspendedAt: new Date() })!
        // A felfüggesztés azonnal kizár: a meglévő munkamenetek is megszűnnek.
        repo.deleteUserSessions(id)
        return row
      })
      log(actor, ctx, {
        action: 'admin.user_suspended',
        targetType: 'user',
        targetId: id,
        targetUserId: id,
      })
      return detail(updated)
    },

    restoreUser(actor: Actor, id: string, ctx: AdminContext): AdminUserDetailDto {
      requirePlatformAdmin(actor)
      const user = requireUser(id)
      if (!user.suspendedAt) return detail(user)
      const updated = repo.updateUser(id, { suspendedAt: null })!
      log(actor, ctx, {
        action: 'admin.user_restored',
        targetType: 'user',
        targetId: id,
        targetUserId: id,
      })
      return detail(updated)
    },

    revokeSessions(actor: Actor, id: string, ctx: AdminContext): AdminUserDetailDto {
      requirePlatformAdmin(actor)
      const user = requireUser(id)
      const revoked = repo.deleteUserSessions(id)
      log(actor, ctx, {
        action: 'admin.user_sessions_revoked',
        targetType: 'user',
        targetId: id,
        targetUserId: id,
        meta: { count: revoked },
      })
      return detail(user)
    },

    resendVerification(actor: Actor, id: string, ctx: AdminContext): AdminUserDetailDto {
      requirePlatformAdmin(actor)
      const user = requireUser(id)
      if (!auth.sendVerificationTo(id)) {
        throw new AppError(409, 'already_verified', 'The email address is already confirmed')
      }
      log(actor, ctx, {
        action: 'admin.user_verification_resent',
        targetType: 'user',
        targetId: id,
        targetUserId: id,
      })
      return detail(user)
    },

    async setAdminRole(
      actor: Actor,
      id: string,
      input: SetAdminRoleInput,
      ctx: AdminContext,
    ): Promise<AdminUserDetailDto> {
      requirePlatformAdmin(actor)
      const user = requireUser(id)
      await confirmPassword(
        actor,
        input.password,
        ctx,
        input.isAdmin ? 'grant_admin' : 'revoke_admin',
      )
      if (user.isAdmin === input.isAdmin) return detail(user)
      if (input.isAdmin) {
        // A platform-admin mentesül az e-mail-megerősítés alól, ezért csak megerősített cím kaphatja.
        if (!user.emailVerifiedAt) {
          throw new AppError(409, 'email_not_verified', 'Confirm the email address first')
        }
        if (user.suspendedAt) {
          throw new AppError(409, 'user_suspended', 'The account is suspended')
        }
      } else {
        assertNotLastAdmin(user)
      }
      const updated = repo.updateUser(id, { isAdmin: input.isAdmin })!
      log(actor, ctx, {
        action: input.isAdmin ? 'admin.user_admin_granted' : 'admin.user_admin_revoked',
        targetType: 'user',
        targetId: id,
        targetUserId: id,
      })
      return detail(updated)
    },

    overview(actor: Actor): AdminOverviewDto {
      requirePlatformAdmin(actor)
      return {
        users: repo.countUsers(),
        pendingInvitations: repo.countPendingInvitations(new Date()),
        health: {
          database: repo.ping() ? 'ok' : 'error',
          mailTransport: config.MAIL_TRANSPORT,
          lastBackupAt: lastBackupAt(config.BACKUP_DIR)?.toISOString() ?? null,
        },
        recentEvents: audit.recent(10),
      }
    },

    voiceStats(actor: Actor, query: VoiceStatsQuery): VoiceStatsDto {
      requirePlatformAdmin(actor)
      const since = new Date(Date.now() - query.days * 86_400_000)
      return {
        days: query.days,
        since: since.toISOString(),
        ...deps.voiceStats.summary(since),
      }
    },

    listAudit(actor: Actor, query: AuditQuery) {
      requirePlatformAdmin(actor)
      return audit.list(query)
    },

    listWorkspaces(actor: Actor, query: { limit: number; cursor?: string }) {
      requirePlatformAdmin(actor)
      const rows = repo.listWorkspaceSummaries(query.limit + 1, query.cursor)
      const page = rows.slice(0, query.limit)
      return {
        data: page,
        nextCursor: rows.length > query.limit ? page[page.length - 1]!.id : null,
      }
    },

    listInvitations(actor: Actor, query: AdminInvitationsQuery) {
      requirePlatformAdmin(actor)
      const now = new Date()
      const rows = repo.listInvitations(query.status, now, query.limit + 1, query.cursor)
      const page = rows.slice(0, query.limit)
      return {
        data: page.map((row) => toAdminInvitationDto(row, now)),
        nextCursor: rows.length > query.limit ? page[page.length - 1]!.id : null,
      }
    },

    async createInvitation(
      actor: Actor,
      input: CreateAdminInvitationInput,
      ctx: AdminContext,
    ): Promise<AdminInvitationDto> {
      requirePlatformAdmin(actor)
      const id = await issueInvitation(actor, {
        email: input.email,
        workspaceId: input.workspaceId ?? null,
        role: input.role ?? null,
      })
      log(actor, ctx, {
        action: 'admin.invitation_created',
        targetType: 'invitation',
        targetId: id,
        meta: {
          email: input.email,
          workspaceId: input.workspaceId ?? null,
          role: input.role ?? null,
        },
      })
      return toAdminInvitationDto(requireInvitation(id))
    },

    /** A token csak hash-ként él, ezért az újraküldés új meghívót ad ki, és a régit lejáratja. */
    async resendInvitation(
      actor: Actor,
      id: string,
      ctx: AdminContext,
    ): Promise<AdminInvitationDto> {
      requirePlatformAdmin(actor)
      const old = requireInvitation(id)
      const status = invitationStatus(old, new Date())
      if (status === 'accepted' || status === 'revoked') {
        throw new AppError(409, 'invitation_not_resendable', 'This invitation cannot be resent')
      }
      const newInvitationId = await issueInvitation(actor, {
        email: old.email,
        workspaceId: old.workspaceId,
        role: old.role,
      })
      repo.expireInvitation(old.id, new Date(), false)
      log(actor, ctx, {
        action: 'admin.invitation_resent',
        targetType: 'invitation',
        targetId: newInvitationId,
        meta: { email: old.email, previousId: old.id },
      })
      return toAdminInvitationDto(requireInvitation(newInvitationId))
    },

    revokeInvitation(actor: Actor, id: string, ctx: AdminContext): void {
      requirePlatformAdmin(actor)
      const row = requireInvitation(id)
      if (invitationStatus(row, new Date()) !== 'pending') {
        throw new AppError(
          409,
          'invitation_not_pending',
          'Only a pending invitation can be revoked',
        )
      }
      repo.expireInvitation(id, new Date(), true)
      log(actor, ctx, {
        action: 'admin.invitation_revoked',
        targetType: 'invitation',
        targetId: id,
        meta: { email: row.email },
      })
    },
  }
}
export type AdminService = ReturnType<typeof createAdminService>
