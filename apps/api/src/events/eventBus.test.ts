import type { BoardEvent } from '@taskflow/shared'
import { describe, expect, it, vi } from 'vitest'
import { createEventBus } from './eventBus.js'

const event = (boardId: string): BoardEvent => ({
  id: 'e1',
  boardId,
  action: 'card.created',
  entityType: 'card',
  entityId: 'c1',
  cardId: 'c1',
  actorType: 'user',
  actorId: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
})

describe('event bus', () => {
  it('delivers events only to subscribers of that board', () => {
    const bus = createEventBus()
    const a = vi.fn()
    const b = vi.fn()
    bus.subscribe('b1', a)
    bus.subscribe('b2', b)
    bus.publish(event('b1'))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })

  it('stops delivering after unsubscribe and cleans up', () => {
    const bus = createEventBus()
    const a = vi.fn()
    const off = bus.subscribe('b1', a)
    expect(bus.subscriberCount('b1')).toBe(1)
    off()
    bus.publish(event('b1'))
    expect(a).not.toHaveBeenCalled()
    expect(bus.subscriberCount('b1')).toBe(0)
  })

  it('survives a throwing listener', () => {
    const bus = createEventBus()
    const ok = vi.fn()
    bus.subscribe('b1', () => {
      throw new Error('boom')
    })
    bus.subscribe('b1', ok)
    bus.publish(event('b1'))
    expect(ok).toHaveBeenCalled()
  })
})
