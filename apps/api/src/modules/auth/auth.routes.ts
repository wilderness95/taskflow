import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  createInvitationSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@taskflow/shared'
import { clientIp, requireActor, SESSION_COOKIE } from '../../auth/auth.plugin.js'
import type { Config } from '../../config.js'
import type { AuthService, NewSession } from './auth.service.js'

export function authRoutes(service: AuthService, config: Config) {
  const setSessionCookie = (reply: FastifyReply, session: NewSession) =>
    reply.setCookie(SESSION_COOKIE, session.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      signed: true,
      expires: session.expiresAt,
    })

  const strict = {
    config: { rateLimit: { max: config.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } },
  }

  return async (app: FastifyInstance): Promise<void> => {
    app.post('/api/v1/auth/register', strict, async (req, reply) => {
      const { user, session } = await service.register(registerSchema.parse(req.body), {
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
      })
      setSessionCookie(reply, session)
      return reply.status(201).send(user)
    })

    app.post('/api/v1/auth/login', strict, async (req, reply) => {
      const { user, session } = await service.login(loginSchema.parse(req.body), {
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
      })
      setSessionCookie(reply, session)
      return user
    })

    app.post('/api/v1/auth/logout', async (req, reply) => {
      if (req.sessionToken) service.logout(req.sessionToken)
      reply.clearCookie(SESSION_COOKIE, { path: '/' })
      return reply.status(204).send()
    })

    app.get('/api/v1/auth/me', async (req) => service.me(requireActor(req)))

    app.patch('/api/v1/auth/me', async (req) =>
      service.updateProfile(requireActor(req), updateProfileSchema.parse(req.body)),
    )

    app.post('/api/v1/auth/forgot-password', strict, async (req, reply) => {
      await service.requestPasswordReset(forgotPasswordSchema.parse(req.body))
      return reply.status(202).send()
    })

    app.post('/api/v1/auth/reset-password', strict, async (req, reply) => {
      await service.resetPassword(resetPasswordSchema.parse(req.body))
      return reply.status(204).send()
    })

    app.post('/api/v1/auth/verify-email', strict, async (req, reply) => {
      await service.verifyEmail(verifyEmailSchema.parse(req.body).token)
      return reply.status(204).send()
    })

    app.post('/api/v1/auth/resend-verification', strict, async (req, reply) => {
      await service.resendVerification(requireActor(req))
      return reply.status(204).send()
    })

    app.post('/api/v1/invitations', strict, async (req, reply) => {
      const invitation = await service.createInvitation(
        requireActor(req),
        createInvitationSchema.parse(req.body),
      )
      return reply.status(201).send(invitation)
    })
  }
}
