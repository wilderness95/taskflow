import {
  TAG_COLORS,
  type ChecklistLike,
  type Priority,
  type Tag,
  type TagColor,
} from '@taskflow/shared'

export const COLUMN_ACCENTS = TAG_COLORS

export type ColumnAccent = TagColor

export type Task = {
  id: string
  title: string
  description: string
  priority: Priority
  tags: Tag[]
  dueDate?: string
  coverImage?: string
  done?: boolean
  checklist?: ChecklistLike
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
