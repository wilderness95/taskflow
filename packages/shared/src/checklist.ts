export type ChecklistItem = {
  id?: string
  text: string
  done: boolean
}

/** A checklist két alakot vehet fel: tételek listája, vagy (régi seed adat) csak összesítő számok. */
export type ChecklistLike = {
  title?: string
  items?: ChecklistItem[]
  done?: number
  total?: number
}

export type ChecklistProgress = {
  percent: number
  done: number
  total: number
}

const EMPTY_PROGRESS: ChecklistProgress = { percent: 0, done: 0, total: 0 }

export const getChecklistProgress = (
  checklist: ChecklistLike | null | undefined,
): ChecklistProgress => {
  if (!checklist) {
    return EMPTY_PROGRESS
  }

  const items = Array.isArray(checklist.items) ? checklist.items : []
  if (items.length > 0) {
    const done = items.filter((item) => item.done).length
    return {
      percent: Math.round((done / items.length) * 100),
      done,
      total: items.length,
    }
  }

  const rawTotal = Number(checklist.total)
  if (!Number.isFinite(rawTotal) || rawTotal <= 0) {
    return EMPTY_PROGRESS
  }

  const total = rawTotal
  const done = Math.min(total, Math.max(0, Number(checklist.done) || 0))

  return {
    percent: Math.round((done / total) * 100),
    done,
    total,
  }
}
