import type { FastifyInstance } from 'fastify'
import { SEED_USER_ID } from '../db/seed.js'

/** Session és API kulcs (M2/M4) egyaránt Actor-rá képződik le; a service csak ezt ismeri. */
export type Actor = { type: 'user'; id: string }

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor
  }
}

/** M1: még nincs auth, minden kérés a seed felhasználó nevében fut. Az M2 cseréli le. */
export function registerActor(app: FastifyInstance): void {
  app.decorateRequest('actor')
  app.addHook('onRequest', async (req) => {
    req.actor = { type: 'user', id: SEED_USER_ID }
  })
}
