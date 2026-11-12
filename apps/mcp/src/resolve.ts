/** Kis- és nagybetűre, ékezetre érzéketlen összevetéshez (hangalapú bemenet pontatlan). */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export class ResolveError extends Error {}

/**
 * Egy név (vagy azonosító) feloldása a jelöltek közül: azonosító, pontos név, majd részegyezés.
 * Több találatnál vagy találat nélkül `ResolveError`, a lehetőségek felsorolásával.
 */
export function resolveOne<T>(
  kind: string,
  input: string,
  items: T[],
  keys: (item: T) => string[],
  id: (item: T) => string,
): T {
  const q = norm(input)
  const byId = items.find((i) => id(i) === input)
  if (byId) return byId
  const exact = items.filter((i) => keys(i).some((k) => norm(k) === q))
  const found = exact.length ? exact : items.filter((i) => keys(i).some((k) => norm(k).includes(q)))
  if (found.length === 1) return found[0]!
  const options = (found.length ? found : items).map((i) => keys(i)[0]).join(', ')
  throw new ResolveError(
    found.length
      ? `Ambiguous ${kind} "${input}". Candidates: ${options}`
      : `No ${kind} matches "${input}". Available: ${options}`,
  )
}
