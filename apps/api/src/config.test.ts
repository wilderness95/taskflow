import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('uses a dev session secret outside production', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).SESSION_SECRET.length).toBeGreaterThanOrEqual(32)
  })

  it('requires a real session secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/)
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) })).toThrow(
      /MAIL_TRANSPORT/,
    )
  })

  it('requires the smtp transport and its credentials in production', () => {
    const noSmtp = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) }
    expect(() => loadConfig(noSmtp)).toThrow(/MAIL_TRANSPORT/)
    const base = { ...noSmtp, MAIL_TRANSPORT: 'smtp' }
    expect(() => loadConfig(base)).toThrow(/SMTP_USER/)
    expect(() => loadConfig({ ...base, SMTP_USER: 'u', SMTP_PASS: 'p' })).not.toThrow()
  })

  it('defaults to invite-only registration', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).REGISTRATION_MODE).toBe('invite')
  })
})
