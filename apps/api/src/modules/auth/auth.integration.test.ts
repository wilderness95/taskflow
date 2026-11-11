import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { emailTokens, sessions, users } from '../../db/schema.js'
import { seed, SEED_BOARD_ID } from '../../db/seed.js'
import { sha256 } from './tokens.js'
import { cookieFrom, createTestApp, login, PASSWORD, register } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp()
})

const get = (url: string, cookie?: string) =>
  t.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: cookie ? { cookie } : {} })
const post = (
  url: string,
  payload?: object,
  cookie?: string,
  headers: Record<string, string> = {},
) =>
  t.app.inject({
    method: 'POST',
    url: `/api/v1${url}`,
    payload,
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  })

/** A kiküldött levélből a tokenes hivatkozás tokenje. */
const tokenFromMail = () =>
  (() => {
    const params = new URL(t.mailer.last().text.match(/https?:\/\/\S+/)![0]).searchParams
    return (params.get('token') ?? params.get('invite'))!
  })()

describe('registration', () => {
  it('first user becomes admin, is logged in and gets a verification email', async () => {
    const { res, cookie } = await register(t.app, { email: 'Admin@Example.com' })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      email: 'admin@example.com',
      isAdmin: true,
      emailVerified: false,
    })
    expect(res.json()).not.toHaveProperty('passwordHash')
    expect(res.headers['set-cookie']).toMatch(/HttpOnly/i)
    expect(res.headers['set-cookie']).toMatch(/SameSite=Lax/i)
    expect(t.mailer.last().to).toBe('admin@example.com')
    expect((await get('/auth/me', cookie)).json().email).toBe('admin@example.com')
  })

  it('stores only argon2 hashes, never plaintext passwords or raw session tokens', async () => {
    const { cookie } = await register(t.app, { email: 'a@example.com' })
    const user = t.db.select().from(users).get()!
    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    const raw = decodeURIComponent(cookie.split('=')[1]!).split('.')[0]!
    expect(t.db.select().from(sessions).get()!.id).toBe(sha256(raw))
  })

  it('adopts the seed data for the first user', async () => {
    seed(t.db)
    const { cookie } = await register(t.app, { email: 'admin@example.com' })
    expect((await get(`/boards/${SEED_BOARD_ID}`, cookie)).statusCode).toBe(200)
    expect(t.db.select().from(users).all()).toHaveLength(1)
  })

  it('rejects weak passwords, bad emails and duplicates', async () => {
    expect(
      (await register(t.app, { email: 'a@example.com', password: 'short' })).res.statusCode,
    ).toBe(400)
    expect((await register(t.app, { email: 'nem-email' })).res.statusCode).toBe(400)
    await register(t.app, { email: 'a@example.com' })
    const again = await register(t.app, { email: 'a@example.com', inviteToken: 'x' })
    expect([403, 409]).toContain(again.res.statusCode)
  })

  it('is invitation-only after the first user', async () => {
    const admin = await register(t.app, { email: 'admin@example.com' })
    const closed = await register(t.app, { email: 'b@example.com' })
    expect(closed.res.statusCode).toBe(403)
    expect(closed.res.json().error.code).toBe('invitation_required')

    const invite = await post('/invitations', { email: 'b@example.com' }, admin.cookie)
    expect(invite.statusCode).toBe(201)
    expect(invite.json()).not.toHaveProperty('token')
    const token = tokenFromMail()

    const wrongEmail = await register(t.app, { email: 'c@example.com', inviteToken: token })
    expect(wrongEmail.res.statusCode).toBe(403)

    const ok = await register(t.app, { email: 'b@example.com', inviteToken: token })
    expect(ok.res.statusCode).toBe(201)
    expect(ok.res.json()).toMatchObject({ isAdmin: false, emailVerified: true })

    const reused = await register(t.app, { email: 'b@example.com', inviteToken: token })
    expect(reused.res.statusCode).toBe(403)
  })

  it('rejects expired invitations', async () => {
    const admin = await register(t.app, { email: 'admin@example.com' })
    await post('/invitations', { email: 'b@example.com' }, admin.cookie)
    const token = tokenFromMail()
    t.db
      .update((await import('../../db/schema.js')).invitations)
      .set({ expiresAt: new Date(0) })
      .run()
    expect(
      (await register(t.app, { email: 'b@example.com', inviteToken: token })).res.statusCode,
    ).toBe(403)
  })

  it('only admins can invite', async () => {
    const admin = await register(t.app, { email: 'admin@example.com' })
    await post('/invitations', { email: 'b@example.com' }, admin.cookie)
    const member = await register(t.app, { email: 'b@example.com', inviteToken: tokenFromMail() })
    expect((await post('/invitations', { email: 'c@example.com' }, member.cookie)).statusCode).toBe(
      403,
    )
    expect((await post('/invitations', { email: 'c@example.com' })).statusCode).toBe(401)
  })

  it('allows open registration when configured', async () => {
    const open = createTestApp({ REGISTRATION_MODE: 'open' })
    await register(open.app, { email: 'a@example.com' })
    const second = await register(open.app, { email: 'b@example.com' })
    expect(second.res.statusCode).toBe(201)
    expect(second.res.json().isAdmin).toBe(false)
  })
})

