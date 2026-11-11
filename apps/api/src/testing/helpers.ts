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
  const app = buildApp(
    loadConfig({
      NODE_ENV: 'test',
      // A tesztek sok kérést küldenek ugyanarról az IP-ről; a limitet külön tesztek szűkítik.
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
      ...env,
    }),
    db,
    { mailer },
  )
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

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** Egy bejelentkezett (vagy névtelen) kliens: JSON-t küld és vár vissza. */
export function client(app: App, cookie?: string) {
  const call = async (method: Method, url: string, payload?: object) => {
    const res = await app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: cookie ? { cookie } : {},
    })
    return { status: res.statusCode, body: res.body ? (res.json() as any) : null } // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return {
    get: (url: string) => call('GET', url),
    post: (url: string, payload?: object) => call('POST', url, payload),
    patch: (url: string, payload?: object) => call('PATCH', url, payload),
    put: (url: string, payload?: object) => call('PUT', url, payload),
    delete: (url: string) => call('DELETE', url),
  }
}
export type TestClient = ReturnType<typeof client>

/** Új felhasználó regisztrálása (nyitott regisztrációs módú alkalmazásban) és bejelentkezett kliense. */
export async function signUp(app: App, email: string, name = email.split('@')[0]!) {
  const { res, cookie } = await register(app, { email, name })
  if (res.statusCode !== 201) throw new Error(`signUp failed: ${res.body}`)
  const user = res.json() as { id: string; email: string; name: string }
  return { user, cookie, api: client(app, cookie) }
}

/** A legutóbbi levélből a tokenes hivatkozás tokenje. */
export const tokenFromLastMail = (mailer: { last(): { text: string } }): string => {
  const params = new URL(mailer.last().text.match(/https?:\/\/\S+/)![0]).searchParams
  return (params.get('token') ?? params.get('invite'))!
}
