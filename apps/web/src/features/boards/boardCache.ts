import type { BoardDto, CardDto } from '@taskflow/shared'

/**
 * Az optimista frissítések tiszta függvényei a gyorsítótárazott `BoardDto`-n.
 * Csak a sorrendet (tömbsorrend) és az oszlop-hivatkozást módosítják; a `position`
 * értékeket a szerver számolja, a mutáció utáni újratöltés hozza át.
 */

const insertBefore = <T extends { id: string }>(items: T[], item: T, beforeId?: string | null) => {
  const next = [...items]
  const index = beforeId ? next.findIndex((entry) => entry.id === beforeId) : -1
  next.splice(index >= 0 ? index : next.length, 0, item)
  return next
}

/** A kártya a `beforeCardId` elé kerül a cél oszlopban, ennek hiányában a végére (mint a szerveren). */
export function moveCardInBoard(
  board: BoardDto,
  cardId: string,
  columnId: string,
  beforeCardId?: string | null,
): BoardDto {
  const card = board.columns.flatMap((column) => column.cards).find((item) => item.id === cardId)
  if (!card || !board.columns.some((column) => column.id === columnId) || beforeCardId === cardId) {
    return board
  }
  const moved: CardDto = { ...card, columnId }

  return {
    ...board,
    columns: board.columns.map((column) => {
      const without = column.cards.filter((item) => item.id !== cardId)
      return column.id === columnId
        ? { ...column, cards: insertBefore(without, moved, beforeCardId) }
        : { ...column, cards: without }
    }),
  }
}

export function moveColumnInBoard(
  board: BoardDto,
  columnId: string,
  beforeColumnId?: string | null,
): BoardDto {
  const column = board.columns.find((item) => item.id === columnId)
  if (!column || beforeColumnId === columnId) {
    return board
  }
  const others = board.columns.filter((item) => item.id !== columnId)
  return { ...board, columns: insertBefore(others, column, beforeColumnId) }
}
