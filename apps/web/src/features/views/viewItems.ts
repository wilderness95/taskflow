import type { Columns, Task } from '../boards/types'
import { addDays, diffDays, toIsoDate } from './dates'

/** Egy kártya a nézetekhez: a feladat az oszlopával együtt. */
export type ViewItem = { task: Task; columnId: string; columnTitle: string; done: boolean }

/** Az oszlopok sorrendjében, az oszlopon belül a kártyák sorrendjében. */
export const flattenColumns = (columns: Columns): ViewItem[] =>
  Object.entries(columns).flatMap(([columnId, column]) =>
    column.tasks.map((task) => ({
      task,
      columnId,
      columnTitle: column.title,
      done: column.done,
    })),
  )

/** A határidős kártyák napok szerint csoportosítva (`YYYY-MM-DD` -> kártyák). */
export const groupByDueDate = (items: ViewItem[]): Map<string, ViewItem[]> => {
  const groups = new Map<string, ViewItem[]>()
  for (const item of items) {
    if (!item.task.dueDate) continue
    groups.set(item.task.dueDate, [...(groups.get(item.task.dueDate) ?? []), item])
  }
  return groups
}

export type TimelineRow = {
  item: ViewItem
  /** A sáv első napja a tengelyen (0 = az első nap). */
  offset: number
  /** A sáv hossza napokban (legalább 1). */
  span: number
}

export type Timeline = {
  /** A tengely napjai (`YYYY-MM-DD`). */
  days: string[]
  rows: TimelineRow[]
  /** A határidő nélküli kártyák (nem kerülnek a tengelyre). */
  unscheduled: ViewItem[]
}

/** Ennyi napnál hosszabb tengelyt nem rajzolunk (a legkésőbbi határidőtől visszafelé számolva). */
export const MAX_TIMELINE_DAYS = 120
const MIN_TIMELINE_DAYS = 14

/**
 * Idővonal a határidős kártyákból: a sáv a kártya létrehozásától a határidejéig tart (ha a
 * határidő korábbi, mint a létrehozás, egynapos). A tengely a legkorábbi kezdettől a legkésőbbi
 * határidőig tart, legalább két hétig, és a mai napot mindig tartalmazza.
 */
export const buildTimeline = (items: ViewItem[], today: Date = new Date()): Timeline => {
  const scheduled = items.filter((item) => item.task.dueDate)
  const unscheduled = items.filter((item) => !item.task.dueDate)
  if (scheduled.length === 0) return { days: [], rows: [], unscheduled }

  const todayIso = toIsoDate(today)
  const spans = scheduled.map((item) => {
    const end = item.task.dueDate!
    const created = item.task.createdAt ? toIsoDate(new Date(item.task.createdAt)) : end
    return { item, start: created < end ? created : end, end }
  })

  const minStart = spans.reduce((min, s) => (s.start < min ? s.start : min), todayIso)
  const maxEnd = spans.reduce((max, s) => (s.end > max ? s.end : max), todayIso)
  const earliest = addDays(maxEnd, -(MAX_TIMELINE_DAYS - 1))
  const axisStart = minStart < earliest ? earliest : minStart
  const length = Math.max(MIN_TIMELINE_DAYS, diffDays(axisStart, maxEnd) + 1)
  const days = Array.from({ length }, (_, index) => addDays(axisStart, index))

  const rows = spans
    .map(({ item, start, end }) => {
      const from = start < axisStart ? axisStart : start
      const offset = diffDays(axisStart, from)
      return { item, offset, span: Math.max(1, diffDays(from, end) + 1), end }
    })
    // A tengelyen kívülre eső (túl régi) kártyák nem rajzolhatók.
    .filter((row) => row.end >= axisStart)
    .sort((a, b) => a.offset - b.offset || a.end.localeCompare(b.end))
    .map(({ item, offset, span }) => ({ item, offset, span }))

  return { days, rows, unscheduled }
}
