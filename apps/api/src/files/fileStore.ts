import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * A feltöltött fájlok tárolója. A kulcs szerveroldali (ULID), a felhasználótól érkező fájlnév
 * sosem része az útvonalnak. Később S3-kompatibilis megvalósítás is bekötható ugyanezen a felületen.
 */
export interface FileStore {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  /** A hiányzó fájl törlése nem hiba. */
  delete(key: string): Promise<void>
}

const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/

const assertKey = (key: string) => {
  if (!SAFE_KEY.test(key)) throw new Error('Invalid storage key')
}

/** Lokális fájlrendszer (alapértelmezett; Dockerben a `/data` kötetén). */
export function createLocalFileStore(dir: string): FileStore {
  const resolve = (key: string) => {
    assertKey(key)
    return path.join(dir, key)
  }
  return {
    async put(key, data) {
      await mkdir(dir, { recursive: true })
      await writeFile(resolve(key), data)
    },
    get: (key) => readFile(resolve(key)),
    delete: (key) => rm(resolve(key), { force: true }),
  }
}

/** Memóriában tárol (tesztekhez). */
export function createMemoryFileStore(): FileStore & { keys(): string[] } {
  const files = new Map<string, Buffer>()
  return {
    async put(key, data) {
      assertKey(key)
      files.set(key, data)
    },
    async get(key) {
      const data = files.get(key)
      if (!data) throw new Error('File not found')
      return data
    },
    async delete(key) {
      files.delete(key)
    },
    keys: () => [...files.keys()],
  }
}
