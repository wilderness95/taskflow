import type {
  AdminUserDetailDto,
  AdminUserDto,
  AdminUsersQuery,
  SetAdminRoleInput,
} from '@taskflow/shared'
import { type Actor, requirePlatformAdmin } from '../../auth/actor.js'
import { AppError, notFound } from '../../errors.js'
import type { AuditEntry, AuditService } from '../audit/audit.service.js'
import type { AuthService } from '../auth/auth.service.js'
import type { AdminRepository, AdminUserRow } from './admin.repository.js'

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

/** Platform-adminisztráció: felhasználók kezelése. Minden művelet platform-admint kér és naplózódik. */
export function createAdminService(deps: {
  repo: AdminRepository
  audit: AuditService
  auth: AuthService
}) {
  const { repo, audit, auth } = deps

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

  /** Az utolsó aktív platform-admin nem veszítheti el a jogosultságát vagy a hozzáférését. */
  const assertNotLastAdmin = (user: AdminUserRow) => {
    if (user.isAdmin && !user.suspendedAt && repo.countActiveAdmins() <= 1) {
      throw new AppError(409, 'last_admin', 'The last active admin cannot be changed')
    }
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

    suspendUser(actor: Actor, id: string, ctx: AdminContext): AdminUserDetailDto {
      requirePlatformAdmin(actor)
      const user = requireUser(id)
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

    setAdminRole(
      actor: Actor,
      id: string,
      input: SetAdminRoleInput,
      ctx: AdminContext,
    ): AdminUserDetailDto {
      requirePlatformAdmin(actor)
      const user = requireUser(id)
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
  }
}
export type AdminService = ReturnType<typeof createAdminService>
