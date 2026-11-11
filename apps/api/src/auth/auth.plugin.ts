import fastifyCookie from '@fastify/cookie'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Config } from '../config.js'
import { AppError } from '../errors.js'
import type { AuthService } from '../modules/auth/auth.service.js'
import type { Actor } from './actor.js'

export const SESSION_COOKIE = 'tf_session'

declare module 'fastify' {
  interface FastifyRequest {
    /** A bejelentkezett szereplő; nyilvános végpontokon `null`. Védett route-ban `requireActor`-ral olvasd. */
    actor: Actor | null
    sessionToken: string | null
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const PUBLIC_PATHS = new Set([
  '/api/v1/health',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
  '/api/openapi.json',
])

const isPublic = (path: string) => PUBLIC_PATHS.has(path) || path.startsWith('/api/docs')

/** Cloudflare mögött a kliens IP-je a `CF-Connecting-IP` fejlécből jön. */
export const clientIp = (req: FastifyRequest): string => {
  const header = req.headers['cf-connecting-ip']
  return (Array.isArray(header) ? header[0] : header) ?? req.ip
}

export function requireActor(req: FastifyRequest): Actor {
  if (!req.actor) throw new AppError(401, 'unauthenticated', 'Authentication required')
  return req.actor
}

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * CSRF-védelem a cookie-s kéréseknél: a `SameSite=Lax` mellett az `Origin` (ennek hiányában a
 * `Referer`) az `APP_URL` origin-jével kell egyezzen. Fejléc nélküli kérés nem böngészőből jön.
 */
function checkOrigin(req: FastifyRequest, allowedOrigin: string) {
  const origin = req.headers.origin ?? req.headers.referer
  if (!origin) return
  if (originOf(origin) !== allowedOrigin) {
    throw new AppError(403, 'invalid_origin', 'Request origin is not allowed')
  }
}

export function registerAuth(app: FastifyInstance, config: Config, auth: AuthService): void {
  app.register(fastifyCookie, { secret: config.SESSION_SECRET })
  app.decorateRequest('actor', null)
  app.decorateRequest('sessionToken', null)

  const allowedOrigin = new URL(config.APP_URL).origin

  // A `preValidation` már a cookie-plugin `onRequest` hookja után fut, így a `req.cookies` kész.
  app.addHook('preValidation', async (req) => {
    const path = req.url.split('?')[0] ?? req.url
    if (!path.startsWith('/api/')) return

    if (UNSAFE_METHODS.has(req.method)) checkOrigin(req, allowedOrigin)

    const raw = req.cookies[SESSION_COOKIE]
    const unsigned = raw ? req.unsignCookie(raw) : null
    if (unsigned?.valid && unsigned.value) {
      req.actor = auth.authenticate(unsigned.value)
      req.sessionToken = req.actor ? unsigned.value : null
    }

    if (!req.actor && !isPublic(path)) {
      throw new AppError(401, 'unauthenticated', 'Authentication required')
    }
  })
}
