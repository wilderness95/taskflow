import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as boardsApi from '../../api/boards'
import * as listsApi from '../../api/lists'
import { getLastWorkspace } from '../../shared/lib/lastWorkspace'
import { THEME_PREFERENCES } from '../../shared/theme/theme'
import { setThemePreference } from '../../shared/theme/useTheme'
import { useCurrentUser } from '../auth/useSession'
import { useWorkspaces } from '../workspaces/useWorkspaces'
import type { PaletteItem } from './paletteItems'

/** A parancspaletta elemei: navigáció, az aktuális munkaterület táblái és listái, téma. */
export function usePaletteItems(onDone: () => void): { items: PaletteItem[]; isLoading: boolean } {
  const { t } = useTranslation('palette')
  const navigate = useNavigate()
  const user = useCurrentUser()
  const workspaces = useWorkspaces()
  const all = workspaces.data ?? []
  const current = all.find((w) => w.id === getLastWorkspace()) ?? all[0]
  const workspaceId = current?.id ?? ''

  const boards = useQuery({
    queryKey: ['palette', 'boards', workspaceId],
    queryFn: () => boardsApi.listBoards(workspaceId),
    enabled: Boolean(workspaceId),
  })
  const lists = useQuery({
    queryKey: ['palette', 'lists', workspaceId],
    queryFn: () => listsApi.listLists(workspaceId),
    enabled: Boolean(workspaceId),
  })

  const go = (path: string) => () => {
    onDone()
    navigate(path)
  }
  const items: PaletteItem[] = []
  if (current) {
    items.push(
      { id: 'nav-boards', group: 'navigate', label: t('nav.boards'), run: go(`/w/${current.id}`) },
      {
        id: 'nav-lists',
        group: 'navigate',
        label: t('nav.lists'),
        run: go(`/w/${current.id}/lists`),
      },
      {
        id: 'nav-members',
        group: 'navigate',
        label: t('nav.members'),
        run: go(`/w/${current.id}/members`),
      },
    )
  }
  items.push({
    id: 'nav-api-keys',
    group: 'navigate',
    label: t('nav.apiKeys'),
    run: go('/settings/api-keys'),
  })
  if (user?.isAdmin) {
    items.push({ id: 'nav-admin', group: 'navigate', label: t('nav.admin'), run: go('/admin') })
  }
  for (const board of boards.data ?? []) {
    items.push({
      id: `board-${board.id}`,
      group: 'board',
      label: board.title,
      hint: current?.name,
      run: go(`/b/${board.id}`),
    })
  }
  for (const list of lists.data ?? []) {
    items.push({
      id: `list-${list.id}`,
      group: 'list',
      label: list.title,
      hint: current?.name,
      run: go(`/l/${list.id}`),
    })
  }
  for (const workspace of all) {
    if (workspace.id === current?.id) continue
    items.push({
      id: `workspace-${workspace.id}`,
      group: 'workspace',
      label: workspace.name,
      run: go(`/w/${workspace.id}`),
    })
  }
  for (const option of THEME_PREFERENCES) {
    items.push({
      id: `theme-${option}`,
      group: 'action',
      label: t('theme', { name: t(`themes.${option}`) }),
      run: () => {
        setThemePreference(option)
        onDone()
      },
    })
  }

  return { items, isLoading: workspaces.isPending || boards.isPending || lists.isPending }
}
