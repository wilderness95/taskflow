import { getChecklistProgress, type ChecklistItem } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { createId } from '../../shared/lib/ids'
import { classNames } from '../../shared/lib/classNames'
import { Icon } from '../../shared/ui/Icon'
import './ChecklistEditor.css'

type ChecklistEditorProps = {
  title: string
  items: ChecklistItem[]
  onTitleChange: (title: string) => void
  onItemsChange: (items: ChecklistItem[]) => void
  onDelete: () => void
}

export function ChecklistEditor({
  title,
  items,
  onTitleChange,
  onItemsChange,
  onDelete,
}: ChecklistEditorProps) {
  const { t } = useTranslation('card')
  const { percent } = getChecklistProgress({ items })

  const updateItem = (index: number, changes: Partial<ChecklistItem>) =>
    onItemsChange(
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)),
    )

  const removeItem = (index: number) =>
    onItemsChange(items.filter((_, itemIndex) => itemIndex !== index))

  const addItem = () => onItemsChange([...items, { id: createId('item'), text: '', done: false }])

  return (
    <div className="checklist-panel">
      <div className="checklist-title-row">
        <span className="checklist-toggle-button" aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
        <input
          type="text"
          className="checklist-title-input"
          value={title}
          aria-label={t('checklist.titleAria')}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <button type="button" className="delete-checklist-button" onClick={onDelete}>
          {t('checklist.delete')}
        </button>
      </div>

      <div className="checklist-progress-row">
        <div className="checklist-progress-track">
          <span className="checklist-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="checklist-progress-percent">{percent}%</span>
      </div>

      <div className="checklist-items">
        {items.length === 0 && <div className="checklist-empty-state">{t('checklist.empty')}</div>}

        {items.map((item, index) => (
          <div key={item.id ?? `checklist-${index}`} className="checklist-item-row">
            <button
              type="button"
              className={classNames('checklist-item-toggle', item.done && 'is-checked')}
              onClick={() => updateItem(index, { done: !item.done })}
              aria-label={item.done ? t('checklist.uncheck') : t('checklist.check')}
            >
              {item.done ? <Icon name="check" size={12} /> : null}
            </button>
            <input
              type="text"
              value={item.text}
              placeholder={t('checklist.itemPlaceholder')}
              onChange={(event) => updateItem(index, { text: event.target.value })}
            />
            <button
              type="button"
              className="checklist-delete-item"
              aria-label={t('checklist.deleteItemAria')}
              onClick={() => removeItem(index)}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="add-checklist-item-button" onClick={addItem}>
        {t('checklist.addItem')}
      </button>
    </div>
  )
}
