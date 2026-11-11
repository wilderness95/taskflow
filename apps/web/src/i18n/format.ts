import i18n from './index'

/**
 * Dátum- és számformázás az aktuális nyelv szerint. Máshol tilos beégetett locale-t
 * (`'hu-HU'`) vagy `toLocale*`-t használni (lásd conventions.test.ts).
 */
const locale = () => i18n.language

const parseIsoDate = (isoDate: string) => new Date(`${isoDate}T12:00:00`)

/** `YYYY-MM-DD` -> rövid dátum (pl. "nov. 14."). */
export const formatShortDate = (isoDate: string): string =>
  new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric' }).format(
    parseIsoDate(isoDate),
  )

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(locale(), options).format(value)
