export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string = code,
    public readonly details: unknown = null,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (resource: string) =>
  new AppError(404, 'not_found', `${resource} not found`)

export function orNotFound<T>(value: T | undefined | null, resource: string): T {
  if (value === undefined || value === null) throw notFound(resource)
  return value
}
