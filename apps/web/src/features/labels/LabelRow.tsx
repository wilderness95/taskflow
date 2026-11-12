import { TAG_COLORS, type LabelDto, type TagColor } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../shared/styles/buttons.css'
import '../../shared/styles/tags.css'
import './LabelRow.css'

type LabelRowProps = {
  label: LabelDto
  canEdit: boolean
  busy: boolean
  onSave: (input: { name: string; color: TagColor }) => void
  onDelete: () => void
}

/** Egy címke szerkesztő sora: név, szín, mentés és törlés. */
export function LabelRow({ label, canEdit, busy, onSave, onDelete }: LabelRowProps) {
  const { t } = useTranslation(['labels', 'column'])
  const [name, setName] = useState(label.name)
  const [color, setColor] = useState<TagColor>(label.color)
  const changed = name.trim() !== label.name || color !== label.color

  return (
    <li className="label-row">
      <span className={`task-tag tag-${color}`} aria-hidden="true">
        {name.trim() || label.name}
      </span>
      <input
        type="text"
        value={name}
        maxLength={50}
        disabled={!canEdit}
        aria-label={t('labels:nameAria')}
        onChange={(event) => setName(event.target.value)}
      />
      <select
        value={color}
        disabled={!canEdit}
        aria-label={t('labels:colorAria', { name: label.name })}
        onChange={(event) => setColor(event.target.value as TagColor)}
      >
        {TAG_COLORS.map((option) => (
          <option key={option} value={option}>
            {t(`column:accent.${option}`)}
          </option>
        ))}
      </select>
      {canEdit && (
        <>
          <button
            type="button"
            className="secondary-button"
            disabled={busy || !changed || !name.trim()}
            onClick={() => onSave({ name: name.trim(), color })}
          >
            {t('labels:save')}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            aria-label={t('labels:deleteAria', { name: label.name })}
            onClick={onDelete}
          >
            {t('labels:delete')}
          </button>
        </>
      )}
    </li>
  )
}
