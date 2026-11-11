import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('uses a dev session secret outside production', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).SESSION_SECRET.length).toBeGreaterThanOrEqual(32)
  })

  it('requires a real session secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/)
    expect(() =>
      loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) }),
    ).not.toThrow()
  })

  it('requires SMTP credentials for the smtp transport in production', () => {
    const base = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), MAIL_TRANSPORT: 'smtp' }
    expect(() => loadConfig(base)).toThrow(/SMTP_USER/)
    expect(() => loadConfig({ ...base, SMTP_USER: 'u', SMTP_PASS: 'p' })).not.toThrow()
  })

  it('defaults to invite-only registration', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).REGISTRATION_MODE).toBe('invite')
  })
})
