import { describe, expect, it } from 'vitest'
import { renderEmail } from '../i18n/index.js'
import { MemoryMailer } from './mailer.js'

describe('renderEmail', () => {
  it('interpolates parameters', () => {
    const mail = renderEmail('hu', 'passwordReset', { name: 'Anna', link: 'https://x/y', hours: 1 })
    expect(mail.subject).toBeTruthy()
    expect(mail.text).toContain('Anna')
    expect(mail.text).toContain('https://x/y')
    expect(mail.text).not.toContain('{{')
  })

  it('falls back to the default locale', () => {
    expect(renderEmail('xx', 'invitation', { inviter: 'B', link: 'l', days: 7 }).subject).toBe(
      renderEmail('hu', 'invitation', { inviter: 'B', link: 'l', days: 7 }).subject,
    )
  })
})

describe('MemoryMailer', () => {
  it('collects sent messages', async () => {
    const mailer = new MemoryMailer()
    await mailer.send({ to: 'a@b.c', subject: 's', text: 't' })
    expect(mailer.last().to).toBe('a@b.c')
  })
})
