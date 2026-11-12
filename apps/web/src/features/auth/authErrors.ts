import { ApiError } from '../../api/client'

const KNOWN_CODES = [
  'invalid_credentials',
  'too_many_attempts',
  'rate_limited',
  'email_taken',
  'invitation_required',
  'invalid_token',
  'validation_error',
  'forbidden',
  'unauthenticated',
  'already_member',
  'last_owner',
  'workspace_not_empty',
  'invitation_email_mismatch',
  'not_workspace_member',
] as const

export type AuthErrorKey = (typeof KNOWN_CODES)[number] | 'unknown'

/** A szerver hibakódjából fordítási kulcs (`auth:errors.<kulcs>`); a szöveget a frontend adja. */
export const authErrorKey = (error: unknown): AuthErrorKey =>
  error instanceof ApiError && (KNOWN_CODES as readonly string[]).includes(error.code)
    ? (error.code as AuthErrorKey)
    : 'unknown'
