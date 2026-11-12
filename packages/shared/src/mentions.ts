/** @említések a hozzászólás szövegében: `@Név` (a név szóközt is tartalmazhat). */
export type Mentionable = { id: string; name: string }

export type BodySegment = { text: string; mention: Mentionable | null }

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Hosszabb nevek előre, hogy a „Zoli Kis” ne nyelődjön el a „Zoli” miatt. */
const patternFor = (people: Mentionable[]): RegExp | null => {
  const names = people
    .map((p) => p.name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (names.length === 0) return null
  return new RegExp(
    `(?<![\\p{L}\\p{N}])@(${names.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  )
}

/** A szöveget szegmensekre bontja; a felismert `@Név` részek a megfelelő személlyel jönnek vissza. */
export function splitMentions(body: string, people: Mentionable[]): BodySegment[] {
  const pattern = patternFor(people)
  if (!pattern) return [{ text: body, mention: null }]
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p]))
  const segments: BodySegment[] = []
  let last = 0
  for (const match of body.matchAll(pattern)) {
    const person = byName.get(match[1]!.toLowerCase())
    if (!person) continue
    if (match.index > last) segments.push({ text: body.slice(last, match.index), mention: null })
    segments.push({ text: match[0], mention: person })
    last = match.index + match[0].length
  }
  if (last < body.length) segments.push({ text: body.slice(last), mention: null })
  return segments
}

/** A szövegben megemlített személyek azonosítói (egyszer-egyszer, előfordulási sorrendben). */
export function extractMentionIds(body: string, people: Mentionable[]): string[] {
  const ids = splitMentions(body, people).flatMap((s) => (s.mention ? [s.mention.id] : []))
  return [...new Set(ids)]
}
