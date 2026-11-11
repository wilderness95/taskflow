import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['card', 'column'])

  if (!dialog) {
    return null
  }

  const defaultChecklistTitle = t('card:checklist.defaultTitle')

  switch (dialog.type) {
    case 'card-create':
    case 'card-edit': {
      const isEdit = dialog.type === 'card-edit'

      const handleSave = (draft: TaskDraft) => {
        const task = buildTaskFromDraft(draft, {
          id: isEdit ? dialog.task.id : createId('task'),
          done: Boolean(columns[draft.column]?.done),
          defaultChecklistTitle,
        })
        onSaveTask(task, draft.column, isEdit ? dialog.columnId : undefined)
        onClose()
      }

      return (
        <CardModal
          mode={isEdit ? 'edit' : 'create'}
          initialDraft={
            isEdit
              ? createDraftFromTask(dialog.task, dialog.columnId, defaultChecklistTitle)
              : createEmptyDraft(dialog.columnId, defaultChecklistTitle)
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
          eyebrow={t('column:delete.eyebrow')}
          title={t('column:delete.title')}
          message={t('column:delete.message')}
          confirmLabel={t('column:delete.confirm')}
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
