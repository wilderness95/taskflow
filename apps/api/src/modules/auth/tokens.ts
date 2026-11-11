import { createHash, randomBytes } from 'node:crypto'

/** Kitalálhatatlan token (URL-barát); csak a hash-e kerül az adatbázisba. */
export const randomToken = (): string => randomBytes(32).toString('base64url')

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')
