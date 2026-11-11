import { z } from 'zod'
import {
  boardListSchema,
  boardSchema,
  boardSummarySchema,
  cardSchema,
  checklistItemSchema,
  checklistSchema,
  columnSchema,
  createBoardSchema,
  createCardSchema,
  createChecklistItemSchema,
  createChecklistSchema,
  createColumnSchema,
  createLabelSchema,
  deleteColumnQuerySchema,
  idParamsSchema,
  labelSchema,
  moveCardSchema,
  moveColumnSchema,
  updateBoardSchema,
  updateCardSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
  updateColumnSchema,
  createInvitationSchema,
  forgotPasswordSchema,
  invitationSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  userSchema,
  verifyEmailSchema,
} from '@taskflow/shared'

export type Operation = {
  method: 'get' | 'post' | 'patch' | 'delete'
  /** OpenAPI-formátumú útvonal (`/boards/{id}`), a `/api/v1` előtag nélkül. */
  path: string
  tag: string
  summary: string
  query?: z.ZodObject
  body?: z.ZodType
  /** Sikeres státusz és válasz; séma nélkül nincs törzs (204). */
  success: { status: 200 | 201 | 202 | 204; schema?: z.ZodType }
  /** Nyilvános végpont: nem kell hozzá bejelentkezés. */
  public?: boolean
  /** A műveletre jellemző hibakódok a 400/404 mellett. */
  errors?: number[]
}

const board = { tag: 'Boards' }
const column = { tag: 'Columns' }
const card = { tag: 'Cards' }
const checklist = { tag: 'Checklists' }
const auth = { tag: 'Auth' }

