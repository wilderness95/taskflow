import { useQueryClient } from '@tanstack/react-query'
import { voiceServerMessageSchema, type VoiceState } from '@taskflow/shared'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { createPcmPlayer, startMicCapture, type MicCapture, type PcmPlayer } from './voiceAudio'

export type VoiceStatus = 'idle' | 'connecting' | VoiceState

/** A kliensoldali hibák mellett a szerver hibakódjai (`VOICE_ERROR_CODES`) is előfordulnak. */
export type VoiceError =
  'unsupported' | 'mic_denied' | 'connection_failed' | 'connection_lost' | (string & {})

type State = { status: VoiceStatus; error: VoiceError | null }
type Action =
  | { type: 'connecting' }
  | { type: 'state'; state: VoiceState }
  | { type: 'ended'; error?: VoiceError }

const initialState: State = { status: 'idle', error: null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'connecting':
      return { status: 'connecting', error: null }
    case 'state':
      // A lezárt munkamenet késői üzenete ne éleszthesse újra az állapotot.
      return state.status === 'idle' ? state : { ...state, status: action.state }
    case 'ended':
      return { status: 'idle', error: action.error ?? null }
  }
}

const isSupported = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function' &&
  typeof AudioWorkletNode !== 'undefined' &&
  typeof WebSocket !== 'undefined'

/** Az asszisztens kontextusa: a nézett tábla és/vagy munkaterület (mindkettő hiányozhat). */
export type VoiceScope = { boardId?: string; workspaceId?: string }

const socketUrl = (scope: VoiceScope) => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const query = new URLSearchParams()
  if (scope.boardId) query.set('boardId', scope.boardId)
  if (scope.workspaceId) query.set('workspaceId', scope.workspaceId)
  return `${scheme}://${window.location.host}/api/v1/voice/live?${query.toString()}`
}

/**
 * Élő hangasszisztens egy táblához: WebSocket a szerver Gemini-hídjához, mikrofon-rögzítés
 * (16 kHz PCM) és a válasz lejátszása (24 kHz PCM). A tábla frissítését nem itt kezeljük: az
 * asszisztens módosításai az SSE csatornán és a TanStack Query-n át maguktól megjelennek.
 */
export function useVoiceAssistant(scope: VoiceScope) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(reducer, initialState)
  const socketRef = useRef<WebSocket | null>(null)
  const micRef = useRef<MicCapture | null>(null)
  const playerRef = useRef<PcmPlayer | null>(null)
  // Kézi megszakítás után a válasz hátralévő hangját eldobjuk, amíg a modell be nem fejezi a fordulót.
  const droppingRef = useRef(false)

  const teardown = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    if (socket) {
      socket.onclose = null
      socket.onmessage = null
      socket.close()
    }
    micRef.current?.stop()
    micRef.current = null
    playerRef.current?.close()
    playerRef.current = null
    droppingRef.current = false
  }, [])

  const stop = useCallback(() => {
    teardown()
    dispatch({ type: 'ended' })
  }, [teardown])

  const fail = useCallback(
    (error: VoiceError) => {
      teardown()
      dispatch({ type: 'ended', error })
    },
    [teardown],
  )

  const start = useCallback(async () => {
    if (socketRef.current) return
    if (!isSupported()) return fail('unsupported')
    dispatch({ type: 'connecting' })

    const player = createPcmPlayer()
    playerRef.current = player
    const socket = new WebSocket(socketUrl(scope))
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket
    let ready = false

    socket.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      if (typeof event.data !== 'string') {
        if (!droppingRef.current) player.enqueue(event.data)
        return
      }
      let json: unknown
      try {
        json = JSON.parse(event.data)
      } catch {
        return
      }
      const parsed = voiceServerMessageSchema.safeParse(json)
      if (!parsed.success) return
      const message = parsed.data
      switch (message.type) {
        case 'ready':
          ready = true
          break
        case 'state':
          if (message.state === 'listening') droppingRef.current = false
          dispatch({ type: 'state', state: message.state })
          break
        case 'interrupted':
          droppingRef.current = false
          player.flush()
          break
        case 'tool':
          // A munkaterület-listának nincs SSE csatornája: az asszisztens módosítása után frissítünk.
          if (message.ok) {
            void queryClient.invalidateQueries({ queryKey: ['boards'] })
            void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
          }
          break
        case 'error':
          fail(message.code)
          break
        default:
          break
      }
    }
    socket.onclose = () => fail(ready ? 'connection_lost' : 'connection_failed')
    socket.onerror = () => undefined

    try {
      micRef.current = await startMicCapture((pcm) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(pcm.buffer as ArrayBuffer)
      })
    } catch {
      fail('mic_denied')
    }
  }, [scope.boardId, scope.workspaceId, queryClient, fail])

  /** Kézi megszakítás: a lejátszás azonnal leáll, a munkamenet tovább hallgat. */
  const interrupt = useCallback(() => {
    droppingRef.current = true
    playerRef.current?.flush()
    dispatch({ type: 'state', state: 'listening' })
  }, [])

  // Kilépéskor a munkamenet lezárul (táblaváltáskor a hívó új `key`-jel újra létrehozza a gombot).
  useEffect(() => teardown, [teardown])

  return { status: state.status, error: state.error, start, stop, interrupt }
}
