export const TAG_COLORS = ['blue', 'amber', 'green', 'purple', 'rose'] as const

export type TagColor = (typeof TAG_COLORS)[number]

export type Tag = {
  label: string
  color: TagColor
}

/** Vesszővel elválasztott szövegből címkéket készít; a színeket sorban, körbeforgatva osztja ki. */
export const parseTags = (raw: string | null | undefined): Tag[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((label, index) => ({
      label,
      color: TAG_COLORS[index % TAG_COLORS.length] as TagColor,
    }))
