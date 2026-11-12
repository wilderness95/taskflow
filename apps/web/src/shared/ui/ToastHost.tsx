import { useTranslation } from 'react-i18next'
import { dismissToast, useToasts } from './toast'
import './ToastHost.css'

/** A toastok helye (egyszer az alkalmazás gyökerében); a hibák `alert`, a többi `status` szerepű. */
export function ToastHost() {
  const { t } = useTranslation()
  const toasts = useToasts()
  if (toasts.length === 0) return null

  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-message">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action?.run()
                dismissToast(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label={t('close')}
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
