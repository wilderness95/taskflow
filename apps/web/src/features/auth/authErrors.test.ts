import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { authErrorKey } from './authErrors'

describe('authErrorKey', () => {
  it('maps known server error codes to translation keys', () => {
    expect(authErrorKey(new ApiError(401, 'invalid_credentials', 'x'))).toBe('invalid_credentials')
    expect(authErrorKey(new ApiError(429, 'rate_limited', 'x'))).toBe('rate_limited')
  })

  it('falls back to unknown for unknown codes and non-API errors', () => {
    expect(authErrorKey(new ApiError(500, 'internal_error', 'x'))).toBe('unknown')
    expect(authErrorKey(new Error('network'))).toBe('unknown')
    expect(authErrorKey(undefined)).toBe('unknown')
  })
})
