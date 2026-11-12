import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { clientIp, registerAuth } from './auth/auth.plugin.js'
import { createActivityRepository } from './modules/activity/activity.repository.js'
import { createActivityService } from './modules/activity/activity.service.js'
import { apiKeysRoutes } from './modules/apikeys/apikeys.routes.js'
import { createApiKeysRepository } from './modules/apikeys/apikeys.repository.js'
import { createApiKeysService } from './modules/apikeys/apikeys.service.js'
import { createMailer, type Mailer } from './mail/mailer.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { createAuthRepository } from './modules/auth/auth.repository.js'
import { createAuthService } from './modules/auth/auth.service.js'
import type { Config } from './config.js'
import type { Db } from './db/client.js'
import { healthRoutes } from './health.routes.js'
import { createAccessRepository } from './modules/access/access.repository.js'
import { createAccessService } from './modules/access/access.service.js'
import { boardsRoutes } from './modules/boards/boards.routes.js'
import { createBoardsRepository } from './modules/boards/boards.repository.js'
import { createBoardsService } from './modules/boards/boards.service.js'
import { createWorkspacesRepository } from './modules/workspaces/workspaces.repository.js'
import { createWorkspacesService } from './modules/workspaces/workspaces.service.js'
import { workspacesRoutes } from './modules/workspaces/workspaces.routes.js'
import { cardsRoutes } from './modules/cards/cards.routes.js'
import { createCardsRepository } from './modules/cards/cards.repository.js'
import { createCardsService } from './modules/cards/cards.service.js'
import { checklistsRoutes } from './modules/checklists/checklists.routes.js'
import { createChecklistsRepository } from './modules/checklists/checklists.repository.js'
import { createChecklistsService } from './modules/checklists/checklists.service.js'
import { columnsRoutes } from './modules/columns/columns.routes.js'
import { createColumnsRepository } from './modules/columns/columns.repository.js'
import { createColumnsService } from './modules/columns/columns.service.js'
import { AppError } from './errors.js'
import { openApiPlugin } from './openapi/openapi.plugin.js'
import { registerErrorHandler } from './plugins/errorHandler.js'

declare module 'fastify' {
  interface FastifyInstance {
    routeList: string[]
  }
}

export function buildApp(config: Config, db: Db, deps: { mailer?: Mailer } = {}): FastifyInstance {
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
  // Kliens IP szerint korlátoz (Cloudflare mögött a CF-Connecting-IP fejléc); az érzékeny
  // auth végpontokra szigorúbb, route-szintű limit van (lásd auth.routes.ts).
  app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: clientIp,
    errorResponseBuilder: (_req, context) =>
      new AppError(429, 'rate_limited', 'Too many requests', {
        retryAfterSeconds: Math.ceil(context.ttl / 1000),
      }),
  })
  const mailer = deps.mailer ?? createMailer(config)
  const authRepo = createAuthRepository(db)
  const auth = createAuthService({
    repo: authRepo,
    mailer,
    config,
    logger: app.log,
  })
  const activity = createActivityService(createActivityRepository(db))
  const apiKeys = createApiKeysService({
    repo: createApiKeysRepository(db),
    users: authRepo,
    activity,
  })
  registerAuth(app, config, auth, apiKeys)

  const boardsRepo = createBoardsRepository(db)
  const columnsRepo = createColumnsRepository(db)
  const cardsRepo = createCardsRepository(db)
  const checklistsRepo = createChecklistsRepository(db)

  const access = createAccessService(createAccessRepository(db))
  const cards = createCardsService({
    cards: cardsRepo,
    columns: columnsRepo,
    boards: boardsRepo,
    checklists: checklistsRepo,
    access,
    activity,
  })
  const boards = createBoardsService(boardsRepo, cards, access, activity)
  const columns = createColumnsService(columnsRepo, access, activity)
  const checklists = createChecklistsService(checklistsRepo, cardsRepo, access, activity)

  // Az összes route-ot gyűjti, hogy a teszt ellenőrizhesse az OpenAPI-lefedettséget.
  const routes: string[] = []
  app.addHook('onRoute', (r) => {
    for (const m of [r.method].flat()) routes.push(`${m} ${r.url}`)
  })
  app.decorate('routeList', routes)

  app.register(openApiPlugin)
  app.register(healthRoutes)
  const workspaces = createWorkspacesService({
    repo: createWorkspacesRepository(db),
    mailer,
    config,
    activity,
    logger: app.log,
  })
  app.register(authRoutes(auth, config))
  app.register(apiKeysRoutes(apiKeys))
  app.register(workspacesRoutes(workspaces, config))
  app.register(boardsRoutes(boards))
  app.register(columnsRoutes(columns, cards))
  app.register(cardsRoutes(cards, checklists))
  app.register(checklistsRoutes(checklists))
  return app
}
