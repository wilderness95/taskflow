import { describe, expect, it } from 'vitest'
import { createDb, runMigrations } from './client.js'
import { seed } from './seed.js'
import * as s from './schema.js'

describe('db', () => {
  it('migrates and seeds idempotently', () => {
    const { db } = createDb(':memory:')
    runMigrations(db)
    expect(seed(db)).toBe(true)
    expect(seed(db)).toBe(false)
    expect(db.select().from(s.columns).all()).toHaveLength(3)
    expect(db.select().from(s.cards).all()).toHaveLength(4)
    expect(db.select().from(s.checklistItems).all()).toHaveLength(16)
    expect(db.select().from(s.labels).all()).toHaveLength(5)
  })
})
