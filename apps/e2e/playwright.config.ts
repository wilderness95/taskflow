import { defineConfig, devices } from '@playwright/test'

// A tesztek saját, memóriában élő adatbázisú API-t és a Vite fejlesztői szervert indítják
// (a /api kéréseket a Vite proxyzza). Titok nincs: a konzolos levelezés és a fix teszt-secret csak itt él.
const API_PORT = 3101
const WEB_PORT = 5174
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './tests',
  // Egyetlen közös (memória) adatbázis: a tesztek egyedi e-mail-címekkel futnak egymás után.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    locale: 'hu-HU',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start -w @taskflow/api',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        HOST: '127.0.0.1',
        NODE_ENV: 'development',
        LOG_LEVEL: 'warn',
        DATABASE_URL: ':memory:',
        APP_URL: WEB_URL,
        SEED: 'false',
        SESSION_SECRET: 'e2e-only-session-secret-not-a-real-secret-0123456789',
        REGISTRATION_MODE: 'open',
        MAIL_TRANSPORT: 'console',
        RATE_LIMIT_MAX: '100000',
        AUTH_RATE_LIMIT_MAX: '100000',
      },
    },
    {
      command: `npm run dev -w @taskflow/web -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_URL: `http://localhost:${API_PORT}` },
    },
  ],
})
