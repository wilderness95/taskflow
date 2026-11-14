import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import {
  BOARD_ROLES,
  BOARD_VISIBILITIES,
  INVITABLE_ROLES,
  NOTIFICATION_TYPES,
  PRIORITIES,
  TAG_COLORS,
  WORKSPACE_ROLES,
} from '@taskflow/shared'

const id = () => text('id').primaryKey()
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())

export const users = sqliteTable('users', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  /** Argon2 hash; NULL = nem tud bejelentkezni (pl. a seed felhasználó, amíg valaki át nem veszi). */
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').notNull().default('hu'),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  /** Felfüggesztett fiók: nem léphet be, a munkamenetei és az API kulcsai nem érvényesek. */
  suspendedAt: integer('suspended_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
})

/** A `id` a munkamenet-token SHA-256 hash-e; a nyers token csak a cookie-ban él. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/** Egyszer használatos tokenek e-mailben (e-mail megerősítés, jelszó-visszaállítás); csak a hash tárolt. */
export const emailTokens = sqliteTable('email_tokens', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['verify_email', 'password_reset'] }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
})

/**
 * Meghívó: munkaterület nélkül platform-szintű regisztrációs meghívó (admin), munkaterülettel
 * és szerepkörrel munkaterületi meghívó (ez egyben regisztrációs meghívó is az új e-mail-címeknek).
 */
export const invitations = sqliteTable('invitations', {
  id: id(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  role: text('role', { enum: INVITABLE_ROLES }),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
  /** Kézzel visszavont meghívó (a lejárt meghívótól megkülönböztetve). */
  revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
})

/** API kulcs: csak a SHA-256 hash tárolt; a `prefix` a kulcs eleje az azonosításhoz. */
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    /** JSON tömb (`ApiKeyScope[]`). */
    scopes: text('scopes').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('api_keys_user_idx').on(t.userId)],
)

/** Írási műveletek naplója; az `actorType` megkülönbözteti az embert és az API kulcsot. */
export const activityLog = sqliteTable(
  'activity_log',
  {
    id: id(),
    boardId: text('board_id').references(() => boards.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    actorType: text('actor_type', { enum: ['user', 'api_key'] }).notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    apiKeyId: text('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /** JSON objektum. */
    meta: text('meta').notNull().default('{}'),
    createdAt: createdAt(),
  },
  (t) => [index('activity_log_board_idx').on(t.boardId, t.id)],
)

/**
 * Platformszintű auditnapló: adminműveletek és fontos hitelesítési események. Nem tartalmaz titkot
 * (jelszó, token, kulcs). A hivatkozások `set null`-ra állnak, hogy a napló a fiók törlése után is megmaradjon.
 */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    /** A végrehajtó; `null`: ismeretlen (pl. sikertelen belépés ismeretlen címmel). */
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    /** `domain.verb`, pl. `admin.user_suspended`, `auth.login_failed`; nyelvfüggetlen. */
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    /** Az érintett felhasználó, ha van (szűréshez). */
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    ip: text('ip'),
    /** JSON objektum. */
    meta: text('meta').notNull().default('{}'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorId),
    index('audit_log_target_user_idx').on(t.targetUserId),
    index('audit_log_action_idx').on(t.action),
  ],
)

/**
 * Egy lezárt hangasszisztens-munkamenet összesítése (költségkontrollhoz és hibakereséshez). Nem
 * tartalmaz hangot, átiratot vagy bármilyen felhasználói tartalmat. A hivatkozások `set null`-ra állnak.
 */
