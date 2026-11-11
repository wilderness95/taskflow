import {
  invitationSchema,
  userSchema,
  type CreateInvitationRequest,
  type ForgotPasswordRequest,
  type InvitationDto,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordInput,
  type UpdateProfileInput,
  type UserDto,
} from '@taskflow/shared'
import { ApiError, apiFetch } from './client'

/** A bejelentkezett felhasználó, vagy `null`, ha nincs érvényes munkamenet. */
export const fetchMe = async (): Promise<UserDto | null> => {
  try {
    return userSchema.parse(await apiFetch('GET', '/auth/me'))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

export const login = async (input: LoginRequest): Promise<UserDto> =>
  userSchema.parse(await apiFetch('POST', '/auth/login', input))

export const register = async (input: RegisterRequest): Promise<UserDto> =>
  userSchema.parse(await apiFetch('POST', '/auth/register', input))

export const logout = () => apiFetch('POST', '/auth/logout')

export const updateProfile = async (input: UpdateProfileInput): Promise<UserDto> =>
  userSchema.parse(await apiFetch('PATCH', '/auth/me', input))

export const forgotPassword = (input: ForgotPasswordRequest) =>
  apiFetch('POST', '/auth/forgot-password', input)

export const resetPassword = (input: ResetPasswordInput) =>
  apiFetch('POST', '/auth/reset-password', input)

export const verifyEmail = (token: string) => apiFetch('POST', '/auth/verify-email', { token })

export const resendVerification = () => apiFetch('POST', '/auth/resend-verification')

export const createInvitation = async (input: CreateInvitationRequest): Promise<InvitationDto> =>
  invitationSchema.parse(await apiFetch('POST', '/invitations', input))
