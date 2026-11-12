import type { ListDetailDto, ListItemDto } from '@taskflow/shared'

/** Egy tétel mezőinek helyi (optimista) átírása a lista gyorsítótárában; az összesítő is követi. */
export function patchListItem(
  list: ListDetailDto,
  itemId: string,
  patch: Partial<Pick<ListItemDto, 'text' | 'done' | 'recurring'>>,
): ListDetailDto {
  const items = list.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
  return { ...list, items, doneCount: items.filter((i) => i.done).length }
}
