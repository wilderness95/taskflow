export type DueDateState = 'none' | 'overdue' | 'soon' | 'normal'

/** Ennyi napon belül számít "közelinek" a határidő. */
export const DUE_SOON_DAYS = 3

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * A határidő állapota a mai naphoz képest, naptári napok szerint: a határidő napján még nem lejárt,
 * másnaptól igen. `dueDate` formátuma: `YYYY-MM-DD`. A `now` a tesztelhetőség miatt cserélhető.
 */
export const getDueDateState = (
  dueDate: string | null | undefined,
  now: Date = new Date(),
): DueDateState => {
  if (!dueDate) {
    return 'none'
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(`${dueDate}T00:00:00`)
  // round: a nyári/téli időszámítás váltása miatt egy nap nem mindig pontosan 24 óra
  const diffInDays = Math.round((due.getTime() - startOfToday.getTime()) / MS_PER_DAY)

  if (diffInDays < 0) {
    return 'overdue'
  }

  if (diffInDays <= DUE_SOON_DAYS) {
    return 'soon'
  }

  return 'normal'
}
