import { extractMentionIds, type Mentionable } from '@taskflow/shared'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './MentionTextarea.css'

type MentionTextareaProps = {
  value: string
  onChange: (value: string) => void
  people: Mentionable[]
  placeholder?: string
  ariaLabel: string
  rows?: number
}

/** Szövegmező @említéssel: a gombok `@Név`-et szúrnak a kurzorhoz; a mentett említések a szövegből jönnek. */
export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  ariaLabel,
  rows = 3,
}: MentionTextareaProps) {
  const { t } = useTranslation('comment')
  const ref = useRef<HTMLTextAreaElement>(null)
  const mentioned = new Set(extractMentionIds(value, people))

  const insert = (person: Mentionable) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const needsSpace = start > 0 && !/\s/.test(value[start - 1] ?? '')
    const token = `${needsSpace ? ' ' : ''}@${person.name} `
    onChange(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      const pos = start + token.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="mention-textarea">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
      {people.length > 0 && (
        <div className="mention-suggestions" role="group" aria-label={t('mentionAria')}>
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`mention-chip${mentioned.has(person.id) ? ' is-mentioned' : ''}`}
              onClick={() => insert(person)}
            >
              @{person.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
