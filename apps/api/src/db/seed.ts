import { eq } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing'
import type { Priority, TagColor } from '@taskflow/shared'
import type { Db } from './client.js'
import { newId } from './ids.js'
import * as s from './schema.js'

export const SEED_USER_ID = '01J00000000000000000000000'
export const SEED_BOARD_ID = '01J00000000000000000000001'

type SeedCard = {
  title: string
  description: string
  priority: Priority
  tags: { label: string; color: TagColor }[]
  dueDate: string
  coverImage?: string
  checklist: { done: number; total: number }
}
type SeedColumn = { title: string; accent: TagColor; isDone: boolean; cards: SeedCard[] }

// A frontend `initialColumns` kezdőadatának megfelelője.
const SEED_COLUMNS: SeedColumn[] = [
  {
    title: 'Teendők',
    accent: 'blue',
    isDone: false,
    cards: [
      {
        title: 'Landing page vázlat',
        description: 'Készítsünk néhány főbb szekciót a közönség számára.',
        priority: 'high',
        tags: [
          { label: 'UI', color: 'blue' },
          { label: 'Vezetői', color: 'purple' },
        ],
        dueDate: '2026-11-14',
        checklist: { done: 2, total: 4 },
      },
      {
        title: 'Felhasználói visszajelzés',
        description: 'Összegyűjtjük a legfontosabb UX észrevételeket.',
        priority: 'medium',
        tags: [{ label: 'UX', color: 'green' }],
        dueDate: '2026-11-11',
        checklist: { done: 1, total: 3 },
      },
    ],
  },
  {
    title: 'Folyamatban',
    accent: 'amber',
    isDone: false,
    cards: [
      {
        title: 'Dashboard felület',
        description: 'A fő adatok és grafikonok elkészítése a képernyőn.',
        priority: 'high',
        coverImage:
          'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
        tags: [{ label: 'Analytics', color: 'amber' }],
        dueDate: '2026-11-10',
        checklist: { done: 3, total: 5 },
      },
    ],
  },
  {
    title: 'Kész',
    accent: 'green',
    isDone: true,
    cards: [
      {
        title: 'Brand guideline',
        description: 'A színpaletta és a tipográfia jóváhagyása elkészült.',
        priority: 'low',
        tags: [{ label: 'Brand', color: 'rose' }],
        dueDate: '2026-11-08',
        checklist: { done: 4, total: 4 },
      },
    ],
  },
]

/** Idempotens: ha a seed tábla már létezik, nem csinál semmit. */
export function seed(db: Db): boolean {
  return db.transaction((tx) => {
    if (tx.select().from(s.boards).where(eq(s.boards.id, SEED_BOARD_ID)).get()) return false

    tx.insert(s.users)
      .values({ id: SEED_USER_ID, name: 'Demo felhasználó', email: 'demo@taskflow.local' })
      .run()
    tx.insert(s.boards)
      .values({ id: SEED_BOARD_ID, title: 'Termékfejlesztés', createdBy: SEED_USER_ID })
      .run()

    const labelIds = new Map<string, string>()
    let colPos: string | null = null
    for (const col of SEED_COLUMNS) {
      colPos = generateKeyBetween(colPos, null)
      const columnId = newId()
      tx.insert(s.columns)
        .values({
          id: columnId,
          boardId: SEED_BOARD_ID,
          title: col.title,
          accent: col.accent,
          isDone: col.isDone,
          position: colPos,
        })
        .run()

      let cardPos: string | null = null
      for (const card of col.cards) {
        cardPos = generateKeyBetween(cardPos, null)
        const cardId = newId()
        tx.insert(s.cards)
          .values({
            id: cardId,
            columnId,
            title: card.title,
            description: card.description,
            priority: card.priority,
            dueDate: card.dueDate,
            coverImage: card.coverImage ?? null,
            position: cardPos,
            createdBy: SEED_USER_ID,
          })
          .run()

        for (const tag of card.tags) {
          const key = `${tag.label}:${tag.color}`
          let labelId = labelIds.get(key)
          if (!labelId) {
            labelId = newId()
            labelIds.set(key, labelId)
            tx.insert(s.labels)
              .values({ id: labelId, boardId: SEED_BOARD_ID, name: tag.label, color: tag.color })
              .run()
          }
          tx.insert(s.cardLabels).values({ cardId, labelId }).run()
        }

        const checklistId = newId()
        tx.insert(s.checklists)
          .values({
            id: checklistId,
            cardId,
            title: 'Checklist',
            position: generateKeyBetween(null, null),
          })
          .run()
        let itemPos: string | null = null
        for (let i = 0; i < card.checklist.total; i++) {
          itemPos = generateKeyBetween(itemPos, null)
          tx.insert(s.checklistItems)
            .values({
              id: newId(),
              checklistId,
              text: `Lépés ${i + 1}`,
              done: i < card.checklist.done,
              position: itemPos,
            })
            .run()
        }
      }
    }
    return true
  })
}
