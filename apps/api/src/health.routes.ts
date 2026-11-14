import type { FastifyInstance } from 'fastify'

/** Egy readiness-ellenőrzés: `true`, ha rendben; kivétel vagy `false` esetén hibás. */
export type ReadinessCheck = { name: string; run: () => boolean | Promise<boolean> }

/**
 * `voice`: be van-e állítva a hangasszisztens (Gemini API kulcs); a frontend ebből dönti el, megmutatja-e a mikrofon gombot.
 * `registrationOpen`: bárki regisztrálhat-e meghívó nélkül (nyílt mód, vagy még nincs felhasználó); ha nem, a
 * frontend a regisztrációs oldal helyett a „csak meghívóval” tájékoztatót mutatja. A szerver ettől függetlenül
 * kényszeríti a szabályt (`403 invitation_required`).
 * `emailVerificationRequired`: a megerősítetlen e-mail-című felhasználó (a platform-admin kivételével) csak a
 * megerősítő oldalt látja; a szerver ezt is kényszeríti (`403 email_not_verified`).
 */
export const healthRoutes =
  (opts: {
    voice: boolean
    registrationOpen: () => boolean
    emailVerificationRequired: boolean
    readiness: ReadinessCheck[]
  }) =>
  async (app: FastifyInstance): Promise<void> => {
    // Üzemeltetési végpontok: névtelenek, rate limit alól kivéve, nem részei az /api/v1 szerződésnek.
    // Titkot és konfigurációt nem adnak ki; a readiness csak az ellenőrzés nevét és eredményét.
    const open = { config: { rateLimit: false }, logLevel: 'silent' as const }

    // Liveness: a folyamat válaszol. Függőséget szándékosan nem ellenőriz, hogy egy átmeneti
    // DB-hiba ne indítsa újra a konténert.
    app.get('/healthz', open, async () => ({ status: 'ok' }))

    // Readiness: a szolgáltatás ki tudja-e szolgálni a kéréseket.
    app.get('/readyz', open, async (_req, reply) => {
      const checks: Record<string, 'ok' | 'error'> = {}
      for (const check of opts.readiness) {
        try {
          checks[check.name] = (await check.run()) ? 'ok' : 'error'
        } catch {
          checks[check.name] = 'error'
        }
      }
      const ready = Object.values(checks).every((v) => v === 'ok')
      return reply.status(ready ? 200 : 503).send({ status: ready ? 'ok' : 'unavailable', checks })
    })

    app.get('/api/v1/health', async () => ({
      status: 'ok',
      voice: opts.voice,
      registrationOpen: opts.registrationOpen(),
      emailVerificationRequired: opts.emailVerificationRequired,
    }))
  }
