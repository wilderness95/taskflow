import { DEFAULT_PRIORITY, parseTags, type ChecklistItem, type Priority } from '@taskflow/shared'
import { createId } from '../../shared/lib/ids'
import type { Task } from '../boards/types'

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

// A checklist alapértelmezett címe fordítandó szöveg, ezért a hívó (UI) adja át `t()`-ből.
export const createEmptyDraft = (columnId: string, defaultChecklistTitle: string): TaskDraft => ({
  title: '',
  description: '',
  priority: DEFAULT_PRIORITY,
  column: columnId,
  dueDate: '',
  tags: '',
  checklistTitle: defaultChecklistTitle,
  checklistItems: [],
})

export const createDraftFromTask = (
  task: Task,
  columnId: string,
  defaultChecklistTitle: string,
): TaskDraft => ({
  title: task.title,
  description: task.description,
  priority: task.priority,
  column: columnId,
  dueDate: task.dueDate ?? '',
  tags: task.tags.map((tag) => tag.label).join(', '),
  checklistTitle: task.checklist?.title ?? defaultChecklistTitle,
  checklistItems: task.checklist?.items ?? [],
})

type BuildTaskOptions = {
  id: string
  /** A céloszlop "kész" oszlop-e. */
  done: boolean
  /** Ezt kapja a checklist, ha a felhasználó üresen hagyta a címét. */
  defaultChecklistTitle: string
}

export const buildTaskFromDraft = (
  draft: TaskDraft,
  { id, done, defaultChecklistTitle }: BuildTaskOptions,
): Task => ({
  id,
  title: draft.title.trim(),
  // Üres leírás üresen tárolódik; a "nincs leírás" feliratot a megjelenítés adja.
  description: draft.description.trim(),
  priority: draft.priority,
  done,
  dueDate: draft.dueDate,
  tags: parseTags(draft.tags),
  checklist: {
    title: draft.checklistTitle.trim() || defaultChecklistTitle,
    items: draft.checklistItems
      .filter((item) => item.text.trim())
      .map((item) => ({
        id: item.id ?? createId('item'),
        text: item.text.trim(),
        done: Boolean(item.done),
      })),
  },
})
