import { getChecklistProgress, type ChecklistItem } from '@taskflow/shared'
import { createId } from '../../shared/lib/ids'
import { classNames } from '../../shared/lib/classNames'

type ChecklistEditorProps = {
  title: string
  items: ChecklistItem[]
  onTitleChange: (title: string) => void
  onItemsChange: (items: ChecklistItem[]) => void
}

export function ChecklistEditor({
  title,
  items,
  onTitleChange,
  onItemsChange,
}: ChecklistEditorProps) {
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
        <button type="button" className="checklist-toggle-button" aria-label="Checklist bejelölése">
          ✓
        </button>
        <input
          type="text"
          className="checklist-title-input"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <button type="button" className="delete-checklist-button">
          Delete
        </button>
      </div>

      <div className="checklist-progress-row">
        <div className="checklist-progress-track">
          <span className="checklist-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="checklist-progress-percent">{percent}%</span>
      </div>

      <div className="checklist-items">
        {items.length === 0 && <div className="checklist-empty-state">Nincs elem a listában.</div>}

        {items.map((item, index) => (
          <div key={item.id ?? `checklist-${index}`} className="checklist-item-row">
            <button
              type="button"
              className={classNames('checklist-item-toggle', item.done && 'is-checked')}
              onClick={() => updateItem(index, { done: !item.done })}
              aria-label={item.done ? 'Kijelölés megszüntetése' : 'Kijelölés'}
            >
              {item.done ? '✓' : ''}
            </button>
            <input
              type="text"
              value={item.text}
              placeholder="Add an item"
              onChange={(event) => updateItem(index, { text: event.target.value })}
            />
            <button
              type="button"
              className="checklist-delete-item"
              onClick={() => removeItem(index)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="add-checklist-item-button" onClick={addItem}>
        Add an item
      </button>
    </div>
  )
}
