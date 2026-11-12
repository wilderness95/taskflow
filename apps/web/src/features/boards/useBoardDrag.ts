import { useState, type DragEvent, type HTMLAttributes } from 'react'

export type DragProps = Pick<
  HTMLAttributes<HTMLElement>,
  'draggable' | 'onDragStart' | 'onDragEnd' | 'onDragOver' | 'onDragEnter' | 'onDrop'
>

type TaskDragState = {
  activeTaskId: string | null
  sourceColumnId: string | null
  targetColumnId: string | null
  targetTaskId: string | null
}

type ColumnDragState = {
  activeColumnId: string | null
  targetColumnId: string | null
}

const IDLE_TASK_DRAG: TaskDragState = {
  activeTaskId: null,
  sourceColumnId: null,
  targetColumnId: null,
  targetTaskId: null,
}

const NO_DRAG: DragProps = {}

const IDLE_COLUMN_DRAG: ColumnDragState = { activeColumnId: null, targetColumnId: null }

type UseBoardDragOptions = {
  onMoveTask: (
    taskId: string,
    fromColumnId: string,
    toColumnId: string,
    targetTaskId: string | null,
  ) => void
  onReorderColumns: (sourceColumnId: string, targetColumnId: string) => void
  /** Olvasási joggal nincs húzás: a props-ok üresek, az elemek nem húzhatók. */
  enabled?: boolean
}

const allowMove = (event: DragEvent) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

/**
 * A tábla drag & drop állapota és eseménykezelői (kártyák és oszlopok húzása).
 * A komponensek a `get*Props` függvények eredményét terjesztik szét az elemeikre.
 */
export function useBoardDrag({
  onMoveTask,
  onReorderColumns,
  enabled = true,
}: UseBoardDragOptions) {
  const [taskDrag, setTaskDrag] = useState<TaskDragState>(IDLE_TASK_DRAG)
  const [columnDrag, setColumnDrag] = useState<ColumnDragState>(IDLE_COLUMN_DRAG)

  const endTaskDrag = () => setTaskDrag(IDLE_TASK_DRAG)
  const endColumnDrag = () => setColumnDrag(IDLE_COLUMN_DRAG)

  const dropTask = (targetColumnId: string, targetTaskId: string | null = null) => {
    const { activeTaskId, sourceColumnId } = taskDrag
    endTaskDrag()

    if (!activeTaskId || !sourceColumnId) {
      return
    }

    const droppedOnSelf = targetTaskId === activeTaskId
    const droppedOnOwnColumn = sourceColumnId === targetColumnId && !targetTaskId
    if (droppedOnSelf || droppedOnOwnColumn) {
      return
    }

    onMoveTask(activeTaskId, sourceColumnId, targetColumnId, targetTaskId)
  }

  const hoverColumn = (columnId: string) => {
    if (columnDrag.activeColumnId) {
      if (columnDrag.activeColumnId !== columnId) {
        setColumnDrag((current) => ({ ...current, targetColumnId: columnId }))
      }
      return
    }

    if (taskDrag.activeTaskId) {
      setTaskDrag((current) => ({ ...current, targetColumnId: columnId, targetTaskId: null }))
    }
  }

  const getColumnProps = (columnId: string): DragProps =>
    enabled ? columnProps(columnId) : NO_DRAG
  const columnProps = (columnId: string): DragProps => ({
    draggable: true,
    onDragStart: (event) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', columnId)
      setColumnDrag({ activeColumnId: columnId, targetColumnId: columnId })
    },
    onDragEnd: endColumnDrag,
    onDragOver: (event) => {
      allowMove(event)
      hoverColumn(columnId)
    },
    onDragEnter: () => hoverColumn(columnId),
    onDrop: (event) => {
      event.preventDefault()

      if (columnDrag.activeColumnId) {
        if (columnDrag.activeColumnId !== columnId) {
          onReorderColumns(columnDrag.activeColumnId, columnId)
        }
        endColumnDrag()
        return
      }

      dropTask(columnId)
    },
  })

  const getTaskProps = (columnId: string, taskId: string): DragProps =>
    enabled ? taskProps(columnId, taskId) : NO_DRAG
  const taskProps = (columnId: string, taskId: string): DragProps => ({
    draggable: true,
    onDragStart: (event) => {
      // Ne induljon el a kártyát tartalmazó oszlop húzása is.
      event.stopPropagation()
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', taskId)
      setTaskDrag({
        activeTaskId: taskId,
        sourceColumnId: columnId,
        targetColumnId: columnId,
        targetTaskId: null,
      })
    },
    onDragEnd: endTaskDrag,
    onDragOver: (event) => {
      // Oszlop húzásakor az esemény az oszlopig buborékol.
      if (!taskDrag.activeTaskId) {
        return
      }
      allowMove(event)
      event.stopPropagation()
      setTaskDrag((current) => ({ ...current, targetColumnId: columnId, targetTaskId: taskId }))
    },
    onDrop: (event) => {
      if (!taskDrag.activeTaskId) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      dropTask(columnId, taskId)
    },
  })

  /** Az üres oszlop "+ Kártya hozzáadása" gombja is dobási cél. */
  const getEmptyColumnProps = (columnId: string): DragProps =>
    enabled ? emptyColumnProps(columnId) : NO_DRAG
  const emptyColumnProps = (columnId: string): DragProps => ({
    onDragOver: (event) => {
      if (!taskDrag.activeTaskId) {
        return
      }
      allowMove(event)
      setTaskDrag((current) => ({ ...current, targetColumnId: columnId, targetTaskId: null }))
    },
    onDrop: (event) => {
      if (!taskDrag.activeTaskId) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      dropTask(columnId)
    },
  })

  return { taskDrag, columnDrag, getColumnProps, getTaskProps, getEmptyColumnProps }
}

export type BoardDrag = ReturnType<typeof useBoardDrag>
