/** `YYYY-MM-DD` (helyi nap) -> a nap első pillanata ISO időbélyegként; érvénytelen értékre `undefined`. */
export const startOfDayIso = (day: string): string | undefined => {
  const date = new Date(`${day}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** `YYYY-MM-DD` (helyi nap) -> a nap utolsó ezredmásodperce ISO időbélyegként. */
export const endOfDayIso = (day: string): string | undefined => {
  const date = new Date(`${day}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
