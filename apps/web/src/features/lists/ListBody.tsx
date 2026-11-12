import { groupListItems, type ListDetailDto } from '@taskflow/shared'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListItemRow } from './ListItemRow'
import { ListSection } from './ListSection'
import { computeItemMove, type ItemMoveTarget, type MoveDirection } from './listMoves'
import type { ListMutations } from './useListMutations'

type Props = { list: ListDetailDto; canWrite: boolean; mutations: ListMutations }

/** A lista tételei szakaszokba rendezve; húzással és Alt + nyíllal átrendezhetők. */
export function ListBody({ list, canWrite, mutations }: Props) {
  const { t } = useTranslation('lists')
  const hintId = useId()
  const groups = useMemo(() => groupListItems(list.sections, list.items), [list])
  const [dragId, setDragId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const pendingFocus = useRef<string | null>(null)

  // Az áthelyezett tétel újrarajzolása után visszakapja a fókuszt.
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    document.querySelector<HTMLElement>(`[data-list-item-focus="${id}"]`)?.focus()
  }, [list])

  const moveTo = (id: string, target: ItemMoveTarget) => {
    mutations.moveItem.mutate({ id, target })
  }
  const moveByKey = (id: string, direction: MoveDirection) => {
    const target = computeItemMove(groups, id, direction)
    if (!target) return
    pendingFocus.current = id
    const text = list.items.find((i) => i.id === id)?.text ?? ''
    setAnnouncement(t('page.moved', { text }))
    moveTo(id, target)
  }
  const drop = (sectionId: string | null, beforeItemId: string | null) => {
    if (dragId && dragId !== beforeItemId) moveTo(dragId, { sectionId, beforeItemId })
    setDragId(null)
  }

  if (list.items.length === 0 && list.sections.length === 0) {
    return <p className="workspace-empty">{t('page.empty')}</p>
  }

  return (
    <div className="list-body">
      {canWrite && (
        <p id={hintId} className="visually-hidden">
          {t('page.moveHint')}
        </p>
      )}
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
      {groups.map((group) => (
        <ListSection
          key={group.section?.id ?? 'loose'}
          group={group}
          canWrite={canWrite}
          mutations={mutations}
          hasDrag={dragId !== null}
          onDropEnd={() => drop(group.section?.id ?? null, null)}
        >
          {group.items.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              sections={list.sections}
              canWrite={canWrite}
              mutations={mutations}
              isDragging={dragId === item.id}
              hintId={hintId}
              onMove={(direction) => moveByKey(item.id, direction)}
              onDragStart={() => setDragId(item.id)}
              onDragEnd={() => setDragId(null)}
              onDropBefore={() => drop(item.sectionId, item.id)}
            />
          ))}
        </ListSection>
      ))}
    </div>
  )
}
