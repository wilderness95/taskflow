import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, getToasts, resetToasts, showToast } from './toast'

beforeEach(() => {
  vi.useFakeTimers()
  resetToasts()
})
afterEach(() => {
  vi.useRealTimers()
  resetToasts()
})

describe('toast', () => {
  it('closes after the default time; action and error toasts stay longer', () => {
    showToast({ message: 'plain' })
    showToast({ message: 'undo', action: { label: 'Undo', run: () => {} } })
    showToast({ message: 'bad', kind: 'error' })
    expect(getToasts().map((t) => t.message)).toEqual(['plain', 'undo', 'bad'])

    vi.advanceTimersByTime(4100)
    expect(getToasts().map((t) => t.message)).toEqual(['undo', 'bad'])
    vi.advanceTimersByTime(4000)
    expect(getToasts()).toEqual([])
  })

  it('keeps at most three toasts and dismisses on demand', () => {
    const ids = ['a', 'b', 'c', 'd'].map((message) => showToast({ message }))
    expect(getToasts().map((t) => t.message)).toEqual(['b', 'c', 'd'])
    dismissToast(ids[2]!)
    expect(getToasts().map((t) => t.message)).toEqual(['b', 'd'])
    expect(getToasts()[0]!.kind).toBe('info')
  })
})
