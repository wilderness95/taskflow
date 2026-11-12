import { attachmentListSchema, type AttachmentDto } from '@taskflow/shared'
import { apiFetch, apiUpload } from './client'

export const listAttachments = async (cardId: string): Promise<AttachmentDto[]> =>
  attachmentListSchema.parse(await apiFetch('GET', `/cards/${cardId}/attachments`)).data

export const uploadAttachment = (cardId: string, file: File) =>
  apiUpload<AttachmentDto>(
    `/cards/${cardId}/attachments?name=${encodeURIComponent(file.name)}`,
    file,
  )

export const deleteAttachment = (attachmentId: string) =>
  apiFetch('DELETE', `/attachments/${attachmentId}`)

/** A fájl tartalmának URL-je (képnél `<img src>`, egyébként letöltés); a session cookie hitelesít. */
export const attachmentFileUrl = (attachmentId: string) =>
  `/api/v1/attachments/${attachmentId}/file`
