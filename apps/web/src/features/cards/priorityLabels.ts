import type { Priority } from '@taskflow/shared'

// Átmeneti: az i18n lépésben t('card:priority.<érték>') váltja fel.
export const priorityLabels: Record<Priority, string> = {
  high: 'Magas',
  medium: 'Közepes',
  low: 'Alacsony',
}
