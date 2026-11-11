import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type BoardTitleProps = {
  title: string
  onChange: (title: string) => void
}

export function BoardTitle({ title, onChange }: BoardTitleProps) {
  const { t } = useTranslation('board')
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(title)

  const startEditing = () => {
    setDraft(title)
    setIsEditing(true)
  }

  const submit = () => {
    const trimmed = draft.trim()
    if (trimmed) {
      onChange(trimmed)
    }
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <input
        className="board-title-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            submit()
          }

          if (event.key === 'Escape') {
            setIsEditing(false)
          }
        }}
        autoFocus
      />
    )
  }

  return (
    <button
      type="button"
      className="board-title-row"
      onClick={startEditing}
      aria-label={t('editTitleAria')}
    >
      <h1>{title}</h1>
    </button>
  )
}
