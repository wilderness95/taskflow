import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

/**
 * Visszafejthető titkok (pl. webhook aláírókulcs) tárolásához: AES-256-GCM, a kulcs a
 * `SESSION_SECRET`-ből származik (HKDF). Jelszót és API kulcsot nem így tárolunk (azokhoz hash elég);
 * a HMAC-aláíráshoz viszont a nyers titok kell. A `SESSION_SECRET` cseréjekor a tárolt titkok
 * nem fejthetők vissza (a webhookokat újra kell hozni).
 */
export function createSecretBox(secret: string) {
  const key = Buffer.from(hkdfSync('sha256', secret, '', 'taskflow-secret-box', 32))
  return {
    encrypt(plain: string): string {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
      return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
    },
    decrypt(boxed: string): string {
      const [iv, tag, data] = boxed.split('.').map((p) => Buffer.from(p, 'base64url')) as [
        Buffer,
        Buffer,
        Buffer,
      ]
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    },
  }
}
export type SecretBox = ReturnType<typeof createSecretBox>
