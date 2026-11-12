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
import { LabelsModal } from '../labels/LabelsModal'
import { BoardArchiveModal } from '../archive/BoardArchiveModal'
import { BoardActivityModal } from '../activity/BoardActivityModal'
import { BoardMembersModal } from './BoardMembersModal'
import type { Assignee, ColumnAccent, Columns, Dialog, Task } from './types'

type BoardDialogsProps = {
  dialog: Dialog | null
  columns: Columns
  participants: Assignee[]
  onClose: () => void
  onSaveTask: (task: Task, columnId: string, originalColumnId?: string) => void
  onUpdateColumn: (columnId: string, title: string, accent: ColumnAccent) => void
  onDeleteColumn: (columnId: string) => void
  onArchiveBoard: () => void
  boardId: string
  workspaceId: string
  canManageMembers: boolean
  canWrite: boolean
  isBoardAdmin: boolean
}

export function BoardDialogs({
  dialog,
  columns,
  participants,
  onClose,
  onSaveTask,
  onUpdateColumn,
  onDeleteColumn,
  onArchiveBoard,
  boardId,
  workspaceId,
  canManageMembers,
  canWrite,
  isBoardAdmin,
}: BoardDialogsProps) {
  const { t } = useTranslation(['card', 'column', 'archive'])

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
          participants,
        })
        // A szerkesztés a megnyitáskor látott verzióra épül: közbeni módosításnál konfliktus lesz.
        onSaveTask(
          isEdit ? { ...task, version: dialog.task.version } : task,
          draft.column,
          isEdit ? dialog.columnId : undefined,
        )
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
          participants={participants}
          discussion={isEdit ? { boardId, cardId: dialog.task.id, isBoardAdmin } : undefined}
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

    case 'labels':
      return <LabelsModal boardId={boardId} canEdit={canWrite} onClose={onClose} />

    case 'archive':
      return <BoardArchiveModal boardId={boardId} canRestore={canWrite} onClose={onClose} />

    case 'board-archive':
      return (
        <ConfirmModal
          eyebrow={t('archive:board.eyebrow')}
          title={t('archive:board.title')}
          message={t('archive:board.message')}
          confirmLabel={t('archive:board.confirm')}
          onConfirm={() => {
            onArchiveBoard()
            onClose()
          }}
          onClose={onClose}
        />
      )

    case 'activity':
      return <BoardActivityModal boardId={boardId} onClose={onClose} />

    case 'members':
      return (
        <BoardMembersModal
          boardId={boardId}
          workspaceId={workspaceId}
          canManage={canManageMembers}
          onClose={onClose}
        />
      )
  }
}
