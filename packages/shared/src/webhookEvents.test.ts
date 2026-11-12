import { describe, expect, it } from 'vitest'
import { matchesWebhookEvent } from './webhookEvents'

describe('matchesWebhookEvent', () => {
  it('matches wildcard, entity wildcard and exact names', () => {
    expect(matchesWebhookEvent(['*'], 'card.moved')).toBe(true)
    expect(matchesWebhookEvent(['card.*'], 'card.moved')).toBe(true)
    expect(matchesWebhookEvent(['card.moved'], 'card.moved')).toBe(true)
  })

  it('rejects other events', () => {
    expect(matchesWebhookEvent(['card.moved'], 'card.updated')).toBe(false)
    expect(matchesWebhookEvent(['comment.*'], 'card.moved')).toBe(false)
    expect(matchesWebhookEvent([], 'card.moved')).toBe(false)
  })
})