describe('login and logout', () => {
  beforeEach(async () => {
    await register(t.app, { email: 'a@example.com' })
  })

  it('logs in with the right password and rejects the wrong one identically', async () => {
    const ok = await login(t.app, 'A@example.com')
    expect(ok.res.statusCode).toBe(200)
    expect((await get('/auth/me', ok.cookie)).statusCode).toBe(200)

    const wrong = await login(t.app, 'a@example.com', 'wrong-password-123')
    const unknown = await login(t.app, 'nobody@example.com')
    expect(wrong.res.statusCode).toBe(401)
    expect(unknown.res.statusCode).toBe(401)
    expect(wrong.res.json()).toEqual(unknown.res.json())
  })

  it('logout invalidates the session server-side', async () => {
    const { cookie } = await login(t.app, 'a@example.com')
    expect((await post('/auth/logout', undefined, cookie)).statusCode).toBe(204)
    expect((await get('/auth/me', cookie)).statusCode).toBe(401)
  })

  it('rejects tampered, unsigned and expired sessions', async () => {
    const { cookie } = await login(t.app, 'a@example.com')
    expect((await get('/auth/me', `${cookie}x`)).statusCode).toBe(401)
    const raw = decodeURIComponent(cookie.split('=')[1]!).split('.')[0]!
    expect((await get('/auth/me', `tf_session=${raw}`)).statusCode).toBe(401)
    t.db
      .update(sessions)
      .set({ expiresAt: new Date(0) })
      .run()
    expect((await get('/auth/me', cookie)).statusCode).toBe(401)
  })

  it('the seed user cannot log in', async () => {
    const fresh = createTestApp()
    seed(fresh.db)
    expect((await login(fresh.app, 'demo@taskflow.local')).res.statusCode).toBe(401)
  })
})

describe('protected API', () => {
  it('requires a session for everything except the public endpoints', async () => {
    expect((await get('/boards')).statusCode).toBe(401)
    expect((await get('/boards')).json().error.code).toBe('unauthenticated')
    expect((await post('/boards', { title: 'x' })).statusCode).toBe(401)
    expect((await get('/auth/me')).statusCode).toBe(401)
    expect((await get('/health')).statusCode).toBe(200)
    expect((await t.app.inject('/api/openapi.json')).statusCode).toBe(200)
  })
})

describe('CSRF / origin check', () => {
  it('rejects unsafe requests from a foreign origin, allows the app origin and header-less clients', async () => {
    const { cookie } = await register(t.app, { email: 'a@example.com' })
    const foreign = await post('/auth/logout', undefined, cookie, {
      origin: 'https://evil.example',
    })
    expect(foreign.statusCode).toBe(403)
    expect(foreign.json().error.code).toBe('invalid_origin')
    expect(
      (await post('/boards', { title: 'x' }, cookie, { referer: 'https://evil.example/x' }))
        .statusCode,
    ).toBe(403)
    expect(
      (await post('/boards', { title: 'x' }, cookie, { origin: 'http://localhost:5173' }))
        .statusCode,
    ).toBe(201)
    expect((await post('/boards', { title: 'y' }, cookie)).statusCode).toBe(201)
  })

  it('does not restrict safe requests', async () => {
    const { cookie } = await register(t.app, { email: 'a@example.com' })
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { cookie, origin: 'https://evil.example' },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('profile', () => {
  it('updates name, avatar and locale', async () => {
    const { cookie } = await register(t.app, { email: 'a@example.com' })
    const res = await t.app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me',
      headers: { cookie },
      payload: { name: 'Új Név', avatarUrl: 'https://example.com/a.png' },
    })
    expect(res.json()).toMatchObject({ name: 'Új Név', avatarUrl: 'https://example.com/a.png' })
    const bad = await t.app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me',
      headers: { cookie },
      payload: { avatarUrl: 'javascript:alert(1)' },
    })
    expect(bad.statusCode).toBe(400)
    const empty = await t.app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me',
      headers: { cookie },
      payload: {},
    })
    expect(empty.statusCode).toBe(400)
  })
})

