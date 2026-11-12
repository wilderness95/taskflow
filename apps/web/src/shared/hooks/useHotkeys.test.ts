import { describe, expect, it } from 'vitest'
import { isEditableTarget } from './useHotkeys'

describe('isEditableTarget', () => {
  it('beviteli elemekben és szerkeszthető tartalomban igaz', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isEditableTarget({ tagName: 'textarea' })).toBe(true)
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('gombon, egyéb elemen és cél nélkül hamis', () => {
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isEditableTarget({ tagName: 'DIV' })).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
