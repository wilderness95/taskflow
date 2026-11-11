import { hu, type Messages } from './locales/hu.js'

const locales: Record<string, Messages> = { hu }
export const DEFAULT_LOCALE = 'hu'

export type EmailTemplate = 'verifyEmail' | 'passwordReset' | 'invitation' | 'workspaceInvitation'

const interpolate = (template: string, params: Record<string, string | number>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''))

/** A backend nem küld megjelenítendő szöveget az API-n; csak az e-mail sablonokat fordítja. */
export function renderEmail(
  locale: string,
  template: EmailTemplate,
  params: Record<string, string | number> = {},
): { subject: string; text: string } {
  const messages = locales[locale] ?? locales[DEFAULT_LOCALE]!
  const { subject, body } = messages[template]
  return {
    subject,
    text: `${interpolate(body, params)}\n\n--\n${messages.common.footer}`,
  }
}
