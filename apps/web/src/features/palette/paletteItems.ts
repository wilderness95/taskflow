export type PaletteGroup = 'navigate' | 'workspace' | 'board' | 'list' | 'action'

export type PaletteItem = {
  id: string
  group: PaletteGroup
  label: string
  /** Kiegészítő szöveg (pl. a munkaterület neve); a keresés ezen is fut. */
  hint?: string
  run: () => void
}

/** Kisbetűs, ékezet nélküli alak: „Kenyér” és „kenyer” egyformán találat. */
export const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const score = (item: PaletteItem, query: string): number => {
  const label = normalize(item.label)
  if (label.startsWith(query)) return 0
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 1
  if (label.includes(query)) return 2
  if (normalize(item.hint ?? '').includes(query)) return 3
  return -1
}

/**
 * A lekérdezésre illő elemek, találat-minőség szerint rendezve (előtag, szó eleje, tartalmazás,
 * kiegészítő szöveg); azonos minőségnél az eredeti sorrend marad. Üres lekérdezés: minden elem.
 */
export function filterPaletteItems(items: PaletteItem[], rawQuery: string): PaletteItem[] {
  const query = normalize(rawQuery)
  if (!query) return items
  return items
    .map((item, index) => ({ item, index, rank: score(item, query) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item)
}
