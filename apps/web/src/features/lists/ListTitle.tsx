import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type Props = { title: string; readOnly: boolean; onChange: (title: string) => void }

export function ListTitle({ title, readOnly, onChange }: Props) {
  const { t } = useTranslation('lists')
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(title)

  const submit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== title) onChange(trimmed)
    setIsEditing(false)
  }

  if (readOnly) return <h1>{title}</h1>
  if (isEditing) {
    return (
      <input
        className="list-title-input"
        aria-label={t('page.editTitleAria')}
        maxLength={200}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') setIsEditing(false)
        }}
        autoFocus
      />
    )
  }
  return (
    <button
      type="button"
      className="list-title-button"
      aria-label={t('page.editTitleAria')}
      onClick={() => {
        setDraft(title)
        setIsEditing(true)
      }}
    >
      <h1>{title}</h1>
    </button>
  )
}
