import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_URL: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('./data/taskflow.db'),
  // A seed felhasználó nem tud belépni; az első regisztrált felhasználó átveszi az adatait.
  SEED: z.stringbool().default(true),
  /** Cookie-aláíró titok; élesben kötelező, legalább 32 karakter. */
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** `invite`: az első felhasználó (admin) szabadon regisztrálhat, utána csak meghívóval; `open`: bárki. */
  REGISTRATION_MODE: z.enum(['invite', 'open']).default('invite'),
  /** Kérés/perc IP-nként (a kliens IP-je a `CF-Connecting-IP` fejlécből jön). */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  /** Kérés/perc IP-nként a érzékeny auth végpontokra (login, regisztráció, jelszó-visszaállítás...). */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  /** Ennyi sikertelen belépés után a fiók 15 percre zárolódik. */
  LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(10),
  MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
  MAIL_FROM: z.string().default('TaskFlow <no-reply@localhost>'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
})

const DEV_SESSION_SECRET = 'dev-only-session-secret-change-me-in-production'

export type Config = Omit<z.infer<typeof envSchema>, 'SESSION_SECRET'> & { SESSION_SECRET: string }

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`)
  }
  const data = result.data
  if (data.NODE_ENV === 'production') {
    if (!data.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production')
    // A ConsoleMailer a tokenes hivatkozásokat a logba írná.
    if (data.MAIL_TRANSPORT !== 'smtp')
      throw new Error('MAIL_TRANSPORT=smtp is required in production')
    if (!(data.SMTP_USER && data.SMTP_PASS)) {
      throw new Error('SMTP_USER and SMTP_PASS are required when MAIL_TRANSPORT=smtp')
    }
  }
  return { ...data, SESSION_SECRET: data.SESSION_SECRET ?? DEV_SESSION_SECRET }
}
