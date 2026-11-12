import fastifyCookie from '@fastify/cookie'
import { scopeAllows } from '@taskflow/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Config } from '../config.js'
import { AppError } from '../errors.js'
import { createFixedWindowLimiter } from '../lib/fixedWindowLimiter.js'
import type { ApiKeysService } from '../modules/apikeys/apikeys.service.js'
import type { AuthService } from '../modules/auth/auth.service.js'
import type { Actor } from './actor.js'
import { requiredScope } from './scopes.js'

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

/**
 * Megerősítetlen e-mail-című felhasználó ezeket is eléri: a fiókkezelést (belépés, kilépés, `me`,
 * megerősítés és újraküldés), az állapotot és a dokumentációt.
 */
const UNVERIFIED_ALLOWED = (path: string) =>
  path.startsWith('/api/v1/auth/') || PUBLIC_PATHS.has(path) || path.startsWith('/api/docs')

const PUBLIC_BOARD_READ = /^\/api\/v1\/boards\/[^/]+$/

/**
 * Névtelenül elérhető: a nyilvános végpontok, és egy tábla olvasása (`GET /boards/{id}`), mert a
 * `public` láthatóságú tábla bárki számára olvasható; hogy egy konkrét tábla az-e, a policy dönti el.
 */
const isPublic = (method: string, path: string) =>
  PUBLIC_PATHS.has(path) ||
  path.startsWith('/api/docs') ||
  (method === 'GET' && PUBLIC_BOARD_READ.test(path))

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

const BEARER = /^Bearer\s+(\S+)$/i

export function registerAuth(
  app: FastifyInstance,
  config: Config,
  auth: AuthService,
  apiKeys: ApiKeysService,
): void {
  app.register(fastifyCookie, { secret: config.SESSION_SECRET })
  app.decorateRequest('actor', null)
  app.decorateRequest('sessionToken', null)

  const allowedOrigin = new URL(config.APP_URL).origin

  /** Kötelező e-mail-megerősítés: a megerősítetlen szereplő csak a fiókkezelő végpontokat éri el. */
  const requireVerifiedEmail = (actor: Actor | null, path: string) => {
    if (config.REQUIRE_EMAIL_VERIFICATION && actor && !actor.emailCleared) {
      if (!UNVERIFIED_ALLOWED(path)) {
        throw new AppError(403, 'email_not_verified', 'Confirm your email address first')
      }
    }
  }

  // A `preValidation` már a cookie-plugin `onRequest` hookja után fut, így a `req.cookies` kész.
  // Kulcsonkénti rate limit (az IP-alapú globális limit mellett).
  const keyLimiter = createFixedWindowLimiter(config.API_KEY_RATE_LIMIT_MAX, 60_000)

  app.addHook('preValidation', async (req, reply) => {
    const path = req.url.split('?')[0] ?? req.url
    if (!path.startsWith('/api/')) return

    const authorization = req.headers.authorization
    if (authorization) {
      // API kulcs: nem böngészős kliens, ezért nincs Origin-ellenőrzés és cookie sem számít.
      const token = BEARER.exec(authorization)?.[1]
      const actor = token ? apiKeys.authenticate(token) : null
      if (!actor || actor.type !== 'api_key') {
        throw new AppError(401, 'invalid_api_key', 'Invalid, revoked or expired API key')
      }
      req.actor = actor
      requireVerifiedEmail(actor, path)
      const required = requiredScope(req.method, path)
      if (required === 'session') {
        throw new AppError(403, 'session_required', 'This endpoint is not available with API keys')
      }
      if (required && !scopeAllows(actor.scopes, required)) {
        throw new AppError(403, 'insufficient_scope', 'The API key lacks the required scope', {
          required,
        })
      }
      const hit = keyLimiter.hit(actor.keyId)
      reply.header('X-RateLimit-Limit', config.API_KEY_RATE_LIMIT_MAX)
      reply.header('X-RateLimit-Remaining', hit.remaining)
      if (!hit.allowed) {
        reply.header('Retry-After', hit.retryAfterSeconds)
        throw new AppError(429, 'rate_limited', 'Too many requests', {
          retryAfterSeconds: hit.retryAfterSeconds,
        })
      }
      return
    }

    if (UNSAFE_METHODS.has(req.method)) checkOrigin(req, allowedOrigin)

    const raw = req.cookies[SESSION_COOKIE]
    const unsigned = raw ? req.unsignCookie(raw) : null
    if (unsigned?.valid && unsigned.value) {
      req.actor = auth.authenticate(unsigned.value)
      req.sessionToken = req.actor ? unsigned.value : null
    }

    requireVerifiedEmail(req.actor, path)

    if (!req.actor && !isPublic(req.method, path)) {
      throw new AppError(401, 'unauthenticated', 'Authentication required')
    }
  })
}
