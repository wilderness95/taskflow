import type { ListItemDto, ListSectionDto } from './schemas/list'

export type ListGroup<S extends { id: string } = ListSectionDto> = {
  /** `null`: a szakasz nélküli tételek csoportja. */
  section: S | null
  items: ListItemDto[]
}

const byPosition = <T extends { position: string; id: string }>(a: T, b: T) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : 1

/**
 * A lista megjelenítési csoportjai: elöl a szakasz nélküli tételek (ha vannak), utána a szakaszok
 * sorrendben (az üresek is, hogy lehessen beléjük húzni); a tételek `position` szerint rendezettek.
 */
export function groupListItems(sections: ListSectionDto[], items: ListItemDto[]): ListGroup[] {
  const known = new Set(sections.map((s) => s.id))
  const sorted = [...items].sort(byPosition)
  const loose = sorted.filter((i) => !i.sectionId || !known.has(i.sectionId))
  const groups: ListGroup[] = []
  if (loose.length > 0) groups.push({ section: null, items: loose })
  for (const section of [...sections].sort(byPosition)) {
    groups.push({ section, items: sorted.filter((i) => i.sectionId === section.id) })
  }
  return groups
}

/** A kipipált tételek közül a „kipipáltak törlése” által törölhetők (nem ismétlődők). */
export const clearableItems = (items: ListItemDto[]): ListItemDto[] =>
  items.filter((i) => i.done && !i.recurring)

/** A kipipált tételek közül a „visszaállítás” által újranyitandók (ismétlődők). */
export const resettableItems = (items: ListItemDto[]): ListItemDto[] =>
  items.filter((i) => i.done && i.recurring)

export const listProgress = (items: Pick<ListItemDto, 'done'>[]) => ({
  done: items.filter((i) => i.done).length,
  total: items.length,
})
