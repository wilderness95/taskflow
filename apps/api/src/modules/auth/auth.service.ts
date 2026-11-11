import type {
  CreateInvitationInput,
  ForgotPasswordRequest,
  InvitationDto,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
  UserDto,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import type { Config } from '../../config.js'
import { newId } from '../../db/ids.js'
import { SEED_USER_ID } from '../../db/seed.js'
import { AppError } from '../../errors.js'
import { renderEmail, type EmailTemplate } from '../../i18n/index.js'
import type { Mailer } from '../../mail/mailer.js'
import type { AuthRepository, UserRow } from './auth.repository.js'
import { LoginThrottle } from './loginThrottle.js'
import { hashPassword, verifyDummyPassword, verifyPassword } from './passwords.js'
import { randomToken, sha256 } from './tokens.js'

const HOUR = 60 * 60 * 1000
const VERIFY_TTL = 24 * HOUR
const RESET_TTL = 1 * HOUR
const INVITE_TTL = 7 * 24 * HOUR

export type RequestContext = { ip: string | null; userAgent: string | null }
export type NewSession = { token: string; expiresAt: Date }
export type AuthResult = { user: UserDto; session: NewSession }

type Logger = { error: (obj: unknown, msg: string) => void }

export const toUserDto = (u: UserRow): UserDto => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarUrl: u.avatarUrl,
  locale: u.locale as UserDto['locale'],
  emailVerified: u.emailVerifiedAt !== null,
  isAdmin: u.isAdmin,
})

