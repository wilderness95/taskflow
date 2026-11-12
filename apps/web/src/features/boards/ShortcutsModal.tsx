import { useTranslation } from 'react-i18next'
import { Modal } from '../../shared/ui/Modal'
import './ShortcutsModal.css'

const SHORTCUTS = [
  'newCard',
  'search',
  'filters',
  'views',
  'help',
  'openCard',
  'moveCard',
  'moveColumn',
] as const

type ShortcutsModalProps = { onClose: () => void }

/** A billentyűparancsok súgója (`?`). */
export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const { t } = useTranslation('shortcuts')

  return (
    <Modal eyebrow={t('eyebrow')} title={t('title')} onClose={onClose}>
      <dl className="shortcut-list">
        {SHORTCUTS.map((name) => (
          <div key={name} className="shortcut-row">
            <dt>
              <kbd>{t(`items.${name}.keys`)}</kbd>
            </dt>
            <dd>{t(`items.${name}.label`)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}
