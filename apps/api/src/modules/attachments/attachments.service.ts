import { isImageMimeType, type AttachmentDto } from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { AppError, orNotFound } from '../../errors.js'
import type { FileStore } from '../../files/fileStore.js'
import type { AccessService } from '../access/access.service.js'
import type { ActivityService } from '../activity/activity.service.js'
import type { CardsRepository } from '../cards/cards.repository.js'
import type { AttachmentRow, AttachmentsRepository } from './attachments.repository.js'

export const toAttachmentDto = (r: AttachmentRow): AttachmentDto => ({
  id: r.id,
  cardId: r.cardId,
  fileName: r.fileName,
  mimeType: r.mimeType,
  size: r.size,
  isImage: isImageMimeType(r.mimeType),
  uploadedBy: r.uploadedBy,
  createdAt: r.createdAt.toISOString(),
})

const isControlOrSeparator = (char: string) => {
  const code = char.charCodeAt(0)
  return code < 0x20 || code === 0x7f || char === '/' || char === '\\'
}

/** A fájlnév csak megjelenítendő adat: útvonal-elválasztók és vezérlőkarakterek nélkül, rövidítve. */
export const sanitizeFileName = (raw: string): string =>
  [...raw]
    .map((char) => (isControlOrSeparator(char) ? '_' : char))
    .join('')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 200) || 'file'

/** A `Content-Type` fejléc médiatípusa (paraméterek nélkül, kisbetűvel). */
export const normalizeMimeType = (raw: string | undefined): string => {
  const mime = raw?.split(';')[0]?.trim().toLowerCase()
  return mime && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) ? mime : 'application/octet-stream'
}

export function createAttachmentsService(deps: {
  repo: AttachmentsRepository
  cards: CardsRepository
  files: FileStore
  access: AccessService
  activity: ActivityService
}) {
  const { repo, cards, files, access, activity } = deps

  return {
    list(actor: Actor, cardId: string): AttachmentDto[] {
      access.requireCard(actor, cardId, 'board:read')
      return repo.listForCard(cardId).map(toAttachmentDto)
    },

    async upload(
      actor: Actor,
      cardId: string,
      input: { fileName: string; mimeType: string; data: Buffer },
    ): Promise<AttachmentDto> {
      const { board } = access.requireCard(actor, cardId, 'board:write')
      if (input.data.length === 0) {
        throw new AppError(400, 'empty_file', 'The uploaded file is empty')
      }
      const id = newId()
      const storageKey = newId()
      await files.put(storageKey, input.data)
      let row: AttachmentRow
      try {
        row = repo.insert({
          id,
          cardId,
          fileName: sanitizeFileName(input.fileName),
          mimeType: input.mimeType,
          size: input.data.length,
          storageKey,
          uploadedBy: actor.id,
        })
      } catch (err) {
        await files.delete(storageKey)
        throw err
      }
      activity.record(actor, {
        boardId: board.id,
        action: 'attachment.created',
        entityType: 'attachment',
        entityId: id,
        meta: { fileName: row.fileName, cardId },
      })
      return toAttachmentDto(row)
    },

    /** A fájl tartalma letöltéshez / megjelenítéshez (olvasási jog kell a kártya táblájához). */
    async read(actor: Actor, id: string): Promise<{ attachment: AttachmentRow; data: Buffer }> {
      const attachment = orNotFound(repo.findById(id), 'Attachment')
      access.requireCard(actor, attachment.cardId, 'board:read')
      return { attachment, data: await files.get(attachment.storageKey) }
    },

    async remove(actor: Actor, id: string): Promise<void> {
      const attachment = orNotFound(repo.findById(id), 'Attachment')
      const { board } = access.requireCard(actor, attachment.cardId, 'board:write')
      const card = cards.findById(attachment.cardId)
      if (card?.coverAttachmentId === id) cards.update(card.id, { coverAttachmentId: null })
      repo.delete(id)
      await files.delete(attachment.storageKey)
      activity.record(actor, {
        boardId: board.id,
        action: 'attachment.deleted',
        entityType: 'attachment',
        entityId: id,
        meta: { fileName: attachment.fileName, cardId: attachment.cardId },
      })
    },
  }
}
export type AttachmentsService = ReturnType<typeof createAttachmentsService>
