import { isIP } from 'node:net'

/** Loopback, privát, link-local (pl. felhő metaadat), CGNAT, multicast és egyéb nem publikus címek. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateV4(address)
  if (version === 6) {
    const a = address.toLowerCase()
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a)
    if (mapped) return isPrivateV4(mapped[1]!)
    return (
      a === '::' ||
      a === '::1' ||
      a.startsWith('fc') ||
      a.startsWith('fd') ||
      /^fe[89ab]/.test(a) ||
      a.startsWith('ff')
    )
  }
  return true // nem IP: biztonsági okból tiltott
}

function isPrivateV4(address: string): boolean {
  const [a, b] = address.split('.').map(Number) as [number, number]
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    a >= 224
  )
}

/** A hostnév szerinti gyors, szinkron tiltás (literál IP és `localhost`); a névfeloldást a kézbesítő is ellenőrzi. */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  return isIP(host) !== 0 && isPrivateAddress(host)
}
