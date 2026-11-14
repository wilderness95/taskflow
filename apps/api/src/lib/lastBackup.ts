import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * A legutóbbi adatbázis-mentés ideje a mentés-könyvtárban (`taskflow-*.db.gz`, a `backup` sidecar
 * kimenete). `null`, ha nincs beállított könyvtár, nem olvasható, vagy még nincs mentés.
 */
export function lastBackupAt(dir: string | undefined): Date | null {
  if (!dir) return null
  try {
    let newest: Date | null = null
    for (const name of readdirSync(dir)) {
      if (!/^taskflow-.+\.db\.gz$/.test(name)) continue
      const mtime = statSync(path.join(dir, name)).mtime
      if (!newest || mtime > newest) newest = mtime
    }
    return newest
  } catch {
    return null
  }
}
