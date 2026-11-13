import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { clientIp, registerAuth } from './auth/auth.plugin.js'
import { createActivityRepository } from './modules/activity/activity.repository.js'
import { createAdminRepository } from './modules/admin/admin.repository.js'
import { adminRoutes } from './modules/admin/admin.routes.js'
import { createAdminService } from './modules/admin/admin.service.js'
import { createAuditRepository } from './modules/audit/audit.repository.js'
import { createAuditService } from './modules/audit/audit.service.js'
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
import { commentsRoutes } from './modules/comments/comments.routes.js'
import { createCommentsRepository } from './modules/comments/comments.repository.js'
import { createCommentsService } from './modules/comments/comments.service.js'
import { createEventBus } from './events/eventBus.js'
import { eventsRoutes } from './modules/events/events.routes.js'
import { createEventsService } from './modules/events/events.service.js'
import { notificationsRoutes } from './modules/notifications/notifications.routes.js'
import { createNotificationsRepository } from './modules/notifications/notifications.repository.js'
import { createNotificationsService } from './modules/notifications/notifications.service.js'
import websocket from '@fastify/websocket'
import { createGeminiLiveConnector } from './modules/voice/liveConnector.js'
import { createToolHost } from './modules/voice/toolHost.js'
import { MAX_FRAME_BYTES, voiceRoutes } from './modules/voice/voice.routes.js'
import { createVoiceService } from './modules/voice/voice.service.js'
import type { LiveConnector } from './modules/voice/liveConnector.js'
import { createSecretBox } from './lib/secretBox.js'
import { createWebhookDispatcher } from './modules/webhooks/webhooks.dispatcher.js'
import { createWebhooksRepository } from './modules/webhooks/webhooks.repository.js'
import { webhooksRoutes } from './modules/webhooks/webhooks.routes.js'
import { createWebhooksService } from './modules/webhooks/webhooks.service.js'
import { AppError } from './errors.js'
import { filtersRoutes } from './modules/filters/filters.routes.js'
import { createFiltersRepository } from './modules/filters/filters.repository.js'
import { createFiltersService } from './modules/filters/filters.service.js'
import { createLocalFileStore, type FileStore } from './files/fileStore.js'
import { attachmentsRoutes } from './modules/attachments/attachments.routes.js'
import { createAttachmentsRepository } from './modules/attachments/attachments.repository.js'
import { createAttachmentsService } from './modules/attachments/attachments.service.js'
import { listsRoutes } from './modules/lists/lists.routes.js'
import { createListsRepository } from './modules/lists/lists.repository.js'
import { createListsService } from './modules/lists/lists.service.js'
import { openApiPlugin } from './openapi/openapi.plugin.js'
import { createIdempotencyRepository } from './modules/idempotency/idempotency.repository.js'
import { registerIdempotency } from './plugins/idempotency.js'
import { registerErrorHandler } from './plugins/errorHandler.js'

declare module 'fastify' {
  interface FastifyInstance {
    routeList: string[]
    /** Határidő-emlékeztetők kiadása (az időzítő hívja; tesztben közvetlenül). Visszaadja az új értesítések számát. */
    sendDueReminders: (now?: Date) => number
  }
}

