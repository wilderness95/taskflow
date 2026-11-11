import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'
import './AuthLayout.css'

type AuthLayoutProps = {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  const { t } = useTranslation('common')

  return (
    <div className="auth-shell">
      <main className="auth-card">
        <div className="auth-brand">
          <div className="brand-badge">T</div>
          <span className="brand-name">{t('appName')}</span>
        </div>
        <h1>{title}</h1>
        {description && <p className="auth-description">{description}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </main>
    </div>
  )
}
