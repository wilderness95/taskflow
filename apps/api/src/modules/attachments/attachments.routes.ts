import type { FastifyInstance } from 'fastify'
import { idParamsSchema, isImageMimeType, uploadAttachmentQuerySchema } from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import { AppError } from '../../errors.js'
import { normalizeMimeType, type AttachmentsService } from './attachments.service.js'

export function attachmentsRoutes(service: AttachmentsService, maxBytes: number) {
  return async (app: FastifyInstance): Promise<void> => {
    // A feltöltés a fájl nyers tartalma (nincs multipart): minden típust Bufferként olvasunk be.
    // Csak ebben a (beágyazott) hatókörben él, a többi route JSON-ja érintetlen.
    app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: maxBytes }, (_req, body, done) =>
      done(null, body),
    )

    app.get('/api/v1/cards/:id/attachments', async (req) => ({
      data: service.list(requireActor(req), idParamsSchema.parse(req.params).id),
    }))

    app.post('/api/v1/cards/:id/attachments', async (req, reply) => {
      if (!Buffer.isBuffer(req.body)) {
        throw new AppError(415, 'unsupported_media_type', 'Send the raw file as the request body')
      }
      const attachment = await service.upload(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        {
          fileName: uploadAttachmentQuerySchema.parse(req.query).name,
          mimeType: normalizeMimeType(req.headers['content-type']),
          data: req.body,
        },
      )
      return reply.status(201).send(attachment)
    })

    app.get('/api/v1/attachments/:id/file', async (req, reply) => {
      const { attachment, data } = await service.read(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
      )
      // Csak a biztonságos képtípusok jelennek meg a böngészőben; minden más letöltődik.
      const inline = isImageMimeType(attachment.mimeType)
      const encoded = encodeURIComponent(attachment.fileName)
      return reply
        .header('Content-Type', inline ? attachment.mimeType : 'application/octet-stream')
        .header(
          'Content-Disposition',
          `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`,
        )
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Security-Policy', "default-src 'none'; sandbox")
        .header('Cache-Control', 'private, max-age=0, must-revalidate')
        .send(data)
    })

    app.delete('/api/v1/attachments/:id', async (req, reply) => {
      await service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })
  }
}
