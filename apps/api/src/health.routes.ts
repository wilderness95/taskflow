import type { FastifyInstance } from 'fastify'

/**
 * `voice`: be van-e állítva a hangasszisztens (Gemini API kulcs); a frontend ebből dönti el, megmutatja-e a mikrofon gombot.
 * `registrationOpen`: bárki regisztrálhat-e meghívó nélkül (nyílt mód, vagy még nincs felhasználó); ha nem, a
 * frontend a regisztrációs oldal helyett a „csak meghívóval” tájékoztatót mutatja. A szerver ettől függetlenül
 * kényszeríti a szabályt (`403 invitation_required`).
 */
export const healthRoutes =
  (opts: { voice: boolean; registrationOpen: () => boolean }) =>
  async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/health', async () => ({
      status: 'ok',
      voice: opts.voice,
      registrationOpen: opts.registrationOpen(),
    }))
  }
