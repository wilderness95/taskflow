import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { adminErrorKey } from './adminErrors'

describe('adminErrorKey', () => {
  it('maps known server error codes to translation keys', () => {
    expect(adminErrorKey(new ApiError(409, 'last_admin', 'x'))).toBe('last_admin')
    expect(adminErrorKey(new ApiError(409, 'cannot_suspend_self', 'x'))).toBe('cannot_suspend_self')
  })

  it('falls back to unknown for unknown codes and non-API errors', () => {
    expect(adminErrorKey(new ApiError(500, 'internal_error', 'x'))).toBe('unknown')
    expect(adminErrorKey(new Error('network'))).toBe('unknown')
  })
})
