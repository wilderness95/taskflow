import type { LightMyRequestResponse } from 'fastify'
import { buildApp } from '../app.js'
import { loadConfig } from '../config.js'
import { createDb, runMigrations } from '../db/client.js'
import { MemoryMailer } from '../mail/mailer.js'

export const PASSWORD = 'correct-horse-battery'

export function createTestApp(env: Record<string, string> = {}) {
  const { db } = createDb(':memory:')
  runMigrations(db)
  const mailer = new MemoryMailer()
  const app = buildApp(loadConfig({ NODE_ENV: 'test', ...env }), db, { mailer })
  return { app, db, mailer }
}

type App = ReturnType<typeof createTestApp>['app']

/** A `Set-Cookie` fejlécből a visszaküldhető `name=value` rész. */
export const cookieFrom = (res: LightMyRequestResponse): string => {
  const header = res.headers['set-cookie']
  const first = Array.isArray(header) ? header[0] : header
  return first?.split(';')[0] ?? ''
}

export async function register(
  app: App,
  body: { email: string; name?: string; password?: string; inviteToken?: string },
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Teszt Elek', password: PASSWORD, ...body },
  })
  return { res, cookie: cookieFrom(res) }
}

export async function login(app: App, email: string, password = PASSWORD) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  })
  return { res, cookie: cookieFrom(res) }
}
