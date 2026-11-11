import { createTransport, type Transporter } from 'nodemailer'
import type { Config } from '../config.js'
import type { MailMessage, Mailer } from './mailer.js'

/** SMTP (pl. Gmail app password) Nodemailerrel; a 465-ös port implicit TLS. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter

  constructor(private readonly config: Config) {
    this.transport = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.config.MAIL_FROM, ...message })
  }
}
