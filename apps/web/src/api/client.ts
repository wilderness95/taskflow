/** A backend egységes hibaformátumának (`{ error: { code, message, details } }`) kliensoldali alakja. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const BASE_URL = '/api/v1'

type Body = Record<string, unknown> | undefined

/** Az egyetlen hely, ahol a frontend `fetch`-et hív; a komponensek az `api/` függvényeken át érik el. */
export async function apiFetch<T = void>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: Body,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'unknown_error',
      error?.message ?? response.statusText,
      error?.details ?? null,
    )
  }

  return payload as T
}
