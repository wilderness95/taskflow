import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { attachmentFileUrl } from '../../api/attachments'
import { ApiError } from '../../api/client'
import { formatFileSize } from '../../i18n/format'
import { useAttachments } from './useAttachments'
import '../../shared/styles/buttons.css'
import './CardAttachments.css'

type CardAttachmentsProps = {
  boardId: string
  cardId: string
  canEdit: boolean
}

/** A kártya csatolmányai: feltöltés, letöltés, törlés és a borítókép kiválasztása. */
export function CardAttachments({ boardId, cardId, canEdit }: CardAttachmentsProps) {
  const { t } = useTranslation('card')
  const { list, coverAttachmentId, upload, remove, setCover } = useAttachments(boardId, cardId)
  const input = useRef<HTMLInputElement>(null)
  const items = list.data ?? []
  const tooLarge = upload.error instanceof ApiError && upload.error.status === 413

  return (
    <section className="card-attachments" aria-label={t('attachments.title')}>
      <h3>{t('attachments.title')}</h3>
      {list.isError && <p role="alert">{t('attachments.loadError')}</p>}
      {list.data && items.length === 0 && (
        <p className="card-attachments-empty">{t('attachments.empty')}</p>
      )}

      <ul className="card-attachments-list">
        {items.map((item) => {
          const isCover = item.id === coverAttachmentId
          return (
            <li key={item.id}>
              {item.isImage && (
                <img src={attachmentFileUrl(item.id)} alt="" className="card-attachment-thumb" />
              )}
              <a
                href={attachmentFileUrl(item.id)}
                download={item.fileName}
                aria-label={t('attachments.download', { name: item.fileName })}
              >
                {item.fileName}
              </a>
              <small>{formatFileSize(item.size)}</small>
              {isCover && <strong>{t('attachments.cover')}</strong>}
              {canEdit && item.isImage && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={setCover.isPending}
                  onClick={() => setCover.mutate(isCover ? null : item.id)}
                >
                  {isCover ? t('attachments.removeCover') : t('attachments.makeCover')}
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={remove.isPending}
                  aria-label={t('attachments.deleteAria', { name: item.fileName })}
                  onClick={() => remove.mutate(item.id)}
                >
                  {t('attachments.delete')}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {upload.isError && (
        <p role="alert">{tooLarge ? t('attachments.tooLarge') : t('attachments.uploadError')}</p>
      )}
      {canEdit && (
        <>
          <input
            ref={input}
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) upload.mutate(file)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            className="secondary-button"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {upload.isPending ? t('attachments.uploading') : t('attachments.upload')}
          </button>
        </>
      )}
    </section>
  )
}
