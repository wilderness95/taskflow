import { API_KEY_SCOPES, type ApiKeyScope, type CreateApiKeyInput } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SCOPE_KEYS } from './scopeKeys'

/** Lejárat: 0 = nem jár le. */
const EXPIRY_OPTIONS = [0, 30, 90, 365] as const

type CreateApiKeyFormProps = {
  pending: boolean
  onSubmit: (input: CreateApiKeyInput, onDone: () => void) => void
}

export function CreateApiKeyForm({ pending, onSubmit }: CreateApiKeyFormProps) {
  const { t } = useTranslation('apikeys')
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['boards:read'])
  const [expiresInDays, setExpiresInDays] = useState<number>(90)

  const toggle = (scope: ApiKeyScope) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || scopes.length === 0) return
    onSubmit({ name, scopes, expiresInDays: expiresInDays || null }, () => setName(''))
  }

  return (
    <form className="apikeys-form" onSubmit={handleSubmit}>
      <label>
        {t('form.name')}
        <input
          type="text"
          required
          maxLength={100}
          value={name}
          placeholder={t('form.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <fieldset>
        <legend>{t('form.scopes')}</legend>
        {API_KEY_SCOPES.map((scope) => (
          <label key={scope} className="apikeys-scope">
            <input
              type="checkbox"
              checked={scopes.includes(scope)}
              onChange={() => toggle(scope)}
            />
            <span>
              <strong>{t(`scopes.${SCOPE_KEYS[scope]}.name`)}</strong>
              <small>{t(`scopes.${SCOPE_KEYS[scope]}.description`)}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label>
        {t('form.expiry')}
        <select
          value={expiresInDays}
          onChange={(event) => setExpiresInDays(Number(event.target.value))}
        >
          {EXPIRY_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {days === 0 ? t('form.never') : t('form.days', { count: days })}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="primary-button"
        disabled={pending || scopes.length === 0 || !name.trim()}
      >
        {t('form.submit')}
      </button>
    </form>
  )
}
