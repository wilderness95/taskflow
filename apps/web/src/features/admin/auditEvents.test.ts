import { describe, expect, it } from 'vitest'
import type { AuditEventDto } from '@taskflow/shared'
import { auditActionKey, auditTarget } from './auditEvents'

const event = (patch: Partial<AuditEventDto>): AuditEventDto => ({
  id: '1',
  actorId: null,
  actorName: null,
  action: 'auth.login_failed',
  targetType: 'user',
  targetId: null,
  targetUserId: null,
  targetUserName: null,
  ip: null,
  meta: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
})

describe('auditActionKey', () => {
  it('keeps known actions and maps others to unknown', () => {
    expect(auditActionKey('admin.user_suspended')).toBe('admin.user_suspended')
    expect(auditActionKey('something.else')).toBe('unknown')
  })
})

describe('auditTarget', () => {
  it('prefers the target user name, then the logged email', () => {
    expect(auditTarget(event({ targetUserName: 'Alice', meta: { email: 'a@x.hu' } }))).toBe('Alice')
    expect(auditTarget(event({ meta: { email: 'ghost@x.hu' } }))).toBe('ghost@x.hu')
    expect(auditTarget(event({}))).toBeNull()
  })
})
