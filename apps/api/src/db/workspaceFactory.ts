import { eq } from 'drizzle-orm'
import type { Db } from './client.js'
import { newId } from './ids.js'
import { workspaceMembers, workspaces } from './schema.js'

export const slugify = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace'

const uniqueSlug = (db: Db, name: string): string => {
  const base = slugify(name)
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (!db.select().from(workspaces).where(eq(workspaces.slug, candidate)).get()) return candidate
  }
}

/** Új munkaterület, a létrehozó `owner` szerepkörrel. Tranzakción belül is hívható. */
export function createWorkspace(db: Db, input: { name: string; ownerId: string }) {
  const workspace = db
    .insert(workspaces)
    .values({
      id: newId(),
      name: input.name,
      slug: uniqueSlug(db, input.name),
      createdBy: input.ownerId,
    })
    .returning()
    .get()
  db.insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId: input.ownerId, role: 'owner' })
    .run()
  return workspace
}