export function buildApp(
  config: Config,
  db: Db,
  deps: {
    mailer?: Mailer
    fileStore?: FileStore
    liveConnector?: LiveConnector | null
    webhookRetryDelaysMs?: number[]
  } = {},
): FastifyInstance {
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
  const audit = createAuditService(createAuditRepository(db))
  const auth = createAuthService({
    repo: authRepo,
    mailer,
    config,
    logger: app.log,
    audit,
  })
  const bus = createEventBus()
  const activity = createActivityService(createActivityRepository(db), bus)
  const apiKeys = createApiKeysService({
    repo: createApiKeysRepository(db),
    users: authRepo,
    activity,
  })
  registerAuth(app, config, auth, apiKeys)
  registerIdempotency(app, createIdempotencyRepository(db))

  const boardsRepo = createBoardsRepository(db)
  const columnsRepo = createColumnsRepository(db)
  const cardsRepo = createCardsRepository(db)
  const checklistsRepo = createChecklistsRepository(db)

  const accessRepo = createAccessRepository(db)
  const access = createAccessService(accessRepo)
  const notifications = createNotificationsService({
    repo: createNotificationsRepository(db),
    access,
    findBoard: accessRepo.findActiveBoard,
  })
  const files = deps.fileStore ?? createLocalFileStore(config.UPLOAD_DIR)
  const attachmentsRepo = createAttachmentsRepository(db)
  const cards = createCardsService({
    attachments: attachmentsRepo,
    files,
    cards: cardsRepo,
    columns: columnsRepo,
    boards: boardsRepo,
    checklists: checklistsRepo,
    access,
    activity,
    notifications,
  })
  const comments = createCommentsService({
    repo: createCommentsRepository(db),
    cards: cardsRepo,
    access,
    activity,
    notifications,
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
  app.decorate('sendDueReminders', (now?: Date) => notifications.notifyDueSoon(now))

  // Időzített emlékeztetők: induláskor és utána időközönként (tesztben nem fut magától).
  if (config.NODE_ENV !== 'test' && config.DUE_REMINDER_INTERVAL_MINUTES > 0) {
    let timer: ReturnType<typeof setInterval> | undefined
    const run = () => {
      try {
        app.sendDueReminders()
      } catch (err) {
        app.log.error({ err }, 'due date reminders failed')
      }
    }
    app.addHook('onReady', async () => {
      run()
      timer = setInterval(run, config.DUE_REMINDER_INTERVAL_MINUTES * 60_000)
      timer.unref()
    })
    app.addHook('onClose', async () => clearInterval(timer))
  }

  // Az auditnapló megőrzése: induláskor és naponta törli a régi bejegyzéseket (tesztben nem fut magától).
  if (config.NODE_ENV !== 'test' && config.AUDIT_RETENTION_DAYS > 0) {
    let purgeTimer: ReturnType<typeof setInterval> | undefined
    const purge = () => {
      try {
        const removed = audit.purge(config.AUDIT_RETENTION_DAYS)
        if (removed > 0) app.log.info({ removed }, 'old audit log entries deleted')
      } catch (err) {
        app.log.error({ err }, 'audit log purge failed')
      }
    }
    app.addHook('onReady', async () => {
      purge()
      purgeTimer = setInterval(purge, 24 * 60 * 60 * 1000)
      purgeTimer.unref()
    })
    app.addHook('onClose', async () => clearInterval(purgeTimer))
  }

  app.register(openApiPlugin)
  const workspaces = createWorkspacesService({
    repo: createWorkspacesRepository(db),
    mailer,
    config,
    activity,
    files,
    logger: app.log,
  })
  app.register(authRoutes(auth, config))
  app.register(
    adminRoutes(
      createAdminService({
        repo: createAdminRepository(db),
        audit,
        auth,
        mailer,
        config,
        logger: app.log,
      }),
    ),
  )
  app.register(apiKeysRoutes(apiKeys))
  app.register(workspacesRoutes(workspaces, config))
  app.register(boardsRoutes(boards))
  app.register(columnsRoutes(columns, cards))
  app.register(cardsRoutes(cards, checklists))
  app.register(filtersRoutes(createFiltersService(createFiltersRepository(db), access)))
  app.register(listsRoutes(createListsService(createListsRepository(db), access, activity)))
  app.register(checklistsRoutes(checklists))
  app.register(
    attachmentsRoutes(
      createAttachmentsService({
        repo: attachmentsRepo,
        cards: cardsRepo,
        files,
        access,
        activity,
      }),
      config.MAX_UPLOAD_MB * 1024 * 1024,
    ),
  )
  app.register(commentsRoutes(comments))
  app.register(notificationsRoutes(notifications))
  app.register(eventsRoutes(createEventsService(bus, access)))
  const voice = createVoiceService({
    access,
    connector:
      deps.liveConnector !== undefined
        ? deps.liveConnector
        : config.GEMINI_API_KEY
          ? createGeminiLiveConnector({
              apiKey: config.GEMINI_API_KEY,
              model: config.GEMINI_LIVE_MODEL,
            })
          : null,
    createToolHost: (o) =>
      createToolHost(app, {
        cookie: o.cookie,
        clientIp: o.clientIp,
        defaultBoardId: o.boardId,
        defaultWorkspaceId: o.workspaceId,
      }),
    maxSessionsPerUser: config.VOICE_MAX_SESSIONS_PER_USER,
    maxMinutes: config.VOICE_MAX_MINUTES,
    logger: app.log,
  })
  app.register(
    healthRoutes({
      voice: voice.available,
      emailVerificationRequired: config.REQUIRE_EMAIL_VERIFICATION,
      registrationOpen: () =>
        config.REGISTRATION_MODE === 'open' || authRepo.countLoginUsers() === 0,
    }),
  )
  const secrets = createSecretBox(config.SESSION_SECRET)
  const webhooksRepo = createWebhooksRepository(db)
  const dispatcher = createWebhookDispatcher({
    repo: webhooksRepo,
    secrets,
    bus,
    logger: app.log,
    allowPrivateTargets: config.WEBHOOK_ALLOW_PRIVATE_TARGETS,
    retryDelaysMs: deps.webhookRetryDelaysMs,
  })
  app.addHook('onClose', async () => {
    dispatcher.stop()
    await dispatcher.idle()
  })
  app.register(
    webhooksRoutes(
      createWebhooksService({
        repo: webhooksRepo,
        access,
        activity,
        secrets,
        allowPrivateTargets: config.WEBHOOK_ALLOW_PRIVATE_TARGETS,
      }),
    ),
  )
  app.register(websocket, { options: { maxPayload: MAX_FRAME_BYTES } })
  app.register(voiceRoutes(voice, { allowedOrigin: new URL(config.APP_URL).origin }))
  return app
}
