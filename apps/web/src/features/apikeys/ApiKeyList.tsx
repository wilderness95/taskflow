import type { ApiKeyDto } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../i18n/format'
import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import { SCOPE_KEYS } from './scopeKeys'

type ApiKeyListProps = {
  keys: ApiKeyDto[]
  onRevoke: (id: string) => void
}

type KeyStatus = 'active' | 'revoked' | 'expired'

const statusOf = (key: ApiKeyDto): KeyStatus =>
  key.revokedAt
    ? 'revoked'
    : key.expiresAt && Date.parse(key.expiresAt) <= Date.now()
      ? 'expired'
      : 'active'

export function ApiKeyList({ keys, onRevoke }: ApiKeyListProps) {
  const { t } = useTranslation(['apikeys', 'common'])
  const [toRevoke, setToRevoke] = useState<ApiKeyDto | null>(null)

  if (keys.length === 0) {
    return <p className="workspace-empty">{t('apikeys:empty')}</p>
  }

  return (
    <>
      <ul className="members-list">
        {keys.map((key) => {
          const status = statusOf(key)
          return (
            <li key={key.id} className={`apikeys-item apikeys-${status}`}>
              <span className="members-identity">
                <strong>
                  {key.name} <code>{key.prefix}…</code>
                </strong>
                <small>
                  {key.scopes.map((s) => t(`apikeys:scopes.${SCOPE_KEYS[s]}.name`)).join(', ')}
                </small>
                <small>
                  {t('apikeys:lastUsed')}:{' '}
                  {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : t('apikeys:neverUsed')}
                  {' · '}
                  {key.expiresAt
                    ? t('apikeys:expiresAt', { date: formatDateTime(key.expiresAt) })
                    : t('apikeys:noExpiry')}
                </small>
              </span>
              <span className="apikeys-status">{t(`apikeys:status.${status}`)}</span>
              {status === 'active' && (
                <button type="button" className="secondary-button" onClick={() => setToRevoke(key)}>
                  {t('apikeys:revoke.action')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {toRevoke && (
        <ConfirmModal
          eyebrow={t('apikeys:revoke.eyebrow')}
          title={t('apikeys:revoke.title')}
          message={t('apikeys:revoke.message', { name: toRevoke.name })}
          confirmLabel={t('apikeys:revoke.confirm')}
          onClose={() => setToRevoke(null)}
          onConfirm={() => {
            onRevoke(toRevoke.id)
            setToRevoke(null)
          }}
        />
      )}
    </>
  )
}
