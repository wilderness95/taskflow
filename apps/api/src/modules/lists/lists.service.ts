import { generateKeyBetween } from 'fractional-indexing'
import {
  MAX_LIST_ITEMS,
  MAX_LIST_SECTIONS,
  MAX_LISTS_PER_WORKSPACE,
  type CreateListInput,
  type CreateListItemInput,
  type CreateListSectionInput,
  type ListDetailDto,
  type ListItemDto,
  type ListSectionDto,
  type ListSummaryDto,
  type MoveListItemInput,
  type MoveListSectionInput,
  type UpdateListInput,
  type UpdateListItemInput,
  type UpdateListSectionInput,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { AppError, orNotFound } from '../../errors.js'
import { positionBefore } from '../../lib/position.js'
import type { AccessService } from '../access/access.service.js'
import type { ActivityService } from '../activity/activity.service.js'
import type { ListItemRow, ListRow, ListSectionRow, ListsRepository } from './lists.repository.js'

const toSectionDto = (r: ListSectionRow): ListSectionDto => ({
  id: r.id,
  listId: r.listId,
  title: r.title,
  position: r.position,
})
const toItemDto = (r: ListItemRow): ListItemDto => ({
  id: r.id,
  listId: r.listId,
  sectionId: r.sectionId,
  text: r.text,
  done: r.done,
  recurring: r.recurring,
  position: r.position,
  version: r.version,
  createdAt: r.createdAt.toISOString(),
})
const toSummary = (r: ListRow, total = 0, done = 0): ListSummaryDto => ({
  id: r.id,
  workspaceId: r.workspaceId,
  title: r.title,
  itemCount: total,
  doneCount: done,
  archivedAt: r.archivedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
})

/**
 * Teendő- és bevásárlólisták. A hozzáférést a munkaterületi szerepkör adja (`list:read` /
 * `list:write`); minden írás naplózódik, és a lista SSE csatornájára is kimegy.
 */
export function createListsService(
  repo: ListsRepository,
  access: AccessService,
  activity: ActivityService,
) {
  const log = (
    actor: Actor,
    list: Pick<ListRow, 'id' | 'workspaceId'>,
    action: string,
    entityType: string,
    entityId: string,
    meta: Record<string, unknown> = {},
  ) =>
    activity.record(actor, {
      workspaceId: list.workspaceId,
      listId: list.id,
      action,
      entityType,
      entityId,
      meta: { listId: list.id, ...meta },
    })

  const summary = (list: ListRow): ListSummaryDto => {
    const items = repo.itemsOf(list.id)
    return toSummary(list, items.length, items.filter((i) => i.done).length)
  }

  const detail = (list: ListRow, myRole: ListDetailDto['myRole']): ListDetailDto => {
    const items = repo.itemsOf(list.id)
    return {
      ...toSummary(list, items.length, items.filter((i) => i.done).length),
      myRole,
      sections: repo.sectionsOf(list.id).map(toSectionDto),
      items: items.map(toItemDto),
    }
  }

  /** A szakasznak ugyanahhoz a listához kell tartoznia (különben 422). */
  const checkSection = (listId: string, sectionId: string | null | undefined): string | null => {
    if (!sectionId) return null
    const section = repo.findSection(sectionId)
    if (!section || section.listId !== listId) {
      throw new AppError(422, 'invalid_section', 'Section does not belong to this list', {
        sectionId,
      })
    }
    return section.id
  }

  const assertVersion = (item: ListItemRow, expected: number | undefined) => {
    if (expected === undefined || expected === item.version) return
    throw new AppError(409, 'version_conflict', 'The item was modified by someone else', {
      currentVersion: item.version,
      item: toItemDto(item),
    })
  }

  const itemOf = (id: string) => orNotFound(repo.findItem(id), 'List item')
  const sectionOf = (id: string) => orNotFound(repo.findSection(id), 'List section')

  return {
    list(actor: Actor, workspaceId: string, archived: boolean): ListSummaryDto[] {
      access.requireWorkspace(actor, workspaceId, 'list:read')
      const counts = repo.itemCounts(workspaceId)
      return repo
        .listsOfWorkspace(workspaceId, archived)
        .map((l) => toSummary(l, counts.get(l.id)?.total, counts.get(l.id)?.done))
    },

    create(actor: Actor, workspaceId: string, input: CreateListInput): ListSummaryDto {
      access.requireWorkspace(actor, workspaceId, 'list:write')
      if (repo.countActiveLists(workspaceId) >= MAX_LISTS_PER_WORKSPACE) {
        throw new AppError(422, 'too_many_lists', 'Too many lists in this workspace', {
          limit: MAX_LISTS_PER_WORKSPACE,
        })
      }
      const row = repo.insertList({
        id: newId(),
        workspaceId,
        title: input.title,
        createdBy: actor.id,
      })
      log(actor, row, 'list.created', 'list', row.id, { title: row.title })
      return toSummary(row)
    },

    get(actor: Actor, listId: string): ListDetailDto {
      const { list, role } = access.requireList(actor, listId, 'list:read')
      return detail(list, role)
    },

    update(actor: Actor, listId: string, input: UpdateListInput): ListSummaryDto {
      const { list } = access.requireList(actor, listId, 'list:write')
      const row = orNotFound(repo.updateList(listId, { title: input.title }), 'List')
      log(actor, list, 'list.updated', 'list', listId, { title: input.title })
      return summary(row)
    },

    archive(actor: Actor, listId: string): ListSummaryDto {
      const { list } = access.requireList(actor, listId, 'list:write')
      const row = orNotFound(repo.updateList(listId, { archivedAt: new Date() }), 'List')
      log(actor, list, 'list.archived', 'list', listId, { title: list.title })
      return summary(row)
    },

    restore(actor: Actor, listId: string): ListSummaryDto {
      const { list } = access.requireList(actor, listId, 'list:write', true)
      if (repo.countActiveLists(list.workspaceId) >= MAX_LISTS_PER_WORKSPACE) {
        throw new AppError(422, 'too_many_lists', 'Too many lists in this workspace', {
          limit: MAX_LISTS_PER_WORKSPACE,
        })
      }
      const row = orNotFound(repo.updateList(listId, { archivedAt: null }), 'List')
      log(actor, list, 'list.restored', 'list', listId, { title: list.title })
      return summary(row)
    },

    // --- szakaszok ---
    createSection(actor: Actor, listId: string, input: CreateListSectionInput): ListSectionDto {
      const { list } = access.requireList(actor, listId, 'list:write')
      const sections = repo.sectionsOf(listId)
      if (sections.length >= MAX_LIST_SECTIONS) {
        throw new AppError(422, 'too_many_sections', 'Too many sections on this list', {
          limit: MAX_LIST_SECTIONS,
        })
      }
      const row = repo.insertSection({
        id: newId(),
        listId,
        title: input.title,
        position: generateKeyBetween(sections.at(-1)?.position ?? null, null),
      })
      log(actor, list, 'list_section.created', 'list_section', row.id, { title: row.title })
      return toSectionDto(row)
    },

    updateSection(actor: Actor, id: string, input: UpdateListSectionInput): ListSectionDto {
      const { list } = access.requireListSection(actor, id, 'list:write')
      const row = orNotFound(repo.updateSection(id, { title: input.title }), 'List section')
      log(actor, list, 'list_section.updated', 'list_section', id, { title: input.title })
      return toSectionDto(row)
    },

    moveSection(actor: Actor, id: string, input: MoveListSectionInput): ListSectionDto {
      const { list } = access.requireListSection(actor, id, 'list:write')
      const section = sectionOf(id)
      const position = positionBefore(repo.sectionsOf(section.listId), id, input.beforeSectionId)
      const row = orNotFound(repo.updateSection(id, { position }), 'List section')
      log(actor, list, 'list_section.moved', 'list_section', id)
      return toSectionDto(row)
    },

    /** A szakasz törlésekor a tételei megmaradnak: szakasz nélkül, a sorrendjük megőrzésével. */
    removeSection(actor: Actor, id: string): void {
      const { list } = access.requireListSection(actor, id, 'list:write')
      const section = sectionOf(id)
      repo.transaction(() => {
        let last = repo.itemsInGroup(list.id, null).at(-1)?.position ?? null
        for (const item of repo.itemsInGroup(list.id, id)) {
          last = generateKeyBetween(last, null)
          repo.updateItem(item.id, { sectionId: null, position: last })
        }
        repo.deleteSection(id)
      })
      log(actor, list, 'list_section.deleted', 'list_section', id, { title: section.title })
    },

    // --- tételek ---
    createItem(actor: Actor, listId: string, input: CreateListItemInput): ListItemDto {
      const { list } = access.requireList(actor, listId, 'list:write')
      if (repo.countItems(listId) >= MAX_LIST_ITEMS) {
        throw new AppError(422, 'too_many_items', 'Too many items on this list', {
          limit: MAX_LIST_ITEMS,
        })
      }
      const sectionId = checkSection(listId, input.sectionId)
      const row = repo.insertItem({
        id: newId(),
        listId,
        sectionId,
        text: input.text,
        recurring: input.recurring,
        position: generateKeyBetween(
          repo.itemsInGroup(listId, sectionId).at(-1)?.position ?? null,
          null,
        ),
      })
      log(actor, list, 'list_item.created', 'list_item', row.id, { text: row.text })
      return toItemDto(row)
    },

    updateItem(actor: Actor, id: string, input: UpdateListItemInput): ListItemDto {
      const { list } = access.requireListItem(actor, id, 'list:write')
      const item = itemOf(id)
      assertVersion(item, input.version)
      const { version: _version, ...values } = input
      const row = orNotFound(repo.updateItem(id, values), 'List item')
      log(actor, list, 'list_item.updated', 'list_item', id, {
        ...(values.done !== undefined && { done: values.done }),
        ...(values.text !== undefined && { text: values.text }),
      })
      return toItemDto(row)
    },

    moveItem(actor: Actor, id: string, input: MoveListItemInput): ListItemDto {
      const { list } = access.requireListItem(actor, id, 'list:write')
      const item = itemOf(id)
      assertVersion(item, input.version)
      const sectionId = checkSection(item.listId, input.sectionId)
      const position = positionBefore(
        repo.itemsInGroup(item.listId, sectionId),
        id,
        input.beforeItemId,
      )
      const row = orNotFound(repo.updateItem(id, { sectionId, position }), 'List item')
      log(actor, list, 'list_item.moved', 'list_item', id, { sectionId })
      return toItemDto(row)
    },

    removeItem(actor: Actor, id: string): void {
      const { list } = access.requireListItem(actor, id, 'list:write')
      const item = itemOf(id)
      repo.deleteItem(id)
      log(actor, list, 'list_item.deleted', 'list_item', id, { text: item.text })
    },

    /** A kipipált, nem ismétlődő tételek törlése. */
    clearDone(actor: Actor, listId: string): { affected: number } {
      const { list } = access.requireList(actor, listId, 'list:write')
      const affected = repo.deleteDoneNonRecurring(listId)
      if (affected > 0) log(actor, list, 'list.cleared', 'list', listId, { affected })
      return { affected }
    },

    /** A kipipált ismétlődő tételek újranyitása. */
    resetRecurring(actor: Actor, listId: string): { affected: number } {
      const { list } = access.requireList(actor, listId, 'list:write')
      const affected = repo.reopenDoneRecurring(listId)
      if (affected > 0) log(actor, list, 'list.reset', 'list', listId, { affected })
      return { affected }
    },
  }
}
export type ListsService = ReturnType<typeof createListsService>
