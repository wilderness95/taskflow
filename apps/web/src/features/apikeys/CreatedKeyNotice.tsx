import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type CreatedKeyNoticeProps = {
  secret: string
  onDismiss: () => void
}

/** A frissen létrehozott kulcs: csak most látható, utána már csak az eleje (prefix). */
export function CreatedKeyNotice({ secret, onDismiss }: CreatedKeyNoticeProps) {
  const { t } = useTranslation(['apikeys', 'common'])
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
  }

  return (
    <div className="apikeys-created" role="status">
      <strong>{t('apikeys:created.title')}</strong>
      <p>{t('apikeys:created.warning')}</p>
      <code className="apikeys-secret">{secret}</code>
      <div className="apikeys-created-actions">
        <button type="button" className="primary-button" onClick={() => void copy()}>
          {copied ? t('apikeys:created.copied') : t('apikeys:created.copy')}
        </button>
        <button type="button" className="secondary-button" onClick={onDismiss}>
          {t('apikeys:created.done')}
        </button>
      </div>
    </div>
  )
}
