/** Naptári napok `YYYY-MM-DD` formában, a helyi időzóna szerint (nincs UTC-eltolódás). */

const pad = (value: number) => String(value).padStart(2, '0')

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const parseIsoDate = (isoDate: string): Date => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const addDays = (isoDate: string, days: number): string => {
  const date = parseIsoDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** `to - from` napban (a nyári időszámítás váltása nem torzít). */
export const diffDays = (from: string, to: string): number =>
  Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000)

/** Hétfővel kezdődő hetek: a hónap napjai, kiegészítve az előző/következő hónap napjaival. */
export const buildMonthGrid = (year: number, monthIndex: number): string[][] => {
  const first = new Date(year, monthIndex, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = toIsoDate(new Date(year, monthIndex, 1 - mondayOffset))
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const weekCount = Math.ceil((mondayOffset + daysInMonth) / 7)
  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  )
}

/** A hónap léptetése (`delta` lehet negatív); az év átfordul. */
export const shiftMonth = (
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } => {
  const date = new Date(year, monthIndex + delta, 1)
  return { year: date.getFullYear(), monthIndex: date.getMonth() }
}
