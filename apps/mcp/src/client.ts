import { randomUUID } from 'node:crypto'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface ApiClientOptions {
  /** Az API alap URL-je, pl. `https://taskflow.example.com/api/v1`. */
  baseUrl: string
  /** Fix fejlécek (pl. `Authorization: Bearer tfk_...` vagy a session `cookie`). */
  headers?: Record<string, string>
  /** Cserélhető `fetch` (tesztben, illetve a szerveren a belső, `inject`-alapú hívásra). */
  fetch?: FetchLike
  /** Hálózati hiba utáni újrapróbálkozások száma (alap: 2). */
  retries?: number
  /** Várakozás az újrapróbálkozás előtt ms-ban (alap: 200, próbálkozásonként duplázódik). */
  retryDelayMs?: number
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

export interface ApiClient {
  get<T = unknown>(path: string, query?: RequestOptions['query']): Promise<T>
  post<T = unknown>(path: string, body?: unknown): Promise<T>
  patch<T = unknown>(path: string, body?: unknown): Promise<T>
  delete<T = unknown>(path: string): Promise<T>
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Az API-t hívó vékony HTTP wrapper. Minden író kéréshez automatikusan `Idempotency-Key`-t
 * (UUID) generál; hálózati hiba esetén ugyanazzal a kulccsal újrapróbál, így a művelet
 * legfeljebb egyszer hajtódik végre.
 */
export function createApiClient(opts: ApiClientOptions): ApiClient {
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init))
  const retries = opts.retries ?? 2
  const baseDelay = opts.retryDelayMs ?? 200
  const base = opts.baseUrl.replace(/\/+$/, '')

  async function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    const url = new URL(base + path)
    for (const [k, v] of Object.entries(o.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
    const headers: Record<string, string> = { accept: 'application/json', ...opts.headers }
    if (o.body !== undefined) headers['content-type'] = 'application/json'
    if (UNSAFE.has(method)) headers['idempotency-key'] = randomUUID()
    const init: RequestInit = {
      method,
      headers,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    }

    let res: Response | undefined
    for (let attempt = 0; ; attempt++) {
      try {
        res = await doFetch(url.toString(), init)
        break
      } catch (err) {
        if (attempt >= retries) {
          throw new ApiError(0, 'network_error', err instanceof Error ? err.message : String(err))
        }
        await sleep(baseDelay * 2 ** attempt)
      }
    }

    const text = await res.text()
    const json: unknown = text ? safeParse(text) : undefined
    if (!res.ok) {
      const e = (
        json as { error?: { code?: string; message?: string; details?: unknown } } | undefined
      )?.error
      throw new ApiError(
        res.status,
        e?.code ?? 'http_error',
        e?.message ?? res.statusText,
        e?.details,
      )
    }
    return json as T
  }

  return {
    get: (path, query) => request('GET', path, { query }),
    post: (path, body) => request('POST', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    delete: (path) => request('DELETE', path),
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
