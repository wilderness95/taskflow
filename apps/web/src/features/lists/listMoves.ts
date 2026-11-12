import type { ListGroup } from '@taskflow/shared'

export type ItemMoveTarget = { sectionId: string | null; beforeItemId: string | null }
export type MoveDirection = 'up' | 'down'

/**
 * Egy tétel billentyűzetes (Alt + nyíl) áthelyezésének célja: a csoporton belül egyet fel/le,
 * a csoport szélén a szomszédos csoportba (felfelé annak végére, lefelé az elejére).
 * `null`, ha nincs hová mozdítani.
 */
export function computeItemMove(
  groups: ListGroup[],
  itemId: string,
  direction: MoveDirection,
): ItemMoveTarget | null {
  const g = groups.findIndex((group) => group.items.some((i) => i.id === itemId))
  if (g === -1) return null
  const group = groups[g]!
  const i = group.items.findIndex((item) => item.id === itemId)
  const sectionId = group.section?.id ?? null

  if (direction === 'up') {
    if (i > 0) return { sectionId, beforeItemId: group.items[i - 1]!.id }
    const prev = groups[g - 1]
    return prev ? { sectionId: prev.section?.id ?? null, beforeItemId: null } : null
  }
  if (i < group.items.length - 1) {
    return { sectionId, beforeItemId: group.items[i + 2]?.id ?? null }
  }
  const next = groups[g + 1]
  return next
    ? { sectionId: next.section?.id ?? null, beforeItemId: next.items[0]?.id ?? null }
    : null
}
