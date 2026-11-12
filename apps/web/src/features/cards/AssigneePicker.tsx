import { useTranslation } from 'react-i18next'
import { Avatar } from '../auth/Avatar'
import type { Assignee } from '../boards/types'
import { classNames } from '../../shared/lib/classNames'
import './AssigneePicker.css'

type AssigneePickerProps = {
  participants: Assignee[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

/** A tábla résztvevői közül választható felelősök (többes kijelölés). */
export function AssigneePicker({ participants, selectedIds, onChange }: AssigneePickerProps) {
  const { t } = useTranslation('card')

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])

  return (
    <fieldset className="assignee-picker">
      <legend>{t('assignees.label')}</legend>
      {participants.length === 0 ? (
        <p className="assignee-picker-empty">{t('assignees.empty')}</p>
      ) : (
        <div className="assignee-picker-list">
          {participants.map((person) => {
            const selected = selectedIds.includes(person.id)
            return (
              <button
                key={person.id}
                type="button"
                className={classNames('assignee-picker-option', selected && 'is-selected')}
                aria-pressed={selected}
                onClick={() => toggle(person.id)}
              >
                <Avatar user={person} />
                <span>{person.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
