import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createApiClient, createTaskflowMcpServer } from '@taskflow/mcp'
import type { FastifyInstance } from 'fastify'
import type { ToolDeclaration } from './liveConnector.js'

export interface ToolHost {
  tools: ToolDeclaration[]
  /** A `boardId`-t nem megadó hívásoknál ez kerül be. */
  call(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; text: string }>
  close(): Promise<void>
}

/**
 * A hangmunkamenet eszközei: az `@taskflow/mcp` szerver memórián belüli átvitellel, az API-t a
 * saját folyamatban (`inject`) hívva, a belépett felhasználó session cookie-jával. Így minden
 * hívás a szokásos auth + service-réteg + policy útján megy (nincs külön jogosultsági út), és a
 * tábla SSE-csatornája is frissül.
 */
export async function createToolHost(
  app: FastifyInstance,
  opts: { cookie: string; clientIp?: string; defaultBoardId: string },
): Promise<ToolHost> {
  const api = createApiClient({
    baseUrl: 'http://taskflow.internal/api/v1',
    headers: {
      cookie: opts.cookie,
      ...(opts.clientIp ? { 'cf-connecting-ip': opts.clientIp } : {}),
    },
    fetch: async (url, init) => {
      const u = new URL(url)
      const res = await app.inject({
        method: (init?.method ?? 'GET') as 'GET',
        url: u.pathname + u.search,
        headers: init?.headers as Record<string, string>,
        payload: init?.body as string | undefined,
      })
      return new Response(res.body || null, {
        status: res.statusCode,
        headers: { 'content-type': String(res.headers['content-type'] ?? 'application/json') },
      })
    },
  })
  const server = createTaskflowMcpServer(api)
  const client = new Client({ name: 'taskflow-voice', version: '0.0.0' })
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])

  const listed = await client.listTools()
  const tools: ToolDeclaration[] = listed.tools.map((t) => {
    const { $schema: _omit, ...schema } = t.inputSchema as Record<string, unknown>
    return { name: t.name, description: t.description, parametersJsonSchema: schema }
  })
  const withBoard = new Set(
    listed.tools
      .filter((t) => 'boardId' in ((t.inputSchema.properties as object | undefined) ?? {}))
      .map((t) => t.name),
  )

  return {
    tools,
    async call(name, args) {
      const finalArgs =
        withBoard.has(name) && args.boardId === undefined
          ? { ...args, boardId: opts.defaultBoardId }
          : args
      const res = await client.callTool({ name, arguments: finalArgs })
      const text = (res.content as { type: string; text?: string }[])
        .map((c) => c.text ?? '')
        .join('\n')
      return { ok: !res.isError, text }
    },
    async close() {
      await client.close()
      await server.close()
    },
  }
}
