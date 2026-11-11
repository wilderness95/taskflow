import { generateKeyBetween } from 'fractional-indexing'
import { AppError } from '../errors.js'

export type Positioned = { id: string; position: string }

/**
 * Az elem új `position` értéke: a `beforeId` elem elé kerül, vagy a lista végére, ha nincs megadva.
 * A `siblings` a cél lista elemei sorrendben; az áthelyezett elem (`movingId`) nem számít bele.
 */
export function positionBefore(
  siblings: Positioned[],
  movingId: string,
  beforeId?: string | null,
): string {
  const others = siblings.filter((s) => s.id !== movingId)
  if (!beforeId) return generateKeyBetween(others.at(-1)?.position ?? null, null)
  const index = others.findIndex((s) => s.id === beforeId)
  if (index === -1) {
    throw new AppError(422, 'invalid_position_target', 'Target is not in the destination list', {
      beforeId,
    })
  }
  return generateKeyBetween(others[index - 1]?.position ?? null, others[index]!.position)
}
