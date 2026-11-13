import { z } from 'zod'
import { norm, ResolveError, resolveOne } from '../resolve.js'
import type { ToolContext } from './context.js'

interface Workspace {
  id: string
  name: string
}
interface ListSummary {
  id: string
  workspaceId: string
  title: string
  itemCount: number
  doneCount: number
}
interface Section {
  id: string
  title: string
}
interface Item {
  id: string
  text: string
  done: boolean
  recurring: boolean
  sectionId: string | null
}
interface ListDetail extends ListSummary {
  sections: Section[]
  items: Item[]
}

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i

const listRef = z.string().describe('List name or id')
const workspaceRef = z.string().optional().describe('Workspace name or id; may be omitted')

/**
 * Listák (teendő-, bevásárlólista): munkaterület-szintű, egyszerű listák szakaszokkal és tételekkel.
 * Nem táblák és nem kártyák: a „lista”, „bevásárlólista”, „teendőlista” kérésekhez ezek az eszközök valók.
 */
export function registerListTools({ define, api }: ToolContext) {
  const workspaces = async () => (await api.get<{ data: Workspace[] }>('/workspaces')).data

  const pickWorkspace = (all: Workspace[], ref?: string): Workspace => {
    if (ref) {
      return resolveOne(
        'workspace',
        ref,
        all,
        (w) => [w.name],
        (w) => w.id,
      )
    }
    if (all.length === 1) return all[0]!
    return resolveOne(
      'workspace',
      '',
      all,
      (w) => [w.name],
      (w) => w.id,
    )
  }

  /** A munkaterület(ek) listái; `archived`: az archivált listák. */
  const listsOf = async (all: Workspace[], archived = false) => {
    const out: (ListSummary & { workspace: string })[] = []
    for (const ws of all) {
      const { data } = await api.get<{ data: ListSummary[] }>(
        `/workspaces/${ws.id}/lists`,
        archived ? { archived: true } : undefined,
      )
      out.push(...data.map((l) => ({ ...l, workspace: ws.name })))
    }
    return out
  }

  /** Lista azonosító vagy név alapján (a munkaterületeken át); a teljes tartalommal. */
  const findList = async (ref: string, workspace?: string, archived = false) => {
    if (ULID.test(ref)) return api.get<ListDetail>(`/lists/${ref}`)
    const all = await workspaces()
    const found = resolveOne(
      'list',
      ref,
      await listsOf(workspace ? [pickWorkspace(all, workspace)] : all, archived),
      (l) => [l.title],
      (l) => l.id,
    )
    return api.get<ListDetail>(`/lists/${found.id}`)
  }

  /** A szakasz névvel; ha nincs ilyen, létrehozza (a „tejtermék” szakaszba tétel kérése természetes). */
  const sectionFor = async (list: ListDetail, name: string): Promise<Section> => {
    const existing = list.sections.find((s) => norm(s.title) === norm(name))
    if (existing) return existing
    const created = await api.post<Section>(`/lists/${list.id}/sections`, { title: name.trim() })
    list.sections.push(created)
    return created
  }

  const addItems = async (
    list: ListDetail,
    texts: string[],
    section?: string,
    recurring = false,
  ) => {
    const sectionId = section ? (await sectionFor(list, section)).id : null
    for (const text of texts) {
      await api.post(`/lists/${list.id}/items`, { text, sectionId, recurring })
    }
    return texts.length
  }

  const describe = (list: ListDetail) => ({
    id: list.id,
    title: list.title,
    done: `${list.items.filter((i) => i.done).length}/${list.items.length}`,
    sections: list.sections.map((s) => s.title),
    items: list.items.map((i) => ({
      text: i.text,
      done: i.done,
      ...(i.recurring ? { recurring: true } : {}),
      section: list.sections.find((s) => s.id === i.sectionId)?.title ?? null,
    })),
  })

  const findItem = (list: ListDetail, ref: string) =>
    resolveOne(
      'list item',
      ref,
      list.items,
      (i) => [i.text],
      (i) => i.id,
    )

  define(
    'list_lists',
    'List the simple lists (to-do lists, shopping lists), NOT boards: id, title, workspace, progress. Use for any request about a "list", "shopping list" or "to-do list".',
    {
      workspace: workspaceRef,
      archived: z.boolean().optional().describe('true: only archived lists'),
    },
    async (a) => {
      const all = await workspaces()
      const chosen = a.workspace ? [pickWorkspace(all, a.workspace)] : all
      return (await listsOf(chosen, a.archived)).map((l) => ({
        id: l.id,
        title: l.title,
        workspace: l.workspace,
        done: `${l.doneCount}/${l.itemCount}`,
      }))
    },
  )

  define(
    'get_list',
    'Read a list: its sections and items (text, done, recurring, section).',
    { list: listRef, workspace: workspaceRef },
    async (a) => describe(await findList(a.list, a.workspace)),
  )

  define(
    'create_list',
    'Create a new simple list (e.g. a shopping list or a to-do list). This is NOT a board: use it whenever the user asks for a "list". Optionally add items right away, plain or grouped into sections. The workspace may be omitted when the user has only one.',
    {
      title: z.string().min(1).max(200),
      workspace: workspaceRef,
      items: z.array(z.string().min(1)).optional().describe('Items without a section'),
      sections: z
        .array(z.object({ title: z.string().min(1), items: z.array(z.string().min(1)).optional() }))
        .optional()
        .describe('Sections with their items, e.g. "Dairy": ["milk", "butter"]'),
    },
    async (a) => {
      const ws = pickWorkspace(await workspaces(), a.workspace)
      const created = await api.post<ListSummary>(`/workspaces/${ws.id}/lists`, { title: a.title })
      const list: ListDetail = { ...created, sections: [], items: [] }
      let added = await addItems(list, a.items ?? [])
      for (const section of a.sections ?? []) {
        const made = await sectionFor(list, section.title)
        added += await addItems(list, section.items ?? [], made.title)
      }
      return { listId: list.id, title: list.title, workspace: ws.name, itemsAdded: added }
    },
  )

  define(
    'add_list_items',
    'Add one or more items to a list, optionally into a section (created when new). `recurring` items are reopened by reset_list_recurring (e.g. weekly groceries).',
    {
      list: listRef,
      items: z.array(z.string().min(1)).min(1),
      section: z.string().optional().describe('Section name; created when it does not exist'),
      recurring: z.boolean().optional(),
      workspace: workspaceRef,
    },
    async (a) => {
      const list = await findList(a.list, a.workspace)
      const added = await addItems(list, a.items, a.section, a.recurring)
      return { added, list: list.title }
    },
  )

  define(
    'update_list_item',
    'Tick or untick a list item, rename it, move it to a section, mark it recurring, or remove it. The item is found by its text (part of it is enough).',
    {
      list: listRef,
      item: z.string().describe('Text of the item'),
      done: z.boolean().optional(),
      text: z.string().min(1).max(300).optional().describe('New text'),
      recurring: z.boolean().optional(),
      section: z
        .string()
        .optional()
        .describe('Move to this section (created when new); "none" removes the section'),
      remove: z.boolean().optional().describe('true: delete the item'),
      workspace: workspaceRef,
    },
    async (a) => {
      const list = await findList(a.list, a.workspace)
      const item = findItem(list, a.item)
      if (a.remove) {
        await api.delete(`/list-items/${item.id}`)
        return { removed: item.text }
      }
      const body = { done: a.done, text: a.text, recurring: a.recurring }
      const changes = Object.values(body).some((v) => v !== undefined)
      if (!changes && a.section === undefined) {
        throw new ResolveError('Give done, text, recurring, section or remove')
      }
      if (changes) await api.patch(`/list-items/${item.id}`, body)
      if (a.section !== undefined) {
        const none = a.section.trim().toLowerCase() === 'none' || a.section.trim() === ''
        const sectionId = none ? null : (await sectionFor(list, a.section)).id
        await api.post(`/list-items/${item.id}/move`, { sectionId })
      }
      return { updated: a.text ?? item.text }
    },
  )

  define(
    'set_list_items_done',
    'Tick (or untick) several items of a list in one go, e.g. "I bought the milk and the bread". Items are found by text; fails without changing anything when one cannot be found.',
    {
      list: listRef,
      items: z.array(z.string().min(1)).min(1),
      done: z.boolean().optional().describe('Default true'),
      workspace: workspaceRef,
    },
    async (a) => {
      const list = await findList(a.list, a.workspace)
      // Először mindet feloldjuk, így hibánál nem marad félig kipipált lista.
      const found = a.items.map((ref) => findItem(list, ref))
      const done = a.done ?? true
      for (const item of found) await api.patch(`/list-items/${item.id}`, { done })
      return { updated: found.map((i) => i.text), done }
    },
  )

  define(
    'update_list',
    'Rename a list, archive it, or restore an archived one. Archiving hides the list (nothing is deleted); ask the user to confirm first.',
    {
      list: listRef,
      title: z.string().min(1).max(200).optional().describe('New title'),
      archive: z.boolean().optional().describe('true: archive the list'),
      restore: z.boolean().optional().describe('true: restore an archived list'),
      workspace: workspaceRef,
    },
    async (a) => {
      if (a.title === undefined && !a.archive && !a.restore) {
        throw new ResolveError('Give a new title, archive or restore')
      }
      const list = await findList(a.list, a.workspace, a.restore === true)
      if (a.title !== undefined) await api.patch(`/lists/${list.id}`, { title: a.title })
      if (a.archive) await api.post(`/lists/${list.id}/archive`)
      if (a.restore) await api.post(`/lists/${list.id}/restore`)
      return {
        list: a.title ?? list.title,
        ...(a.archive ? { archived: true } : {}),
        ...(a.restore ? { restored: true } : {}),
      }
    },
  )

  define(
    'clear_list_done',
    'Delete the ticked items of a list that are not recurring (recurring ones stay). Ask the user to confirm first.',
    { list: listRef, workspace: workspaceRef },
    async (a) => {
      const list = await findList(a.list, a.workspace)
      const result = await api.post<{ affected: number }>(`/lists/${list.id}/clear-done`)
      return { removed: result.affected, list: list.title }
    },
  )

  define(
    'reset_list_recurring',
    "Reopen (untick) the ticked recurring items of a list, e.g. to start next week's shopping.",
    { list: listRef, workspace: workspaceRef },
    async (a) => {
      const list = await findList(a.list, a.workspace)
      const result = await api.post<{ affected: number }>(`/lists/${list.id}/reset-recurring`)
      return { reopened: result.affected, list: list.title }
    },
  )
}
