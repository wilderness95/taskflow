export const PRIORITIES = ['high', 'medium', 'low'] as const

export type Priority = (typeof PRIORITIES)[number]

export const DEFAULT_PRIORITY: Priority = 'medium'

export const isPriority = (value: unknown): value is Priority =>
  typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)
