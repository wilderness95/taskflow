// Átmeneti: az i18n lépésben a központi `format` helper váltja fel (nem lesz beégetett locale).
export const formatDueDate = (dueDate: string | null | undefined): string => {
  if (!dueDate) {
    return ''
  }

  const date = new Date(`${dueDate}T12:00:00`)
  return new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric' }).format(date)
}
