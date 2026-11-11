import { z } from 'zod'
import { errorResponseSchema, idSchema } from '@taskflow/shared'
import { operations, type Operation } from './operations.js'

type Json = Record<string, unknown>

const jsonSchema = (schema: z.ZodType, io: 'input' | 'output'): Json => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    io,
    target: 'draft-2020-12',
  }) as Json
  return rest
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation error or invalid token',
  401: 'Not authenticated',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  422: 'Unprocessable',
  429: 'Too many requests',
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
  const errorRef = {
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  }
  const hasId = pathParams.length > 0
  const errorStatuses = new Set([
    ...(hasId ? [404] : []),
    ...(op.body || op.query || hasId ? [400] : []),
    ...(op.public ? [] : [401]),
    ...(op.errors ?? []),
  ])
  const responses: Json = {
    [op.success.status]: {
      description: 'Success',
      ...(op.success.schema && {
        content: { 'application/json': { schema: jsonSchema(op.success.schema, 'output') } },
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
    operationId: `${op.method}_${op.path.replace(/[{}]/g, '').replace(/\W+/g, '_').replace(/^_|_$/g, '')}`,
    ...(params.length > 0 && { parameters: params }),
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
    security: [{ cookieAuth: [] }],
    components: {
      securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'tf_session' } },
      schemas: { ErrorResponse: jsonSchema(errorResponseSchema, 'output') },
    },
  }
}
