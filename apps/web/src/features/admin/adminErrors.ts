import { ApiError } from '../../api/client'

const KNOWN_CODES = [
  'forbidden',
  'unauthenticated',
  'not_found',
  'validation_error',
  'rate_limited',
  'cannot_suspend_self',
  'last_admin',
  'already_verified',
  'email_not_verified',
  'user_suspended',
  'email_taken',
  'already_member',
  'invitation_not_resendable',
  'invitation_not_pending',
] as const

export type AdminErrorKey = (typeof KNOWN_CODES)[number] | 'unknown'

/** A szerver hibakódjából fordítási kulcs (`admin:errors.<kulcs>`); a szöveget a frontend adja. */
export const adminErrorKey = (error: unknown): AdminErrorKey =>
  error instanceof ApiError && (KNOWN_CODES as readonly string[]).includes(error.code)
    ? (error.code as AdminErrorKey)
    : 'unknown'
