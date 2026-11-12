import { describe, expect, it } from 'vitest'
import { requiredScope } from './scopes.js'

describe('requiredScope', () => {
  it.each([
    ['GET', '/api/v1/auth/me', null],
    ['PATCH', '/api/v1/auth/me', 'session'],
    ['POST', '/api/v1/auth/logout', 'session'],
    ['GET', '/api/v1/api-keys', 'session'],
    ['POST', '/api/v1/api-keys', 'session'],
    ['GET', '/api/v1/notifications', 'session'],
    ['POST', '/api/v1/notifications/read-all', 'session'],
    ['POST', '/api/v1/notifications/n1/read', 'session'],
    ['POST', '/api/v1/invitations', 'session'],
    ['GET', '/api/v1/workspaces', 'workspaces:read'],
    ['POST', '/api/v1/workspaces', 'session'],
    ['PATCH', '/api/v1/workspaces/w1', 'session'],
    ['GET', '/api/v1/workspaces/w1/members', 'workspaces:read'],
    ['PATCH', '/api/v1/workspaces/w1/members/u1', 'session'],
    ['GET', '/api/v1/workspaces/w1/invitations', 'session'],
    ['POST', '/api/v1/workspaces/w1/invitations', 'session'],
    ['GET', '/api/v1/workspaces/w1/boards', 'boards:read'],
    ['POST', '/api/v1/workspaces/w1/boards', 'boards:write'],
    ['GET', '/api/v1/boards/b1', 'boards:read'],
    ['GET', '/api/v1/boards/b1/snapshot', 'boards:read'],
    ['GET', '/api/v1/boards/b1/members', 'boards:read'],
    ['PUT', '/api/v1/boards/b1/members/u1', 'session'],
    ['PUT', '/api/v1/boards/b1/star', 'session'],
    ['POST', '/api/v1/boards/b1/columns', 'boards:write'],
    ['POST', '/api/v1/cards/c1/move', 'boards:write'],
    ['DELETE', '/api/v1/cards/c1', 'boards:write'],
  ])('%s %s -> %s', (method, path, expected) => {
    expect(requiredScope(method, path)).toBe(expected)
  })
})
