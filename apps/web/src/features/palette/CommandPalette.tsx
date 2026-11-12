import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../shared/ui/Modal'
import { filterPaletteItems } from './paletteItems'
import { usePaletteItems } from './usePaletteItems'
import './CommandPalette.css'

/** Parancspaletta (Ctrl/Cmd + K): gyors ugrás táblára, listára, munkaterületre, és a téma váltása. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('palette')
  const listId = useId()
  const { items, isLoading } = usePaletteItems(onClose)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = useMemo(() => filterPaletteItems(items, query), [items, query])
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0))

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      results[activeIndex]?.run()
    }
  }

  return (
    <Modal
      eyebrow={t('eyebrow')}
      title={t('title')}
      onClose={onClose}
      cardClassName="modal-card palette-card"
    >
      <input
        type="text"
        className="palette-input"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-label={t('inputLabel')}
        placeholder={t('placeholder')}
        autoFocus
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={handleKeyDown}
      />
      <ul id={listId} role="listbox" className="palette-list" aria-label={t('results')}>
        {results.map((item, index) => (
          <li
            key={item.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'palette-option is-active' : 'palette-option'}
            onMouseMove={() => setActive(index)}
            onClick={item.run}
          >
            <span>{item.label}</span>
            <small>{t(`groups.${item.group}`)}</small>
          </li>
        ))}
      </ul>
      {results.length === 0 && !isLoading && <p className="palette-empty">{t('empty')}</p>}
    </Modal>
  )
}
