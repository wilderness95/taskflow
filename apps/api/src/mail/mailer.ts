import type { Config } from '../config.js'
import { ConsoleMailer } from './consoleMailer.js'
import { SmtpMailer } from './smtpMailer.js'

export type MailMessage = { to: string; subject: string; text: string }

export interface Mailer {
  send(message: MailMessage): Promise<void>
}

/** Tesztekhez: a kiküldött leveleket gyűjti. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = []
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message)
  }
  last(): MailMessage {
    const message = this.sent.at(-1)
    if (!message) throw new Error('No mail was sent')
    return message
  }
}

export function createMailer(config: Config): Mailer {
  return config.MAIL_TRANSPORT === 'smtp' ? new SmtpMailer(config) : new ConsoleMailer()
}
