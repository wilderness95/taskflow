import type { ActivityDto } from '@taskflow/shared'
import { describe, expect, it } from 'vitest'
import { describeActivity } from './describeActivity'

const entry = (overrides: Partial<ActivityDto>): ActivityDto => ({
  id: '1',
  boardId: 'b',
  actorType: 'user',
  actorId: 'u',
  actorName: 'Olga',
  apiKeyId: null,
  action: 'card.created',
  entityType: 'card',
  entityId: 'c',
  meta: { title: 'Teendő' },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('describeActivity', () => {
  it('fills the translated template with the actor and the title', () => {
    expect(describeActivity(entry({}))).toBe('Olga létrehozta a(z) „Teendő” kártyát')
  })

  it('falls back to a generic text for unknown actions', () => {
    expect(describeActivity(entry({ action: 'robot.dance' }))).toBe('Olga: robot.dance')
  })

  it('names unknown actors', () => {
    expect(describeActivity(entry({ actorName: null }))).toContain('Ismeretlen felhasználó')
  })
})
