import type { MailMessage, Mailer } from './mailer.js'

/** Fejlesztéshez: a levelet a konzolra írja (a tokenes hivatkozások miatt élesben tilos, lásd config). */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(
      `\n--- E-mail ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n--------------\n`,
    )
  }
}
