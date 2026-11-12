import { describe, expect, it } from 'vitest'
import { isBlockedHostname, isPrivateAddress } from './privateAddress.js'

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    'fd00::1',
    '::ffff:10.0.0.1',
    '100.64.0.1',
  ])('blocks %s', (a) => expect(isPrivateAddress(a)).toBe(true))
  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows %s', (a) =>
    expect(isPrivateAddress(a)).toBe(false),
  )
})

describe('isBlockedHostname', () => {
  it('blocks localhost, .local and literal private IPs, allows public names', () => {
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('nas.local')).toBe(true)
    expect(isBlockedHostname('[::1]')).toBe(true)
    expect(isBlockedHostname('192.168.0.5')).toBe(true)
    expect(isBlockedHostname('hooks.example.com')).toBe(false)
  })
})
