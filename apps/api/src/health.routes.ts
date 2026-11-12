import type { FastifyInstance } from 'fastify'

/** `voice`: be van-e állítva a hangasszisztens (Gemini API kulcs); a frontend ebből dönti el, megmutatja-e a mikrofon gombot. */
export const healthRoutes =
  (opts: { voice: boolean }) =>
  async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/health', async () => ({ status: 'ok', voice: opts.voice }))
  }
