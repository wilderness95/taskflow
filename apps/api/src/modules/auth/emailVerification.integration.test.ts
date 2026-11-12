import { describe, expect, it } from 'vitest'
import {
  bearer,
  client,
  createTestApp,
  register,
  signUp,
  tokenFromLastMail,
} from '../../testing/helpers.js'
import { users } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

const strict = () =>
  createTestApp({ REGISTRATION_MODE: 'open', REQUIRE_EMAIL_VERIFICATION: 'true' })

/** Az első regisztráló admin (mentes), a második már megerősítetlen sima felhasználó. */
async function setup() {
  const t = strict()
  const admin = await signUp(t.app, 'admin@example.com', 'Admin')
  const plain = await signUp(t.app, 'plain@example.com', 'Plain')
  return { t, admin, plain }
}

describe('required email verification', () => {
  it('blocks an unverified user from the data endpoints but not from account endpoints', async () => {
    const { plain } = await setup()
    const blocked = await plain.api.get('/workspaces')
    expect(blocked.status).toBe(403)
    expect(blocked.body.error.code).toBe('email_not_verified')
    expect((await plain.api.post('/workspaces/x/lists', { title: 'a' })).status).toBe(403)

    const me = await plain.api.get('/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.emailVerified).toBe(false)
    expect((await plain.api.post('/auth/resend-verification')).status).toBeLessThan(300)
    expect((await plain.api.post('/auth/logout')).status).toBeLessThan(300)
  })

  it('unlocks after the verification link is used', async () => {
    const { t, plain } = await setup()
    expect((await plain.api.get('/workspaces')).status).toBe(403)
    await plain.api.post('/auth/resend-verification')
    const token = tokenFromLastMail(t.mailer)
    expect((await client(t.app).post('/auth/verify-email', { token })).status).toBeLessThan(300)
    expect((await plain.api.get('/workspaces')).status).toBe(200)
  })

  it('exempts the platform admin', async () => {
    const { admin } = await setup()
    expect((await admin.api.get('/workspaces')).status).toBe(200)
  })

  it('treats invited registrations as verified', async () => {
    const t = createTestApp({ REQUIRE_EMAIL_VERIFICATION: 'true' })
    const admin = await signUp(t.app, 'admin@example.com', 'Admin')
    await admin.api.post('/invitations', { email: 'guest@example.com' })
    const invite = tokenFromLastMail(t.mailer)
    const guest = await register(t.app, { email: 'guest@example.com', inviteToken: invite })
    expect(guest.res.statusCode).toBe(201)
    expect((await client(t.app, guest.cookie).get('/workspaces')).status).toBe(200)
  })

  it('also blocks API keys of an unverified owner', async () => {
    const t = strict()
    await signUp(t.app, 'admin@example.com', 'Admin')
    const plain = await signUp(t.app, 'plain@example.com', 'Plain')
    // a kulcsot a tulajdonos még megerősítve hozza létre, majd a megerősítés „elvész”
    t.db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.email, 'plain@example.com'))
      .run()
    const key = (await plain.api.post('/api-keys', { name: 'k', scopes: ['workspaces:read'] })).body
      .key as string
    expect((await bearer(t.app, key).get('/workspaces')).status).toBe(200)
    t.db
      .update(users)
      .set({ emailVerifiedAt: null })
      .where(eq(users.email, 'plain@example.com'))
      .run()
    const res = await bearer(t.app, key).get('/workspaces')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('email_not_verified')
  })

  it('is off when disabled (the test default)', async () => {
    const t = createTestApp({ REGISTRATION_MODE: 'open' })
    await signUp(t.app, 'admin@example.com', 'Admin')
    const plain = await signUp(t.app, 'plain@example.com', 'Plain')
    expect((await plain.api.get('/workspaces')).status).toBe(200)
  })
})
