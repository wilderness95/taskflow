import argon2 from 'argon2'

export const hashPassword = (password: string): Promise<string> => argon2.hash(password)

export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  argon2.verify(hash, password).catch(() => false)

let dummyHash: Promise<string> | undefined

/** Ismeretlen e-mail esetén is lefut egy ellenőrzés, hogy a válaszidő ne árulja el a fiók létezését. */
export const verifyDummyPassword = async (password: string): Promise<void> => {
  dummyHash ??= argon2.hash('dummy-password-for-timing')
  await verifyPassword(await dummyHash, password)
}
