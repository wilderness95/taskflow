import Fastify, { type FastifyInstance } from 'fastify'
import { registerActor } from './auth/actor.js'
import type { Config } from './config.js'
import type { Db } from './db/client.js'
import { healthRoutes } from './health.routes.js'
import { boardsRoutes } from './modules/boards/boards.routes.js'
import { createBoardsRepository } from './modules/boards/boards.repository.js'
import { createBoardsService } from './modules/boards/boards.service.js'
import { cardsRoutes } from './modules/cards/cards.routes.js'
import { createCardsRepository } from './modules/cards/cards.repository.js'
import { createCardsService } from './modules/cards/cards.service.js'
import { checklistsRoutes } from './modules/checklists/checklists.routes.js'
import { createChecklistsRepository } from './modules/checklists/checklists.repository.js'
import { createChecklistsService } from './modules/checklists/checklists.service.js'
import { columnsRoutes } from './modules/columns/columns.routes.js'
import { createColumnsRepository } from './modules/columns/columns.repository.js'
import { createColumnsService } from './modules/columns/columns.service.js'
import { openApiPlugin } from './openapi/openapi.plugin.js'
import { registerErrorHandler } from './plugins/errorHandler.js'

declare module 'fastify' {
  interface FastifyInstance {
    routeList: string[]
  }
}

export function buildApp(config: Config, db: Db): FastifyInstance {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
    // Cloudflare mögött: a kliens IP-je a CF-Connecting-IP fejlécből jön.
    trustProxy: true,
    requestIdHeader: 'x-request-id',
  })
  registerErrorHandler(app)
  registerActor(app)

  const boardsRepo = createBoardsRepository(db)
  const columnsRepo = createColumnsRepository(db)
  const cardsRepo = createCardsRepository(db)
  const checklistsRepo = createChecklistsRepository(db)

  const cards = createCardsService({
    cards: cardsRepo,
    columns: columnsRepo,
    boards: boardsRepo,
    checklists: checklistsRepo,
  })
  const boards = createBoardsService(boardsRepo, cards)
  const columns = createColumnsService(columnsRepo)
  const checklists = createChecklistsService(checklistsRepo, cardsRepo)

  // Az összes route-ot gyűjti, hogy a teszt ellenőrizhesse az OpenAPI-lefedettséget.
  const routes: string[] = []
  app.addHook('onRoute', (r) => {
    for (const m of [r.method].flat()) routes.push(`${m} ${r.url}`)
  })
  app.decorate('routeList', routes)

  app.register(openApiPlugin)
  app.register(healthRoutes)
  app.register(boardsRoutes(boards))
  app.register(columnsRoutes(columns, cards))
  app.register(cardsRoutes(cards, checklists))
  app.register(checklistsRoutes(checklists))
  return app
}
