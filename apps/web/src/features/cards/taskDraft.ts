import { DEFAULT_PRIORITY, parseTags, type ChecklistItem, type Priority } from '@taskflow/shared'
import { createId } from '../../shared/lib/ids'
import type { Task } from '../boards/types'

// Átmeneti szövegek: az i18n lépésben kerülnek a fordítási fájlokba.
export const DEFAULT_CHECKLIST_TITLE = 'Content Checklist'
export const EMPTY_DESCRIPTION = 'Nincs hozzácsatolt leírás.'

/** A kártya szerkesztőűrlapjának állapota (a mezők még szövegként, nyers formában). */
export type TaskDraft = {
  title: string
  description: string
  priority: Priority
  column: string
  dueDate: string
  /** Vesszővel elválasztott címkék. */
  tags: string
  checklistTitle: string
  checklistItems: ChecklistItem[]
}

export const createEmptyDraft = (columnId: string): TaskDraft => ({
  title: '',
  description: '',
  priority: DEFAULT_PRIORITY,
  column: columnId,
  dueDate: '',
  tags: '',
  checklistTitle: DEFAULT_CHECKLIST_TITLE,
  checklistItems: [],
})

export const createDraftFromTask = (task: Task, columnId: string): TaskDraft => ({
  title: task.title,
  description: task.description,
  priority: task.priority,
  column: columnId,
  dueDate: task.dueDate ?? '',
  tags: task.tags.map((tag) => tag.label).join(', '),
  checklistTitle: task.checklist?.title ?? DEFAULT_CHECKLIST_TITLE,
  checklistItems: task.checklist?.items ?? [],
})

type BuildTaskOptions = {
  id: string
  /** A céloszlop "kész" oszlop-e. */
  done: boolean
}

export const buildTaskFromDraft = (draft: TaskDraft, { id, done }: BuildTaskOptions): Task => ({
  id,
  title: draft.title.trim(),
  description: draft.description.trim() || EMPTY_DESCRIPTION,
  priority: draft.priority,
  done,
  dueDate: draft.dueDate,
  tags: parseTags(draft.tags),
  checklist: {
    title: draft.checklistTitle.trim() || DEFAULT_CHECKLIST_TITLE,
    items: draft.checklistItems
      .filter((item) => item.text.trim())
      .map((item) => ({
        id: item.id ?? createId('item'),
        text: item.text.trim(),
        done: Boolean(item.done),
      })),
  },
})
