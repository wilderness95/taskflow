import { VOICE_INPUT_SAMPLE_RATE, VOICE_OUTPUT_SAMPLE_RATE } from '@taskflow/shared'
import { downsample, floatToPcm16, pcm16ToFloat } from './pcm'
import micWorkletUrl from './micWorklet.js?url'

export type MicCapture = { stop: () => void }

/**
 * Mikrofon-rögzítés: `AudioWorklet` a nyers mintákhoz, 16 kHz-es 16 bites PCM-mé alakítva.
 * Hibát dob, ha nincs engedély vagy mikrofon (a hívó fordítható hibakódra képezi).
 */
export async function startMicCapture(onChunk: (pcm: Int16Array) => void): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const context = new AudioContext()
  try {
    await context.audioWorklet.addModule(micWorkletUrl)
    const source = context.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(context, 'mic-capture')
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      onChunk(floatToPcm16(downsample(event.data, context.sampleRate, VOICE_INPUT_SAMPLE_RATE)))
    }
    source.connect(node)
    // A worklet kimenetét nem kötjük a hangszóróra (nincs visszacsatolás).
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop())
    void context.close()
    throw error
  }
  return {
    stop: () => {
      stream.getTracks().forEach((track) => track.stop())
      void context.close()
    },
  }
}

export type PcmPlayer = {
  /** Egy nyers 24 kHz-es PCM-darab sorba állítása (megszakítás nélkül, pufferelve). */
  enqueue: (bytes: ArrayBuffer) => void
  /** A sor és a lejátszás azonnali megszakítása (barge-in). */
  flush: () => void
  close: () => void
}

/** Pufferelt lejátszó a modell 24 kHz-es válaszaihoz: a darabokat egymás után ütemezi. */
export function createPcmPlayer(): PcmPlayer {
  const context = new AudioContext({ sampleRate: VOICE_OUTPUT_SAMPLE_RATE })
  let sources: AudioBufferSourceNode[] = []
  let nextStart = 0

  return {
    enqueue(bytes) {
      const samples = pcm16ToFloat(bytes)
      if (samples.length === 0) return
      void context.resume()
      const buffer = context.createBuffer(1, samples.length, VOICE_OUTPUT_SAMPLE_RATE)
      buffer.copyToChannel(new Float32Array(samples), 0)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      // Kis előfutás, hogy a hálózati ingadozás ne roppanjon bele a lejátszásba.
      const startAt = Math.max(nextStart, context.currentTime + 0.05)
      source.start(startAt)
      nextStart = startAt + buffer.duration
      sources.push(source)
      source.onended = () => {
        sources = sources.filter((candidate) => candidate !== source)
      }
    },
    flush() {
      for (const source of sources) {
        source.onended = null
        try {
          source.stop()
        } catch {
          // már leállt
        }
      }
      sources = []
      nextStart = 0
    },
    close() {
      this.flush()
      void context.close()
    },
  }
}
