const LAST_WORKSPACE_KEY = 'taskflow.lastWorkspace'

/** Az utoljára megnyitott munkaterület (böngészőnként), hogy a `/` oda vigyen. */
export const rememberWorkspace = (workspaceId: string) =>
  window.localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId)

export const getLastWorkspace = (): string | null => window.localStorage.getItem(LAST_WORKSPACE_KEY)
