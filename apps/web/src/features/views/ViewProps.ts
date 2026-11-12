import type { Columns, Task } from '../boards/types'

/** A Lista, Naptár és Idővonal nézetek közös tulajdonságai. */
export type ViewProps = {
  /** A szűrt oszlopok (ugyanaz, mint a Kanban nézeté). */
  columns: Columns
  /** A kártya megnyitása szerkesztésre; olvasási jognál nincs. */
  onOpenTask?: (columnId: string, task: Task) => void
}
