import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiClient } from './client.js'
import { registerBoardTools } from './tools/boards.js'
import { registerCardTools } from './tools/cards.js'
import { registerChecklistTools } from './tools/checklists.js'
import { registerColumnTools } from './tools/columns.js'
import { registerCommentTools } from './tools/comments.js'
import { createToolContext } from './tools/context.js'
import { registerLabelTools } from './tools/labels.js'

export interface McpServerOptions {
  name?: string
  version?: string
}

/**
 * A TaskFlow MCP szervere: beszédbarát eszközök az API fölött (táblák, oszlopok, kártyák,
 * checklisták, címkék, hozzászólások). Az átvitelt (stdio, memória) a hívó köti rá; a
 * jogosultságot az `ApiClient` hitelesítése adja, az eszközök nem kerülik meg az API-t.
 */
export function createTaskflowMcpServer(api: ApiClient, opts: McpServerOptions = {}): McpServer {
  const server = new McpServer({ name: opts.name ?? 'taskflow', version: opts.version ?? '0.0.0' })
  const ctx = createToolContext(server, api)
  registerBoardTools(ctx)
  registerColumnTools(ctx)
  registerCardTools(ctx)
  registerChecklistTools(ctx)
  registerCommentTools(ctx)
  registerLabelTools(ctx)
  return server
}