export const voiceSessions = sqliteTable(
  'voice_sessions',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    boardId: text('board_id').references(() => boards.id, { onDelete: 'set null' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    /** `VOICE_END_REASONS` egyike. */
    endReason: text('end_reason').notNull(),
    interruptions: integer('interruptions').notNull().default(0),
    toolCalls: integer('tool_calls').notNull().default(0),
    toolErrors: integer('tool_errors').notNull().default(0),
    audioInMs: integer('audio_in_ms').notNull().default(0),
    audioOutMs: integer('audio_out_ms').notNull().default(0),
  },
  (t) => [
    index('voice_sessions_started_idx').on(t.startedAt),
    index('voice_sessions_user_idx').on(t.userId),
  ],
)

/** `Idempotency-Key` fejléc: a korábbi válasz újrajátszásához. */
export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    /** A kérés (metódus, útvonal, törzs) ujjlenyomata; eltérő kérés ugyanazzal a kulccsal hiba. */
    fingerprint: text('fingerprint').notNull(),
    status: integer('status'),
    response: text('response'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
)

export const workspaces = sqliteTable('workspaces', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
})

export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: WORKSPACE_ROLES }).notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index('workspace_members_user_idx').on(t.userId),
  ],
)

export const boards = sqliteTable(
  'boards',
  {
    id: id(),
    /** A régi (M1) táblák az induláskor kapnak munkaterületet (db/backfill.ts); utána mindig kitöltött. */
    workspaceId: text('workspace_id').references(() => workspaces.id),
    title: text('title').notNull(),
    visibility: text('visibility', { enum: BOARD_VISIBILITIES }).notNull().default('private'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('boards_workspace_idx').on(t.workspaceId)],
)

/** Explicit tábla-szerepkör (a privát táblák hozzáférése). */
export const boardMembers = sqliteTable(
  'board_members',
  {
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: BOARD_ROLES }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.boardId, t.userId] }),
    index('board_members_user_idx').on(t.userId),
  ],
)

export const boardStars = sqliteTable(
  'board_stars',
  {
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.boardId, t.userId] }),
    index('board_stars_user_idx').on(t.userId),
  ],
)

export const columns = sqliteTable(
  'columns',
  {
    id: id(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    accent: text('accent', { enum: TAG_COLORS }).notNull(),
    isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
    position: text('position').notNull(),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('columns_board_idx').on(t.boardId)],
)

export const cards = sqliteTable(
  'cards',
  {
    id: id(),
    columnId: text('column_id')
      .notNull()
      .references(() => columns.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    priority: text('priority', { enum: PRIORITIES }).notNull().default('medium'),
    dueDate: text('due_date'),
    coverImage: text('cover_image'),
    /** A borítóként beállított csatolmány (`attachments.id`); törléskor a service nullázza. */
    coverAttachmentId: text('cover_attachment_id'),
    position: text('position').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    version: integer('version').notNull().default(1),
  },
  (t) => [index('cards_column_idx').on(t.columnId)],
)

export const labels = sqliteTable(
  'labels',
  {
    id: id(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color', { enum: TAG_COLORS }).notNull(),
  },
  (t) => [index('labels_board_idx').on(t.boardId)],
)

export const cardLabels = sqliteTable(
  'card_labels',
  {
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.labelId] }),
    index('card_labels_label_idx').on(t.labelId),
  ],
)

/** Kártyához rendelt felhasználók (a kártya felelősei). */
export const cardAssignees = sqliteTable(
  'card_assignees',
  {
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.userId] }),
    index('card_assignees_user_idx').on(t.userId),
  ],
)

