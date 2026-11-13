#!/usr/bin/env -S npx tsx
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createApiClient } from './client.js'
import { createTaskflowMcpServer } from './tools.js'

// Helyben futtatva (Claude Desktop, Gemini CLI, OpenCode): TASKFLOW_URL + TASKFLOW_API_KEY.
const url = process.env.TASKFLOW_URL
const key = process.env.TASKFLOW_API_KEY
if (!url || !key) {
  console.error('TASKFLOW_URL (pl. https://taskflow.example.com) és TASKFLOW_API_KEY kötelező.')
  process.exit(1)
}

const api = createApiClient({
  baseUrl: `${url.replace(/\/+$/, '')}/api/v1`,
  headers: { authorization: `Bearer ${key}` },
})
await createTaskflowMcpServer(api).connect(new StdioServerTransport())
