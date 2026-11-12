import { renderEmail, type EmailTemplate } from '../i18n/index.js'
import type { Mailer } from './mailer.js'

type Logger = { error: (obj: unknown, msg: string) => void }

/**
 * A levelet nem várjuk be: a lassú vagy elérhetetlen SMTP-szerver nem akaszthatja meg a kérést,
 * és a válaszidő nem árulja el, hogy létezik-e a fiók. A hibát naplózzuk.
 */
export function createMailSender(mailer: Mailer, logger: Logger) {
  return (
    to: { email: string; locale: string },
    template: EmailTemplate,
    params: Record<string, string | number>,
  ): void => {
    mailer
      .send({ to: to.email, ...renderEmail(to.locale, template, params) })
      .catch((error: unknown) => logger.error({ err: error, template }, 'failed to send email'))
  }
}
