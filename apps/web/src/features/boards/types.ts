import {
  TAG_COLORS,
  type ChecklistItem,
  type Priority,
  type Tag,
  type TagColor,
} from '@taskflow/shared'

export const COLUMN_ACCENTS = TAG_COLORS

export type ColumnAccent = TagColor

/** A kártyához rendelt felhasználó megjelenítéshez szükséges adatai. */
export type Assignee = { id: string; name: string; avatarUrl: string | null }

/** A checklist a szerkesztő számára; az `id` szerveroldali, vagy (új listánál) kliensoldali ideiglenes. */
export type TaskChecklist = { id: string; title: string; items: ChecklistItem[] }

export type Task = {
  id: string
  title: string
  description: string
  priority: Priority
  tags: Tag[]
  /** A kártya címkéinek azonosítói (a szűréshez; a `tags` a megjelenítéshez). */
  labelIds: string[]
  dueDate?: string
  coverImage?: string
  /** A borítóként használt csatolmány (kép) azonosítója. */
  coverAttachmentId?: string
  attachmentCount: number
  /** A kártya létrehozásának időpontja (ISO); az idővonal a sáv kezdetét ebből veszi. */
  createdAt?: string
  done?: boolean
  /** A kártya checklistjei (több is lehet). */
  checklists: TaskChecklist[]
  assignees: Assignee[]
  /** A kártya szerveroldali verziója a betöltéskor (optimista zároláshoz); új kártyának nincs. */
  version?: number
}

export type Column = {
  title: string
  accent: ColumnAccent
  /** A "kész" oszlopba kerülő kártyák késznek számítanak. */
  done: boolean
  tasks: Task[]
}

/** Oszlopok ID szerint; a kulcsok sorrendje az oszlopok megjelenítési sorrendje. */
export type Columns = Record<string, Column>

export type Visibility = 'private' | 'workspace' | 'public'

export type BoardView = 'kanban' | 'list' | 'calendar' | 'timeline'

/** A táblán egyszerre legfeljebb egy párbeszédablak lehet nyitva. */
export type Dialog =
  | { type: 'card-create'; columnId: string }
  | { type: 'card-edit'; columnId: string; task: Task }
  | { type: 'column-rename'; columnId: string }
  | { type: 'column-delete'; columnId: string }
  | { type: 'members' }
  | { type: 'activity' }
  | { type: 'archive' }
  | { type: 'labels' }
  | { type: 'board-archive' }
