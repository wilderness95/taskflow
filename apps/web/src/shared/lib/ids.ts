/** Ideiglenes kliensoldali ID; az API bekötésekor a szerver ID-i (ULID) veszik át a szerepét. */
export const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
