import { writeFileSync } from 'node:fs'
import { buildOpenApiDocument } from './document.js'

/** `npm run openapi:export -w @taskflow/api`: az OpenAPI-leírás a `docs/openapi.json` fájlba. */
export const OPENAPI_FILE = new URL('../../../../docs/openapi.json', import.meta.url)

export const serializeOpenApi = (): string => `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  writeFileSync(OPENAPI_FILE, serializeOpenApi())
  console.log(`Wrote ${OPENAPI_FILE.pathname}`)
}
