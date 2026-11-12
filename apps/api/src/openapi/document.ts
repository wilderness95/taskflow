import { z } from 'zod'
import { boardEventSchema, errorResponseSchema, idSchema } from '@taskflow/shared'
import { operations, type Operation } from './operations.js'

type Json = Record<string, unknown>

const jsonSchema = (schema: z.ZodType, io: 'input' | 'output'): Json => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    io,
    target: 'draft-2020-12',
  }) as Json
  return rest
}

const WRITE_TAGS = new Set([
  'Boards',
  'Columns',
  'Cards',
  'Checklists',
  'Comments',
  'Attachments',
  'API keys',
])

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation error or invalid token',
  401: 'Not authenticated',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  413: 'File too large',
  415: 'Unsupported media type',
  422: 'Unprocessable',
  429: 'Too many requests',
  503: 'Service unavailable',
}

const parameters = (schema: z.ZodObject, location: 'path' | 'query'): Json[] => {
  const json = jsonSchema(schema, 'input') as {
    properties?: Record<string, Json>
    required?: string[]
  }
  return Object.entries(json.properties ?? {}).map(([name, s]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: s,
  }))
}

const operationObject = (op: Operation): Json => {
  const pathParams = [...op.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string)
  const params = [
    ...parameters(z.object(Object.fromEntries(pathParams.map((name) => [name, idSchema]))), 'path'),
    ...(op.query ? parameters(op.query, 'query') : []),
  ]
  // Író műveleteknél opcionális `Idempotency-Key` (a bejelentkezés előtti auth végpontokon nincs értelme).
  const allParams: Json[] =
    op.method !== 'get' && !op.public
      ? [
          ...params,
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            description:
              'Same key + same request returns the stored response (header `Idempotent-Replayed: true`) instead of repeating the write. Reusing a key with a different request is a 422; stored for 24 hours.',
            schema: { type: 'string', minLength: 1, maxLength: 255 },
          },
        ]
      : params
  const errorRef = {
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  }
  const hasId = pathParams.length > 0
  const errorStatuses = new Set([
    ...(hasId ? [404] : []),
    ...(op.body || op.query || hasId ? [400] : []),
    ...(op.public ? [] : [401]),
    // A tartalom módosítása jogosultsághoz kötött (a nem olvasható erőforrás 404).
    ...(op.method !== 'get' && WRITE_TAGS.has(op.tag) ? [403] : []),
    ...(op.errors ?? []),
  ])
  const responses: Json = {
    [op.success.status]: {
      description: op.success.status === 101 ? 'Switching Protocols' : 'Success',
      ...(op.success.schema && {
        content: { 'application/json': { schema: jsonSchema(op.success.schema, 'output') } },
      }),
      ...(op.download && {
        content: { '*/*': { schema: { type: 'string', format: 'binary' } } },
      }),
      ...(op.stream && {
        content: {
          'text/event-stream': { schema: jsonSchema(boardEventSchema, 'output') },
        },
      }),
    },
  }
  for (const status of [...errorStatuses].sort()) {
    responses[status] = { description: ERROR_DESCRIPTIONS[status] ?? 'Error', ...errorRef }
  }
  return {
    tags: [op.tag],
    ...(op.public ? { security: [] } : {}),
    summary: op.summary,
    ...(op.description && { description: op.description }),
    operationId: `${op.method}_${op.path.replace(/[{}]/g, '').replace(/\W+/g, '_').replace(/^_|_$/g, '')}`,
    ...(allParams.length > 0 && { parameters: allParams }),
    ...(op.upload && {
      requestBody: {
        required: true,
        description:
          'The raw file content; the `Content-Type` header is the file type, the file name goes into the `name` query parameter.',
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      },
    }),
    ...(op.body && {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: jsonSchema(op.body, 'input') } },
      },
    }),
    responses,
  }
}

export function buildOpenApiDocument(): Json {
  const paths: Record<string, Json> = {}
  for (const op of operations) {
    paths[op.path] = { ...paths[op.path], [op.method]: operationObject(op) }
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'TaskFlow API',
      version: '1.0.0',
      description: 'REST API of TaskFlow. Errors use `{ error: { code, message, details } }`.',
    },
    servers: [{ url: '/api/v1' }],
    paths,
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'tf_session' },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key (`tfk_...`), created under Settings → API keys.',
        },
      },
      schemas: { ErrorResponse: jsonSchema(errorResponseSchema, 'output') },
    },
  }
}
