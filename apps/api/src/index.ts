import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDb, runMigrations } from './db/client.js'
import { seed } from './db/seed.js'

const config = loadConfig()
const { db, sqlite } = createDb(config.DATABASE_URL)
runMigrations(db)
if (config.SEED) seed(db)
const app = buildApp(config, db)

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  sqlite.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

app.listen({ host: config.HOST, port: config.PORT }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
