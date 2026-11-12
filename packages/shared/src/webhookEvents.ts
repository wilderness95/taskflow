/** Illeszkedik-e egy esemény (`card.moved`) a webhook mintái (`*`, `card.*`, `card.moved`) valamelyikére. */
export function matchesWebhookEvent(patterns: readonly string[], action: string): boolean {
  const entity = action.split('.')[0]
  return patterns.some((p) => p === '*' || p === action || p === `${entity}.*`)
}
