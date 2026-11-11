import { loadConfig } from '../config.js'
import { createDb, runMigrations } from './client.js'
import { seed } from './seed.js'

const { db, sqlite } = createDb(loadConfig().DATABASE_URL)
runMigrations(db)
const seeded = process.argv.includes('--seed') ? seed(db) : false
console.log(seeded ? 'Migrated and seeded' : 'Migrated')
sqlite.close()