export function createAuthService(deps: {
  repo: AuthRepository
  mailer: Mailer
  config: Config
  logger: Logger
  throttle?: LoginThrottle
}) {
  const { repo, mailer, config, logger } = deps
  const throttle = deps.throttle ?? new LoginThrottle(config.LOGIN_MAX_FAILURES)

  const link = (path: string, token: string) =>
    `${config.APP_URL.replace(/\/$/, '')}${path}?token=${encodeURIComponent(token)}`

  /**
   * A levelet nem várjuk be: a lassú vagy elérhetetlen SMTP-szerver nem akaszthatja meg a kérést,
   * és a válaszidő nem árulja el, hogy létezik-e a fiók. A hibát naplózzuk.
   */
  const sendMail = (
    user: { email: string; locale: string },
    template: EmailTemplate,
    params: Record<string, string | number>,
  ): void => {
    mailer
      .send({ to: user.email, ...renderEmail(user.locale, template, params) })
      .catch((error: unknown) => logger.error({ err: error, template }, 'failed to send email'))
  }

  const createSession = (userId: string, ctx: RequestContext): NewSession => {
    const token = randomToken()
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_DAYS * 24 * HOUR)
    repo.deleteExpiredSessions(new Date())
    repo.insertSession({
      id: sha256(token),
      userId,
      expiresAt,
      ip: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    })
    return { token, expiresAt }
  }

  const issueEmailToken = (
    userId: string,
    type: 'verify_email' | 'password_reset',
    ttl: number,
  ): string => {
    const token = randomToken()
    const now = new Date()
    repo.invalidateEmailTokens(userId, type, now)
    repo.insertEmailToken({
      id: newId(),
      userId,
      type,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + ttl),
    })
    return token
  }

  const sendVerification = (user: UserRow) => {
    const token = issueEmailToken(user.id, 'verify_email', VERIFY_TTL)
    sendMail(user, 'verifyEmail', {
      name: user.name,
      link: link('/verify-email', token),
      hours: VERIFY_TTL / HOUR,
    })
  }

  const requireUsableEmailToken = (token: string, type: 'verify_email' | 'password_reset') => {
    const row = repo.findEmailToken(sha256(token), type)
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AppError(400, 'invalid_token', 'The token is invalid or expired')
    }
    return row
  }

  return {
    async register(input: RegisterInput, ctx: RequestContext): Promise<AuthResult> {
      const isFirstUser = repo.countLoginUsers() === 0
      let invitation = undefined as ReturnType<AuthRepository['findInvitation']>

      if (!isFirstUser && config.REGISTRATION_MODE === 'invite') {
        invitation = input.inviteToken ? repo.findInvitation(sha256(input.inviteToken)) : undefined
        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.expiresAt.getTime() < Date.now() ||
          invitation.email !== input.email
        ) {
          throw new AppError(403, 'invitation_required', 'A valid invitation is required')
        }
      }

      if (repo.findUserByEmail(input.email)) {
        const seedUser = isFirstUser ? repo.findUserById(SEED_USER_ID) : undefined
        if (!(seedUser && seedUser.email === input.email)) {
          throw new AppError(409, 'email_taken', 'This email is already registered')
        }
      }

      const passwordHash = await hashPassword(input.password)
      const now = new Date()

      const user = repo.transaction(() => {
        // Az első felhasználó admin, és átveszi a seed felhasználó adatait (tábla, kártyák).
        const seedUser = isFirstUser ? repo.findUserById(SEED_USER_ID) : undefined
        const values = {
          email: input.email,
          name: input.name,
          passwordHash,
          isAdmin: isFirstUser,
          emailVerifiedAt: invitation ? now : null,
        }
        const created = seedUser
          ? repo.updateUser(seedUser.id, values)!
          : repo.insertUser({ id: newId(), ...values })
        if (invitation) repo.markInvitationAccepted(invitation.id, now)
        return created
      })

      if (!invitation) sendVerification(user)
      return { user: toUserDto(user), session: createSession(user.id, ctx) }
    },

    async login(input: LoginInput, ctx: RequestContext): Promise<AuthResult> {
      throttle.check(input.email)
      const user = repo.findUserByEmail(input.email)
      if (!user?.passwordHash) {
        await verifyDummyPassword(input.password)
      }
      if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
        throttle.fail(input.email)
        throw new AppError(401, 'invalid_credentials', 'Invalid email or password')
      }
      throttle.reset(input.email)
      return { user: toUserDto(user), session: createSession(user.id, ctx) }
    },

    logout(sessionToken: string): void {
      repo.deleteSession(sha256(sessionToken))
    },

    /** A session cookie tokenjéből Actor; ismeretlen vagy lejárt munkamenetre `null`. */
    authenticate(sessionToken: string): Actor | null {
      const session = repo.findSession(sha256(sessionToken))
      if (!session) return null
      if (session.expiresAt.getTime() < Date.now()) {
        repo.deleteSession(session.id)
        return null
      }
      const user = repo.findUserById(session.userId)
      return user ? { type: 'user', id: user.id, isAdmin: user.isAdmin } : null
    },

    me(actor: Actor): UserDto {
      const user = repo.findUserById(actor.id)
      if (!user) throw new AppError(401, 'unauthenticated', 'Authentication required')
      return toUserDto(user)
    },

    updateProfile(actor: Actor, input: UpdateProfileInput): UserDto {
      return toUserDto(repo.updateUser(actor.id, input)!)
    },

    async verifyEmail(token: string): Promise<void> {
      const row = requireUsableEmailToken(token, 'verify_email')
      const now = new Date()
      repo.transaction(() => {
        repo.markEmailTokenUsed(row.id, now)
        repo.updateUser(row.userId, { emailVerifiedAt: now })
      })
    },

    async resendVerification(actor: Actor): Promise<void> {
      const user = repo.findUserById(actor.id)
      if (user && !user.emailVerifiedAt) sendVerification(user)
    },

    /** Mindig ugyanúgy válaszol, hogy ne derüljön ki, melyik e-mail-cím regisztrált. */
    async requestPasswordReset({ email }: ForgotPasswordRequest): Promise<void> {
      const normalized = email.trim().toLowerCase()
      const user = repo.findUserByEmail(normalized)
      if (!user?.passwordHash) return
      const token = issueEmailToken(user.id, 'password_reset', RESET_TTL)
      sendMail(user, 'passwordReset', {
        name: user.name,
        link: link('/reset-password', token),
        hours: RESET_TTL / HOUR,
      })
    },

    async resetPassword(input: ResetPasswordInput): Promise<void> {
      const row = requireUsableEmailToken(input.token, 'password_reset')
      const passwordHash = await hashPassword(input.password)
      const now = new Date()
      repo.transaction(() => {
        repo.markEmailTokenUsed(row.id, now)
        // A jelszó-visszaállítás megerősíti a postafiók birtoklását, és minden munkamenetet lezár.
        repo.updateUser(row.userId, { passwordHash, emailVerifiedAt: now })
        repo.deleteUserSessions(row.userId)
      })
    },

    async createInvitation(actor: Actor, input: CreateInvitationInput): Promise<InvitationDto> {
      if (!actor.isAdmin) throw new AppError(403, 'forbidden', 'Admin rights required')
      if (repo.findUserByEmail(input.email)?.passwordHash) {
        throw new AppError(409, 'email_taken', 'This email is already registered')
      }
      const inviter = repo.findUserById(actor.id)!
      const token = randomToken()
      const invitation = repo.insertInvitation({
        id: newId(),
        email: input.email,
        tokenHash: sha256(token),
        invitedBy: actor.id,
        expiresAt: new Date(Date.now() + INVITE_TTL),
      })
      sendMail({ email: input.email, locale: inviter.locale }, 'invitation', {
        inviter: inviter.name,
        link: `${config.APP_URL.replace(/\/$/, '')}/register?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(input.email)}`,
        days: INVITE_TTL / (24 * HOUR),
      })
      return {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt.toISOString(),
      }
    },
  }
}
export type AuthService = ReturnType<typeof createAuthService>
