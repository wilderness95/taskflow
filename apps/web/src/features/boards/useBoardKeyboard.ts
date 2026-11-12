import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useHotkeys } from '../../shared/hooks/useHotkeys'
import { VIEWS } from './boardOptions'
import { computeColumnMove, computeTaskMove, type MoveDirection } from './keyboardMove'
import type { BoardView, Columns, Dialog } from './types'

type UseBoardKeyboardOptions = {
  columns: Columns
  canWrite: boolean
  dialog: Dialog | null
  setDialog: Dispatch<SetStateAction<Dialog | null>>
  setActiveView: (view: BoardView) => void
  toggleFilters: () => void
  moveTask: (
    taskId: string,
    fromColumnId: string,
    toColumnId: string,
    before: string | null,
  ) => void
  reorderColumns: (sourceId: string, targetId: string) => void
}

/**
 * A tábla billentyűzetes kezelése: gyorsbillentyűk (`n`, `/`, `f`, `?`, `1`-`4`), valamint a
 * kártyák és oszlopok Alt + nyíl áthelyezése. Az áthelyezést képernyőolvasónak felolvasható
 * üzenet (`announcement`, aria-live) követi, és a fókusz az áthelyezett elemen marad.
 */
export function useBoardKeyboard({
  columns,
  canWrite,
  dialog,
  setDialog,
  setActiveView,
  toggleFilters,
  moveTask,
  reorderColumns,
}: UseBoardKeyboardOptions) {
  const { t } = useTranslation('board')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const pendingFocus = useRef<string | null>(null)

  // Az áthelyezett elem újrarajzolása (pl. másik oszlopba kerülés) után visszakapja a fókuszt.
  useEffect(() => {
    const selector = pendingFocus.current
    if (!selector) return
    pendingFocus.current = null
    document.querySelector<HTMLElement>(selector)?.focus()
  }, [columns])

  const moveTaskByKey = (columnId: string, taskId: string, direction: MoveDirection) => {
    const move = computeTaskMove(columns, columnId, taskId, direction)
    if (!move) return
    const task = columns[columnId]?.tasks.find((candidate) => candidate.id === taskId)
    pendingFocus.current = `[data-task-id="${taskId}"]`
    moveTask(taskId, columnId, move.toColumnId, move.targetTaskId)
    setAnnouncement(
      t('a11y.taskMoved', {
        title: task?.title ?? '',
        column: columns[move.toColumnId]?.title ?? '',
        position: move.position,
        total: move.total,
      }),
    )
  }

  const moveColumnByKey = (columnId: string, direction: 'left' | 'right') => {
    const move = computeColumnMove(columns, columnId, direction)
    if (!move) return
    pendingFocus.current = `[data-column-id="${columnId}"]`
    reorderColumns(columnId, move.targetColumnId)
    setAnnouncement(
      t('a11y.columnMoved', {
        title: columns[columnId]?.title ?? '',
        position: move.position,
        total: move.total,
      }),
    )
  }

  const firstColumnId = Object.keys(columns)[0]
  const viewBindings = Object.fromEntries(
    VIEWS.map((view, index) => [String(index + 1), () => setActiveView(view)]),
  )
  useHotkeys(
    {
      ...viewBindings,
      '/': () => searchInputRef.current?.focus(),
      f: toggleFilters,
      '?': () => setDialog({ type: 'shortcuts' }),
      n: () => {
        if (canWrite && firstColumnId) setDialog({ type: 'card-create', columnId: firstColumnId })
      },
    },
    dialog === null,
  )

  return { searchInputRef, announcement, moveTaskByKey, moveColumnByKey }
}
