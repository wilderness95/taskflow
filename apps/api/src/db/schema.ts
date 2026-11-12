import { relations } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import {
  BOARD_ROLES,
  BOARD_VISIBILITIES,
  INVITABLE_ROLES,
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
  createdAt: createdAt(),
})

/** A `id` a munkamenet-token SHA-256 hash-e; a nyers token csak a cookie-ban él. */
export const sessions = sqliteTable('sessions', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  userAgent: text('user_agent'),
  ip: text('ip'),
  createdAt: createdAt(),
})

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
  createdAt: createdAt(),
})

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
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
)

export const boards = sqliteTable('boards', {
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
})

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
  (t) => [primaryKey({ columns: [t.boardId, t.userId] })],
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
  (t) => [primaryKey({ columns: [t.boardId, t.userId] })],
)

export const columns = sqliteTable('columns', {
  id: id(),
  boardId: text('board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  accent: text('accent', { enum: TAG_COLORS }).notNull(),
  isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
  position: text('position').notNull(),
})

export const cards = sqliteTable('cards', {
  id: id(),
  columnId: text('column_id')
    .notNull()
    .references(() => columns.id),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority', { enum: PRIORITIES }).notNull().default('medium'),
  dueDate: text('due_date'),
  coverImage: text('cover_image'),
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
})

export const labels = sqliteTable('labels', {
  id: id(),
  boardId: text('board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color', { enum: TAG_COLORS }).notNull(),
})

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
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
)

export const checklists = sqliteTable('checklists', {
  id: id(),
  cardId: text('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  position: text('position').notNull(),
})

export const checklistItems = sqliteTable('checklist_items', {
  id: id(),
  checklistId: text('checklist_id')
    .notNull()
    .references(() => checklists.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  position: text('position').notNull(),
})

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
