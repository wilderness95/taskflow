import type { VoiceEndReason, VoiceStatsDto } from '@taskflow/shared'
import { desc, eq, gte, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { users, voiceSessions } from '../../db/schema.js'
import { newId } from '../../db/ids.js'

export interface VoiceSessionRecord {
  userId: string
  boardId: string | null
  startedAt: Date
  durationMs: number
  endReason: VoiceEndReason
  interruptions: number
  toolCalls: number
  toolErrors: number
  audioInMs: number
  audioOutMs: number
}

export function createVoiceStatsRepository(db: Db) {
  return {
    record: (row: VoiceSessionRecord): void => {
      db.insert(voiceSessions)
        .values({ id: newId(), ...row })
        .run()
    },

    /** A `since` utáni munkamenetek összesítése. */
    summary: (since: Date): Omit<VoiceStatsDto, 'days' | 'since'> => {
      const inRange = gte(voiceSessions.startedAt, since)
      const totals = db
        .select({
          sessions: sql<number>`count(*)`,
          durationMs: sql<number>`coalesce(sum(${voiceSessions.durationMs}), 0)`,
          maxDurationMs: sql<number>`coalesce(max(${voiceSessions.durationMs}), 0)`,
          interruptions: sql<number>`coalesce(sum(${voiceSessions.interruptions}), 0)`,
          toolCalls: sql<number>`coalesce(sum(${voiceSessions.toolCalls}), 0)`,
          toolErrors: sql<number>`coalesce(sum(${voiceSessions.toolErrors}), 0)`,
          audioInMs: sql<number>`coalesce(sum(${voiceSessions.audioInMs}), 0)`,
          audioOutMs: sql<number>`coalesce(sum(${voiceSessions.audioOutMs}), 0)`,
        })
        .from(voiceSessions)
        .where(inRange)
        .get()!

      const byReason = db
        .select({
          reason: voiceSessions.endReason,
          count: sql<number>`count(*)`,
        })
        .from(voiceSessions)
        .where(inRange)
        .groupBy(voiceSessions.endReason)
        .orderBy(desc(sql`count(*)`))
        .all()

      const day = sql<string>`strftime('%Y-%m-%d', ${voiceSessions.startedAt} / 1000, 'unixepoch')`
      const byDay = db
        .select({
          day,
          sessions: sql<number>`count(*)`,
          durationMs: sql<number>`sum(${voiceSessions.durationMs})`,
        })
        .from(voiceSessions)
        .where(inRange)
        .groupBy(day)
        .orderBy(day)
        .all()

      const topUsers = db
        .select({
          userId: voiceSessions.userId,
          name: users.name,
          sessions: sql<number>`count(*)`,
          durationMs: sql<number>`sum(${voiceSessions.durationMs})`,
        })
        .from(voiceSessions)
        .leftJoin(users, eq(users.id, voiceSessions.userId))
        .where(inRange)
        .groupBy(voiceSessions.userId)
        .orderBy(desc(sql`sum(${voiceSessions.durationMs})`))
        .limit(5)
        .all()

      return {
        totals: {
          ...totals,
          avgDurationMs: totals.sessions ? Math.round(totals.durationMs / totals.sessions) : 0,
        },
        byReason: byReason as { reason: VoiceEndReason; count: number }[],
        byDay,
        topUsers,
      }
    },
  }
}
export type VoiceStatsRepository = ReturnType<typeof createVoiceStatsRepository>