/** Kártya-hozzászólás; az `apiKeyId` jelzi, ha API kulcs írta a szerző nevében. */
export const comments = sqliteTable(
  'comments',
  {
    id: id(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    apiKeyId: text('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    viaApiKey: integer('via_api_key', { mode: 'boolean' }).notNull().default(false),
    body: text('body').notNull(),
    editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('comments_card_idx').on(t.cardId, t.id)],
)

export const commentMentions = sqliteTable(
  'comment_mentions',
  {
    commentId: text('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
)

/** Felhasználói értesítés (harang): hozzárendelés, említés, közelgő határidő. */
export const notifications = sqliteTable(
  'notifications',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    dueDate: text('due_date'),
    /** Az ismétlődő értesítések (pl. határidő) duplikációjának kizárására; `null`: nincs ilyen. */
    dedupeKey: text('dedupe_key'),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.id),
    uniqueIndex('notifications_dedupe_idx').on(t.userId, t.dedupeKey),
  ],
)

/** Kártyához csatolt fájl; a tartalom a `FileStore`-ban él a `storageKey` alatt. */
export const attachments = sqliteTable(
  'attachments',
  {
    id: id(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [index('attachments_card_idx').on(t.cardId)],
)

/** A felhasználó saját, mentett kártyaszűrői egy táblán. */
export const savedFilters = sqliteTable(
  'saved_filters',
  {
    id: id(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** JSON (`BoardFilter`). */
    filter: text('filter').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('saved_filters_name_idx').on(t.boardId, t.userId, t.name)],
)

/** Teendő- vagy bevásárlólista: munkaterülethez tartozik, a tagság és a szerepkör szabja a hozzáférést. */
export const lists = sqliteTable(
  'lists',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    /** Archiváláskor kitöltött; az archivált lista nem törlődik, visszaállítható. */
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('lists_workspace_idx').on(t.workspaceId)],
)

export const listSections = sqliteTable(
  'list_sections',
  {
    id: id(),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: text('position').notNull(),
  },
  (t) => [index('list_sections_list_idx').on(t.listId)],
)

export const listItems = sqliteTable(
  'list_items',
  {
    id: id(),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    /** Szakasz törlésekor NULL (a tétel megmarad, szakasz nélkül). */
    sectionId: text('section_id').references(() => listSections.id, { onDelete: 'set null' }),
    text: text('text').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
    position: text('position').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index('list_items_list_idx').on(t.listId)],
)

export const checklists = sqliteTable(
  'checklists',
  {
    id: id(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: text('position').notNull(),
  },
  (t) => [index('checklists_card_idx').on(t.cardId)],
)

export const checklistItems = sqliteTable(
  'checklist_items',
  {
    id: id(),
    checklistId: text('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: text('position').notNull(),
  },
  (t) => [index('checklist_items_checklist_idx').on(t.checklistId)],
)

export const boardsRelations = relations(boards, ({ many }) => ({
  columns: many(columns),
  labels: many(labels),
}))
export const columnsRelations = relations(columns, ({ one, many }) => ({
  board: one(boards, { fields: [columns.boardId], references: [boards.id] }),
  cards: many(cards),
}))
export const cardsRelations = relations(cards, ({ one, many }) => ({
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  cardLabels: many(cardLabels),
  checklists: many(checklists),
}))
export const labelsRelations = relations(labels, ({ many }) => ({ cardLabels: many(cardLabels) }))
export const cardLabelsRelations = relations(cardLabels, ({ one }) => ({
  card: one(cards, { fields: [cardLabels.cardId], references: [cards.id] }),
  label: one(labels, { fields: [cardLabels.labelId], references: [labels.id] }),
}))
export const checklistsRelations = relations(checklists, ({ one, many }) => ({
  card: one(cards, { fields: [checklists.cardId], references: [cards.id] }),
  items: many(checklistItems),
}))
export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklist: one(checklists, {
    fields: [checklistItems.checklistId],
    references: [checklists.id],
  }),
}))

/** Kimenő webhook egy táblához (board admin kezeli); a titok titkosítva tárolt (HMAC-aláíráshoz kell). */
export const webhooks = sqliteTable(
  'webhooks',
  {
    id: id(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    /** AES-256-GCM, `iv.tag.ciphertext` (base64url). */
    secretEnc: text('secret_enc').notNull(),
    /** JSON: esemény-minták (`*`, `card.*`, `card.moved`). */
    events: text('events').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    failureCount: integer('failure_count').notNull().default(0),
    lastStatus: integer('last_status'),
    lastDeliveryAt: integer('last_delivery_at', { mode: 'timestamp_ms' }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('webhooks_board_idx').on(t.boardId)],
)
