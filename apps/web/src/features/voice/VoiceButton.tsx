import { useTranslation } from 'react-i18next'
import { useVoiceAssistant, type VoiceScope } from './useVoiceAssistant'
import '../../shared/styles/buttons.css'
import './VoiceButton.css'

/** A Topbar mikrofon gombja: elindítja/leállítja az élő hangasszisztenst, és jelzi az állapotát. */
export function VoiceButton(scope: VoiceScope) {
  const { t } = useTranslation('voice')
  const { status, error, start, stop, interrupt } = useVoiceAssistant(scope)
  const active = status !== 'idle'

  const errorKey = error && `errors.${error}`
  const errorText = error
    ? t(errorKey as 'errors.unknown', { defaultValue: t('errors.unknown') })
    : null

  return (
    <div className="voice-control">
      {status === 'speaking' && (
        <button type="button" className="icon-button voice-interrupt" onClick={interrupt}>
          <span aria-hidden="true">■</span>
          <span className="voice-sr">{t('interrupt')}</span>
        </button>
      )}
      <button
        type="button"
        className={`icon-button voice-button voice-${status}`}
        aria-pressed={active}
        aria-label={active ? t('stop') : t('start')}
        title={active ? t('stop') : t('start')}
        onClick={() => (active ? stop() : void start())}
      >
        <span aria-hidden="true">●</span>
      </button>
      {/* A képernyőolvasó és a látó felhasználó is megkapja az állapotot. */}
      <span className="voice-status" role="status">
        {active && status !== 'connecting' ? t(`status.${status}`) : ''}
        {status === 'connecting' ? t('status.connecting') : ''}
      </span>
      {errorText && (
        <span className="voice-error" role="alert">
          {errorText}
        </span>
      )}
    </div>
  )
}
