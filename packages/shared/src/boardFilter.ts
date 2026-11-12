import type { Priority } from './priority'
import { getDueDateState, type DueDateState } from './dueDate'

/** Haladó kártyaszűrő: a csoporton belül VAGY, a csoportok között ÉS kapcsolat van. */
export type BoardFilter = {
  priorities: Priority[]
  labelIds: string[]
  assigneeIds: string[]
  /** A határidő állapota (`none`: nincs határidő). */
  due: DueDateState[]
}

export const EMPTY_BOARD_FILTER: BoardFilter = {
  priorities: [],
  labelIds: [],
  assigneeIds: [],
  due: [],
}

export type FilterableCard = {
  priority: Priority
  labelIds: readonly string[]
  assigneeIds: readonly string[]
  dueDate?: string | null
}

export const isBoardFilterEmpty = (filter: BoardFilter): boolean =>
  filter.priorities.length === 0 &&
  filter.labelIds.length === 0 &&
  filter.assigneeIds.length === 0 &&
  filter.due.length === 0

/** Hány szűrőfeltétel (kiválasztott érték) aktív; a UI jelvényéhez. */
export const countActiveFilters = (filter: BoardFilter): number =>
  filter.priorities.length + filter.labelIds.length + filter.assigneeIds.length + filter.due.length

export function matchesBoardFilter(
  card: FilterableCard,
  filter: BoardFilter,
  now: Date = new Date(),
): boolean {
  if (filter.priorities.length > 0 && !filter.priorities.includes(card.priority)) return false
  if (filter.labelIds.length > 0 && !filter.labelIds.some((id) => card.labelIds.includes(id))) {
    return false
  }
  if (
    filter.assigneeIds.length > 0 &&
    !filter.assigneeIds.some((id) => card.assigneeIds.includes(id))
  ) {
    return false
  }
  if (filter.due.length > 0 && !filter.due.includes(getDueDateState(card.dueDate, now))) {
    return false
  }
  return true
}
