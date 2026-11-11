import { describe, expect, it } from 'vitest'
import { createDb, runMigrations } from './client.js'
import { backfillWorkspaces } from './backfill.js'
import { boards, users, workspaceMembers, workspaces } from './schema.js'
import { slugify } from './workspaceFactory.js'

describe('backfillWorkspaces', () => {
  it('gives users a workspace and moves legacy boards into their creator workspace, idempotently', () => {
    const { db } = createDb(':memory:')
    runMigrations(db)
    db.insert(users)
      .values({ id: 'u1', name: 'Árvíztűrő Tükörfúrógép', email: 'a@example.com' })
      .run()
    db.insert(users)
      .values({ id: 'u2', name: 'Árvíztűrő Tükörfúrógép', email: 'b@example.com' })
      .run()
    db.insert(boards).values({ id: 'b1', title: 'Régi', createdBy: 'u1' }).run()

    backfillWorkspaces(db)
    backfillWorkspaces(db)

    const all = db.select().from(workspaces).all()
    expect(all).toHaveLength(2)
    expect(all.map((w) => w.slug).sort()).toEqual([
      'arvizturo-tukorfurogep',
      'arvizturo-tukorfurogep-2',
    ])
    expect(
      db
        .select()
        .from(workspaceMembers)
        .all()
        .every((m) => m.role === 'owner'),
    ).toBe(true)
    const board = db.select().from(boards).get()!
    const owner = db
      .select()
      .from(workspaceMembers)
      .all()
      .find((m) => m.userId === 'u1')!
    expect(board.workspaceId).toBe(owner.workspaceId)
  })
})

describe('slugify', () => {
  it('strips accents and symbols, with a fallback', () => {
    expect(slugify('Web App Fejlesztés (Csapat)')).toBe('web-app-fejlesztes-csapat')
    expect(slugify('???')).toBe('workspace')
  })
})
