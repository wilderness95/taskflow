import { DEFAULT_PRIORITY, parseTags, type Priority } from '@taskflow/shared'
import { createId } from '../../shared/lib/ids'
import type { Assignee, Task, TaskChecklist } from '../boards/types'

/** A kártya szerkesztőűrlapjának állapota (a mezők még szövegként, nyers formában). */
export type TaskDraft = {
  title: string
  description: string
  priority: Priority
  column: string
  dueDate: string
  /** Vesszővel elválasztott címkék. */
  tags: string
  assigneeIds: string[]
  checklists: TaskChecklist[]
}

export const createEmptyDraft = (columnId: string): TaskDraft => ({
  title: '',
  description: '',
  priority: DEFAULT_PRIORITY,
  column: columnId,
  dueDate: '',
  tags: '',
  assigneeIds: [],
  checklists: [],
})

export const createDraftFromTask = (task: Task, columnId: string): TaskDraft => ({
  title: task.title,
  description: task.description,
  priority: task.priority,
  column: columnId,
  dueDate: task.dueDate ?? '',
  tags: task.tags.map((tag) => tag.label).join(', '),
  assigneeIds: task.assignees.map((assignee) => assignee.id),
  checklists: task.checklists.map((checklist) => ({
    ...checklist,
    items: checklist.items.map((item) => ({ ...item })),
  })),
})

type BuildTaskOptions = {
  id: string
  /** A céloszlop "kész" oszlop-e. */
  done: boolean
  /** Ezt kapja a checklist, ha a felhasználó üresen hagyta a címét. */
  defaultChecklistTitle: string
  /** A tábla résztvevői: ebből oldódnak fel a kiválasztott felelősök. */
  participants?: Assignee[]
}

export const buildTaskFromDraft = (
  draft: TaskDraft,
  { id, done, defaultChecklistTitle, participants = [] }: BuildTaskOptions,
): Task => ({
  id,
  title: draft.title.trim(),
  // Üres leírás üresen tárolódik; a "nincs leírás" feliratot a megjelenítés adja.
  description: draft.description.trim(),
  priority: draft.priority,
  done,
  dueDate: draft.dueDate,
  tags: parseTags(draft.tags),
  assignees: draft.assigneeIds.map(
    (assigneeId) =>
      participants.find((p) => p.id === assigneeId) ?? {
        id: assigneeId,
        name: '?',
        avatarUrl: null,
      },
  ),
  checklists: draft.checklists.map((checklist) => ({
    id: checklist.id,
    title: checklist.title.trim() || defaultChecklistTitle,
    items: checklist.items
      .filter((item) => item.text.trim())
      .map((item) => ({
        id: item.id ?? createId('item'),
        text: item.text.trim(),
        done: Boolean(item.done),
      })),
  })),
})
