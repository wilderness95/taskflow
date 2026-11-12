import { z } from 'zod'
import { idSchema } from './common'

/** `WS /api/v1/voice/live?boardId=...` lekérdezése. */
export const voiceQuerySchema = z.object({ boardId: idSchema })

/** A mikrofon nyers PCM-je: 16 bites, little-endian, mono, 16 kHz. */
export const VOICE_INPUT_SAMPLE_RATE = 16000
/** A válasz nyers PCM-je: 16 bites, little-endian, mono, 24 kHz. */
export const VOICE_OUTPUT_SAMPLE_RATE = 24000

export const VOICE_STATES = ['listening', 'thinking', 'speaking'] as const
export const voiceStateSchema = z.enum(VOICE_STATES)
export type VoiceState = z.infer<typeof voiceStateSchema>

/**
 * A WebSocket szöveges keretei (a bináris keretek a nyers PCM audio: kliens -> szerver 16 kHz,
 * szerver -> kliens 24 kHz). A szerver nem küld megjelenítendő szöveget: hibakód + paraméterek.
 */
export const voiceServerMessageSchema = z.discriminatedUnion('type', [
  /** A munkamenet él; ettől fogva küldhető audio. */
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('state'), state: voiceStateSchema }),
  /** A felhasználó félbeszakította a választ: a kliens ürítse a lejátszási sorát. */
  z.object({ type: z.literal('interrupted') }),
  /** Az asszisztens eszközt hív (a UI jelezheti); `ok: false` hibánál. */
  z.object({ type: z.literal('tool'), name: z.string(), ok: z.boolean() }),
  z.object({
    type: z.literal('transcript'),
    role: z.enum(['user', 'assistant']),
    text: z.string(),
  }),
  z.object({ type: z.literal('error'), code: z.string() }),
])
export type VoiceServerMessage = z.infer<typeof voiceServerMessageSchema>

export const voiceClientMessageSchema = z.discriminatedUnion('type', [
  /** A mikrofon szünetel (pl. némítás): a szerver jelzi a modellnek az audio-folyam végét. */
  z.object({ type: z.literal('audio_end') }),
])
export type VoiceClientMessage = z.infer<typeof voiceClientMessageSchema>

/** A szerver hibakódjai a hangvégponton (a WebSocket close kód mellett `error` üzenetben is). */
export const VOICE_ERROR_CODES = [
  'voice_unavailable',
  'too_many_sessions',
  'session_expired',
  'upstream_error',
] as const