describe('email verification', () => {
  it('verifies once with the emailed token', async () => {
    const { cookie } = await register(t.app, { email: 'a@example.com' })
    const token = tokenFromMail()
    expect((await post('/auth/verify-email', { token })).statusCode).toBe(204)
    expect((await get('/auth/me', cookie)).json().emailVerified).toBe(true)
    const again = await post('/auth/verify-email', { token })
    expect(again.statusCode).toBe(400)
    expect(again.json().error.code).toBe('invalid_token')
    expect((await post('/auth/verify-email', { token: 'nope' })).statusCode).toBe(400)
  })

  it('rejects expired tokens and can resend a fresh one', async () => {
    const { cookie } = await register(t.app, { email: 'a@example.com' })
    const old = tokenFromMail()
    t.db
      .update(emailTokens)
      .set({ expiresAt: new Date(0) })
      .where(eq(emailTokens.tokenHash, sha256(old)))
      .run()
    expect((await post('/auth/verify-email', { token: old })).statusCode).toBe(400)
    expect((await post('/auth/resend-verification', undefined, cookie)).statusCode).toBe(204)
    expect(t.mailer.sent).toHaveLength(2)
    expect((await post('/auth/verify-email', { token: tokenFromMail() })).statusCode).toBe(204)
  })
})

describe('password reset', () => {
  beforeEach(async () => {
    await register(t.app, { email: 'a@example.com' })
    t.mailer.sent.length = 0
  })

  it('answers identically for known and unknown emails, mailing only the known one', async () => {
    const known = await post('/auth/forgot-password', { email: 'a@example.com' })
    const unknown = await post('/auth/forgot-password', { email: 'nobody@example.com' })
    expect(known.statusCode).toBe(202)
    expect(unknown.statusCode).toBe(202)
    expect(known.body).toBe(unknown.body)
    expect(t.mailer.sent).toHaveLength(1)
  })

  it('sets a new password, invalidates sessions and the token', async () => {
    const before = await login(t.app, 'a@example.com')
    await post('/auth/forgot-password', { email: 'a@example.com' })
    const token = tokenFromMail()
    const newPassword = 'a-brand-new-password'

    expect((await post('/auth/reset-password', { token, password: 'short' })).statusCode).toBe(400)
    expect((await post('/auth/reset-password', { token, password: newPassword })).statusCode).toBe(
      204,
    )

    expect((await get('/auth/me', before.cookie)).statusCode).toBe(401)
    expect((await login(t.app, 'a@example.com', PASSWORD)).res.statusCode).toBe(401)
    expect((await login(t.app, 'a@example.com', newPassword)).res.statusCode).toBe(200)
    expect((await post('/auth/reset-password', { token, password: newPassword })).statusCode).toBe(
      400,
    )
  })

  it('a newer reset request invalidates the older token', async () => {
    await post('/auth/forgot-password', { email: 'a@example.com' })
    const first = tokenFromMail()
    await post('/auth/forgot-password', { email: 'a@example.com' })
    expect(
      (await post('/auth/reset-password', { token: first, password: 'another-password-1' }))
        .statusCode,
    ).toBe(400)
    expect(
      (
        await post('/auth/reset-password', {
          token: tokenFromMail(),
          password: 'another-password-1',
        })
      ).statusCode,
    ).toBe(204)
  })

  it('stores only token hashes', async () => {
    await post('/auth/forgot-password', { email: 'a@example.com' })
    const token = tokenFromMail()
    const rows = t.db.select().from(emailTokens).all()
    expect(rows.some((r) => r.tokenHash === token)).toBe(false)
    expect(rows.some((r) => r.tokenHash === sha256(token))).toBe(true)
  })
})

describe('cookie attributes', () => {
  it('marks the cookie Secure in production', async () => {
    const prod = createTestApp({
      NODE_ENV: 'production',
      SESSION_SECRET: 'x'.repeat(32),
      MAIL_TRANSPORT: 'smtp',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      APP_URL: 'https://tf.example.com',
    })
    const { res } = await register(prod.app, { email: 'a@example.com' })
    expect(cookieFrom(res)).toBeTruthy()
    expect(res.headers['set-cookie']).toMatch(/Secure/i)
  })
})
