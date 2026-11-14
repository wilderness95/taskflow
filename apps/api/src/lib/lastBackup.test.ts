import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lastBackupAt } from './lastBackup.js'

describe('lastBackupAt', () => {
  it('returns null without a directory, for a missing directory and for an empty one', () => {
    expect(lastBackupAt(undefined)).toBeNull()
    expect(lastBackupAt('/nonexistent/backups')).toBeNull()
    expect(lastBackupAt(mkdtempSync(path.join(tmpdir(), 'bk-')))).toBeNull()
  })

  it('returns the newest database backup and ignores other files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bk-'))
    const touch = (name: string, iso: string) => {
      const file = path.join(dir, name)
      writeFileSync(file, 'x')
      utimesSync(file, new Date(iso), new Date(iso))
    }
    touch('taskflow-20260101-030000.db.gz', '2026-01-01T03:00:00Z')
    touch('taskflow-20260102-030000.db.gz', '2026-01-02T03:00:00Z')
    touch('uploads-20260103-030000.tar.gz', '2026-01-03T03:00:00Z')
    expect(lastBackupAt(dir)?.toISOString()).toBe('2026-01-02T03:00:00.000Z')
  })
})