export const operations: Operation[] = [
  {
    ...auth,
    public: true,
    method: 'post',
    path: '/auth/register',
    summary: 'Register (first user becomes admin, later ones need an invitation)',
    body: registerSchema,
    success: { status: 201, schema: userSchema },
    errors: [403, 409],
  },
  {
    ...auth,
    public: true,
    method: 'post',
    path: '/auth/login',
    summary: 'Log in; sets the session cookie',
    body: loginSchema,
    success: { status: 200, schema: userSchema },
    errors: [401],
  },
  { ...auth, method: 'post', path: '/auth/logout', summary: 'Log out', success: { status: 204 } },
  {
    ...auth,
    method: 'get',
    path: '/auth/me',
    summary: 'Current user',
    success: { status: 200, schema: userSchema },
  },
  {
    ...auth,
    method: 'patch',
    path: '/auth/me',
    summary: 'Update the profile (name, avatar, locale)',
    body: updateProfileSchema,
    success: { status: 200, schema: userSchema },
  },
  {
    ...auth,
    public: true,
    method: 'post',
    path: '/auth/forgot-password',
    summary: 'Request a password reset email (always 202)',
    body: forgotPasswordSchema,
    success: { status: 202 },
  },
  {
    ...auth,
    public: true,
    method: 'post',
    path: '/auth/reset-password',
    summary: 'Set a new password with the emailed token',
    body: resetPasswordSchema,
    success: { status: 204 },
  },
  {
    ...auth,
    public: true,
    method: 'post',
    path: '/auth/verify-email',
    summary: 'Confirm the email address with the emailed token',
    body: verifyEmailSchema,
    success: { status: 204 },
  },
  {
    ...auth,
    method: 'post',
    path: '/auth/resend-verification',
    summary: 'Resend the verification email',
    success: { status: 204 },
  },
  {
    ...auth,
    method: 'post',
    path: '/invitations',
    summary: 'Invite someone to register (admin only)',
    body: createInvitationSchema,
    success: { status: 201, schema: invitationSchema },
    errors: [403, 409],
  },

  {
    ...board,
    method: 'get',
    path: '/boards',
    summary: 'List boards',
    success: { status: 200, schema: boardListSchema },
  },
  {
    ...board,
    method: 'post',
    path: '/boards',
    summary: 'Create a board',
    body: createBoardSchema,
    success: { status: 201, schema: boardSummarySchema },
  },
  {
    ...board,
    method: 'get',
    path: '/boards/{id}',
    summary: 'Get a board with columns, cards and labels',
    success: { status: 200, schema: boardSchema },
  },
  {
    ...board,
    method: 'patch',
    path: '/boards/{id}',
    summary: 'Update a board',
    body: updateBoardSchema,
    success: { status: 200, schema: boardSummarySchema },
  },
  {
    ...board,
    method: 'delete',
    path: '/boards/{id}',
    summary: 'Archive a board',
    success: { status: 204 },
  },
  {
    ...board,
    method: 'post',
    path: '/boards/{id}/columns',
    summary: 'Create a column at the end of the board',
    body: createColumnSchema,
    success: { status: 201, schema: columnSchema },
  },
  {
    ...board,
    method: 'post',
    path: '/boards/{id}/labels',
    summary: 'Create a label',
    body: createLabelSchema,
    success: { status: 201, schema: labelSchema },
  },

  {
    ...column,
    method: 'patch',
    path: '/columns/{id}',
    summary: 'Update a column',
    body: updateColumnSchema,
    success: { status: 200, schema: columnSchema },
  },
  {
    ...column,
    method: 'post',
    path: '/columns/{id}/move',
    summary: 'Move a column before another one (or to the end)',
    body: moveColumnSchema,
    success: { status: 200, schema: columnSchema },
    errors: [422],
  },
  {
    ...column,
    method: 'delete',
    path: '/columns/{id}',
    summary: 'Delete a column; cards go to moveCardsTo',
    query: deleteColumnQuerySchema,
    success: { status: 204 },
    errors: [409, 422],
  },
  {
    ...column,
    method: 'post',
    path: '/columns/{id}/cards',
    summary: 'Create a card at the end of the column',
    body: createCardSchema,
    success: { status: 201, schema: cardSchema },
    errors: [422],
  },

  {
    ...card,
    method: 'get',
    path: '/cards/{id}',
    summary: 'Get a card',
    success: { status: 200, schema: cardSchema },
  },
  {
    ...card,
    method: 'patch',
    path: '/cards/{id}',
    summary: 'Update a card',
    body: updateCardSchema,
    success: { status: 200, schema: cardSchema },
    errors: [422],
  },
  {
    ...card,
    method: 'post',
    path: '/cards/{id}/move',
    summary: 'Move a card to a column, before another card (or to the end)',
    body: moveCardSchema,
    success: { status: 200, schema: cardSchema },
    errors: [422],
  },
  {
    ...card,
    method: 'delete',
    path: '/cards/{id}',
    summary: 'Delete a card',
    success: { status: 204 },
  },
  {
    ...card,
    method: 'post',
    path: '/cards/{id}/checklists',
    summary: 'Create a checklist',
    body: createChecklistSchema,
    success: { status: 201, schema: checklistSchema },
  },

  {
    ...checklist,
    method: 'patch',
    path: '/checklists/{id}',
    summary: 'Rename a checklist',
    body: updateChecklistSchema,
    success: { status: 200, schema: checklistSchema },
  },
  {
    ...checklist,
    method: 'delete',
    path: '/checklists/{id}',
    summary: 'Delete a checklist',
    success: { status: 204 },
  },
  {
    ...checklist,
    method: 'post',
    path: '/checklists/{id}/items',
    summary: 'Add a checklist item',
    body: createChecklistItemSchema,
    success: { status: 201, schema: checklistItemSchema },
  },
  {
    ...checklist,
    method: 'patch',
    path: '/checklist-items/{id}',
    summary: 'Update a checklist item',
    body: updateChecklistItemSchema,
    success: { status: 200, schema: checklistItemSchema },
  },
  {
    ...checklist,
    method: 'delete',
    path: '/checklist-items/{id}',
    summary: 'Delete a checklist item',
    success: { status: 204 },
  },
]

export { idParamsSchema }
