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

/** ISO időbélyeg -> dátum és idő (pl. "2026. nov. 14. 10:30"). */
export const formatDateTime = (isoTimestamp: string): string =>
  new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(isoTimestamp),
  )

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(locale(), options).format(value)

/** Bájtok olvasható mérete (B / KB / MB); a mértékegység-jelek nyelvfüggetlenek. */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${formatNumber(bytes)} B`
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, { maximumFractionDigits: 1 })} KB`
  return `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`
}

/** Hónap és év (pl. "2026. november"). */
export const formatMonthYear = (year: number, monthIndex: number): string =>
  new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'long' }).format(
    new Date(year, monthIndex, 1),
  )

/** Egy nap rövid hétköznapneve (pl. "H"/"hétfő" a nyelvtől függően). */
export const formatWeekday = (isoDate: string, width: 'short' | 'long' = 'short'): string =>
  new Intl.DateTimeFormat(locale(), { weekday: width }).format(parseIsoDate(isoDate))

/** `YYYY-MM-DD` -> a hónap napja (pl. "14"). */
export const formatDayOfMonth = (isoDate: string): string =>
  new Intl.DateTimeFormat(locale(), { day: 'numeric' }).format(parseIsoDate(isoDate))

/** `YYYY-MM-DD` -> hosszabb dátum (pl. "2026. nov. 14."). */
export const formatMediumDate = (isoDate: string): string =>
  new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(parseIsoDate(isoDate))
