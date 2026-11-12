import type { Columns } from './types'

export type MoveDirection = 'up' | 'down' | 'left' | 'right'

export type TaskMove = {
  toColumnId: string
  /** A kártya ez elé kerül; `null`: az oszlop végére. */
  targetTaskId: string | null
  /** Az új hely az oszlopban (1-től) és az oszlop kártyáinak száma a mozgatás után. */
  position: number
  total: number
}

/**
 * Egy kártya billentyűzetes áthelyezése: fel/le az oszlopon belül egy hellyel, balra/jobbra a
 * szomszédos oszlopba, ugyanarra a sorszámra (vagy az oszlop végére). `null`, ha nincs hová.
 */
export function computeTaskMove(
  columns: Columns,
  columnId: string,
  taskId: string,
  direction: MoveDirection,
): TaskMove | null {
  const ids = Object.keys(columns)
  const tasks = columns[columnId]?.tasks ?? []
  const index = tasks.findIndex((task) => task.id === taskId)
  if (index === -1) return null

  if (direction === 'up') {
    if (index === 0) return null
    return {
      toColumnId: columnId,
      targetTaskId: tasks[index - 1]!.id,
      position: index,
      total: tasks.length,
    }
  }
  if (direction === 'down') {
    if (index === tasks.length - 1) return null
    return {
      toColumnId: columnId,
      targetTaskId: tasks[index + 2]?.id ?? null,
      position: index + 2,
      total: tasks.length,
    }
  }

  const toColumnId = ids[ids.indexOf(columnId) + (direction === 'left' ? -1 : 1)]
  if (!toColumnId) return null
  const targetTasks = columns[toColumnId]?.tasks ?? []
  const position = Math.min(index, targetTasks.length)
  return {
    toColumnId,
    targetTaskId: targetTasks[position]?.id ?? null,
    position: position + 1,
    total: targetTasks.length + 1,
  }
}

export type ColumnMove = {
  /** A szomszédos oszlop, amellyel a hely cserélődik (a `reorderColumns` célja). */
  targetColumnId: string
  position: number
  total: number
}

/** Egy oszlop billentyűzetes áthelyezése balra/jobbra egy hellyel; `null`, ha nincs hová. */
export function computeColumnMove(
  columns: Columns,
  columnId: string,
  direction: 'left' | 'right',
): ColumnMove | null {
  const ids = Object.keys(columns)
  const index = ids.indexOf(columnId)
  const targetIndex = index + (direction === 'left' ? -1 : 1)
  const targetColumnId = ids[targetIndex]
  if (index === -1 || !targetColumnId) return null
  return { targetColumnId, position: targetIndex + 1, total: ids.length }
}

/** Az Alt + nyíl billentyű iránya; más billentyű `null`. */
const KEY_DIRECTIONS: Record<string, MoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

export const directionFromKey = (key: string): MoveDirection | null => KEY_DIRECTIONS[key] ?? null
