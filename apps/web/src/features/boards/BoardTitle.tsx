import { useState } from 'react'

type BoardTitleProps = {
  title: string
  onChange: (title: string) => void
}

export function BoardTitle({ title, onChange }: BoardTitleProps) {
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
      aria-label="Táblacím szerkesztése"
    >
      <h1>{title}</h1>
    </button>
  )
}
