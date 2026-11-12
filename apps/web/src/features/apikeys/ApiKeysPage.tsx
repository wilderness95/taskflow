import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { authErrorKey } from '../auth/authErrors'
import { UserMenu } from '../auth/UserMenu'
import { ApiKeyList } from './ApiKeyList'
import { CreateApiKeyForm } from './CreateApiKeyForm'
import { CreatedKeyNotice } from './CreatedKeyNotice'
import { useApiKeys } from './useApiKeys'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import '../auth/AuthLayout.css'
import '../boards/Topbar.css'
import '../workspaces/WorkspacePage.css'
import '../workspaces/WorkspaceMembersPage.css'
import './ApiKeysPage.css'

/** Beállítások → API kulcsok: AI agentek hozzáférése (a kulcs csak létrehozáskor látszik). */
export function ApiKeysPage() {
  const { t } = useTranslation(['apikeys', 'auth', 'common'])
  const { keys, create, revoke } = useApiKeys()
  const [secret, setSecret] = useState<string | null>(null)
  const error = [create, revoke].find((mutation) => mutation.isError)?.error

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <header className="topbar workspace-topbar">
          <Link to="/" className="brand-wrap">
            <div className="brand-badge">T</div>
            <span className="brand-name">{t('common:appName')}</span>
          </Link>
          <div className="topbar-actions">
            <UserMenu />
          </div>
        </header>
        <main className="workspace-page members-page">
          <section className="workspace-heading">
            <div>
              <span className="eyebrow">{t('apikeys:eyebrow')}</span>
              <h1>{t('apikeys:title')}</h1>
              <small>{t('apikeys:intro')}</small>
            </div>
            <Link to="/" className="secondary-button">
              {t('apikeys:back')}
            </Link>
          </section>

          {error && (
            <p className="auth-form-error" role="alert">
              {t(`auth:errors.${authErrorKey(error)}`)}
            </p>
          )}
          {secret && <CreatedKeyNotice secret={secret} onDismiss={() => setSecret(null)} />}

          <section aria-label={t('apikeys:list.title')}>
            <h2>{t('apikeys:list.title')}</h2>
            {keys.isError ? (
              <p role="alert">{t('apikeys:loadError')}</p>
            ) : (
              <ApiKeyList keys={keys.data ?? []} onRevoke={(id) => revoke.mutate(id)} />
            )}
          </section>

          <section aria-label={t('apikeys:form.title')}>
            <h2>{t('apikeys:form.title')}</h2>
            <CreateApiKeyForm
              pending={create.isPending}
              onSubmit={(input, onDone) =>
                create.mutate(input, {
                  onSuccess: (created) => {
                    setSecret(created.key)
                    onDone()
                  },
                })
              }
            />
          </section>
        </main>
      </div>
    </div>
  )
}
