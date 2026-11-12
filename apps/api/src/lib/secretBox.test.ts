import { describe, expect, it } from 'vitest'
import { createSecretBox } from './secretBox.js'

describe('secretBox', () => {
  const box = createSecretBox('x'.repeat(32))

  it('round-trips and does not leak the plaintext', () => {
    const boxed = box.encrypt('whsec_abc')
    expect(boxed).not.toContain('whsec_abc')
    expect(box.decrypt(boxed)).toBe('whsec_abc')
  })

  it('uses a fresh IV each time and rejects tampering or another key', () => {
    expect(box.encrypt('a')).not.toBe(box.encrypt('a'))
    const boxed = box.encrypt('secret')
    expect(() => createSecretBox('y'.repeat(32)).decrypt(boxed)).toThrow()
    const [iv, tag, data] = boxed.split('.')
    expect(() =>
      box.decrypt([iv, tag, Buffer.from('zz').toString('base64url')].join('.')),
    ).toThrow()
    expect(data).toBeDefined()
  })
})
