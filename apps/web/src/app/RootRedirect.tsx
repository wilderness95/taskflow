import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { getLastWorkspace } from '../shared/lib/lastWorkspace'
import { useWorkspaces } from '../features/workspaces/useWorkspaces'

/** A `/` az utoljára használt (ennek hiányában az első) munkaterület tábláira irányít. */
export function RootRedirect() {
  const { t } = useTranslation('auth')
  const { data: workspaces, isError } = useWorkspaces()

  if (isError) {
    return <p role="alert">{t('errors.unknown')}</p>
  }
  if (!workspaces) {
    return (
      <p className="auth-loading" role="status">
        {t('loading')}
      </p>
    )
  }

  const last = getLastWorkspace()
  const target = workspaces.find((workspace) => workspace.id === last) ?? workspaces[0]
  return target ? (
    <Navigate to={`/w/${target.id}`} replace />
  ) : (
    <p role="alert">{t('errors.unknown')}</p>
  )
}
