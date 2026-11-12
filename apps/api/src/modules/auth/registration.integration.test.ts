import { describe, expect, it } from 'vitest'
import { createTestApp, register } from '../../testing/helpers.js'

const registrationOpen = async (t: ReturnType<typeof createTestApp>) =>
  (await t.app.inject('/api/v1/health')).json().registrationOpen

describe('registration protection', () => {
  it('invite-only (default): open only for the very first user, then closed to strangers', async () => {
    const t = createTestApp()
    expect(await registrationOpen(t)).toBe(true)
    expect((await register(t.app, { email: 'admin@example.com' })).res.statusCode).toBe(201)
    expect(await registrationOpen(t)).toBe(false)

    const stranger = await register(t.app, { email: 'stranger@example.com' })
    expect(stranger.res.statusCode).toBe(403)
    expect(stranger.res.json().error.code).toBe('invitation_required')
    // egy kitalált meghívó-token sem segít
    const forged = await register(t.app, { email: 'stranger@example.com', inviteToken: 'nope' })
    expect(forged.res.statusCode).toBe(403)
  })

  it('open mode reports open registration', async () => {
    const t = createTestApp({ REGISTRATION_MODE: 'open' })
    await register(t.app, { email: 'admin@example.com' })
    expect(await registrationOpen(t)).toBe(true)
    expect((await register(t.app, { email: 'other@example.com' })).res.statusCode).toBe(201)
  })
})
