import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import { createId } from '../../shared/lib/ids'
import { CardModal } from '../cards/CardModal'
import {
  buildTaskFromDraft,
  createDraftFromTask,
  createEmptyDraft,
  type TaskDraft,
} from '../cards/taskDraft'
import { RenameColumnModal } from '../columns/RenameColumnModal'
import { InviteModal } from '../workspaces/InviteModal'
import type { ColumnAccent, Columns, Dialog, Task } from './types'

type BoardDialogsProps = {
  dialog: Dialog | null
  columns: Columns
  onClose: () => void
  onSaveTask: (task: Task, columnId: string, originalColumnId?: string) => void
  onUpdateColumn: (columnId: string, title: string, accent: ColumnAccent) => void
  onDeleteColumn: (columnId: string) => void
}

export function BoardDialogs({
  dialog,
  columns,
  onClose,
  onSaveTask,
  onUpdateColumn,
  onDeleteColumn,
}: BoardDialogsProps) {
  if (!dialog) {
    return null
  }

  switch (dialog.type) {
    case 'card-create':
    case 'card-edit': {
      const isEdit = dialog.type === 'card-edit'

      const handleSave = (draft: TaskDraft) => {
        const task = buildTaskFromDraft(draft, {
          id: isEdit ? dialog.task.id : createId('task'),
          done: Boolean(columns[draft.column]?.done),
        })
        onSaveTask(task, draft.column, isEdit ? dialog.columnId : undefined)
        onClose()
      }

      return (
        <CardModal
          mode={isEdit ? 'edit' : 'create'}
          initialDraft={
            isEdit
              ? createDraftFromTask(dialog.task, dialog.columnId)
              : createEmptyDraft(dialog.columnId)
          }
          columns={columns}
          onSave={handleSave}
          onClose={onClose}
        />
      )
    }

    case 'column-rename': {
      const column = columns[dialog.columnId]
      if (!column) {
        return null
      }

      return (
        <RenameColumnModal
          column={column}
          onSave={(title, accent) => {
            onUpdateColumn(dialog.columnId, title, accent)
            onClose()
          }}
          onClose={onClose}
        />
      )
    }

    case 'column-delete':
      return (
        <ConfirmModal
          eyebrow="Oszlop törlése"
          title="Biztos vagy benne?"
          message="A törölt oszlopban lévő feladatok a szomszédos oszlopba kerülnek."
          confirmLabel="Törlés"
          onConfirm={() => {
            onDeleteColumn(dialog.columnId)
            onClose()
          }}
          onClose={onClose}
        />
      )

    case 'invite':
      return <InviteModal onClose={onClose} />
  }
}
