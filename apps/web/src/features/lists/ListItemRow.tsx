import type { ListItemDto, ListSectionDto } from '@taskflow/shared'
import { useState, type DragEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { classNames } from '../../shared/lib/classNames'
import { ListItemEditor } from './ListItemEditor'
import type { MoveDirection } from './listMoves'
import type { ListMutations } from './useListMutations'

type Props = {
  item: ListItemDto
  sections: ListSectionDto[]
  canWrite: boolean
  mutations: ListMutations
  isDragging: boolean
  onMove: (direction: MoveDirection) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDropBefore: () => void
  hintId: string
}

export function ListItemRow({
  item,
  sections,
  canWrite,
  mutations,
  isDragging,
  onMove,
  onDragStart,
  onDragEnd,
  onDropBefore,
  hintId,
}: Props) {
  const { t } = useTranslation('lists')
  const [isEditing, setIsEditing] = useState(false)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canWrite || !event.altKey) return
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      onMove(event.key === 'ArrowUp' ? 'up' : 'down')
    }
  }
  const handleDragStart = (event: DragEvent<HTMLLIElement>) => {
    event.dataTransfer.setData('text/plain', item.id)
    event.dataTransfer.effectAllowed = 'move'
    onDragStart()
  }
  const handleDrop = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onDropBefore()
  }

  return (
    <li
      className={classNames('list-item', item.done && 'is-done', isDragging && 'is-dragging')}
      draggable={canWrite && !isEditing}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      {isEditing ? (
        <ListItemEditor
          item={item}
          sections={sections}
          mutations={mutations}
          onDone={() => setIsEditing(false)}
        />
      ) : (
        <>
          <label className="list-check-label list-item-main">
            <input
              type="checkbox"
              data-list-item-focus={item.id}
              checked={item.done}
              disabled={!canWrite}
              aria-describedby={canWrite ? hintId : undefined}
              onKeyDown={handleKeyDown}
              onChange={(event) =>
                mutations.updateItem.mutate({ id: item.id, input: { done: event.target.checked } })
              }
            />
            <span className="list-item-text">{item.text}</span>
            {item.recurring && (
              <span className="list-item-badge" title={t('item.recurringBadge')}>
                <span aria-hidden="true">↻</span>
                <span className="visually-hidden">{t('item.recurringBadge')}</span>
              </span>
            )}
          </label>
          {canWrite && (
            <div className="list-item-actions">
              <button
                type="button"
                className="list-icon-button"
                aria-label={t('item.editAria', { text: item.text })}
                title={t('item.edit')}
                onClick={() => setIsEditing(true)}
              >
                <span aria-hidden="true">✎</span>
              </button>
              <button
                type="button"
                className="list-icon-button"
                aria-label={t('item.deleteAria', { text: item.text })}
                title={t('item.delete')}
                onClick={() => mutations.deleteItemUndoable(item)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          )}
        </>
      )}
    </li>
  )
}
