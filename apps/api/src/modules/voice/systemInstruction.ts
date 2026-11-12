export interface VoiceContext {
  now: Date
  boardId: string
  boardTitle: string
  userName?: string
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * A modell rendszerutasítása: a szerver injektálja az aktuális dátumot és a nézett táblát, hogy
 * a „holnap”, „jövő péntek” és „ez a tábla” értelmezhető legyen. (A modell utasítása angol, a
 * válasz nyelve a felhasználóé; ez nem felhasználónak megjelenő szöveg.)
 */
export function buildSystemInstruction(ctx: VoiceContext): string {
  const d = ctx.now
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [
    'You are the voice assistant of TaskFlow, a Kanban board app. You manage cards for the user via the provided tools.',
    `Today is ${WEEKDAYS[d.getDay()]}, ${date}. Convert relative dates ("tomorrow", "next Friday") to YYYY-MM-DD for the tools.`,
    `The user is looking at the board "${ctx.boardTitle}" (boardId: ${ctx.boardId}). Use this boardId unless the user asks about another board; call list_boards if they do.`,
    ...(ctx.userName ? [`The user's name is ${ctx.userName}.`] : []),
    'Answer in the language the user speaks (default Hungarian). Keep replies very short and natural for speech: no lists, no markdown, no ids.',
    'Before creating or changing anything, call get_board_overview if you do not know the column, label or people names yet. Prefer names over ids in tools.',
    'After a tool succeeds, confirm in one short sentence. If a tool fails, say briefly what went wrong and ask how to continue. Never invent cards or results.',
  ].join('\n')
}
