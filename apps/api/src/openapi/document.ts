import { z } from 'zod'
import { errorResponseSchema } from '@taskflow/shared'
import { idParamsSchema, operations, type Operation } from './operations.js'

type Json = Record<string, unknown>

const jsonSchema = (schema: z.ZodType, io: 'input' | 'output'): Json => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    io,
    target: 'draft-2020-12',
  }) as Json
  return rest
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation error',
  404: 'Not found',
  409: 'Conflict',
  422: 'Unprocessable',
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
  const params = [
    ...(op.path.includes('{id}') ? parameters(idParamsSchema, 'path') : []),
    ...(op.query ? parameters(op.query, 'query') : []),
  ]
  const errorRef = {
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
  }
  const errorStatuses = new Set([
    404,
    ...(op.body || op.query || op.path.includes('{id}') ? [400] : []),
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
    components: { schemas: { ErrorResponse: jsonSchema(errorResponseSchema, 'output') } },
  }
}
