// AudioWorklet: a mikrofon mintáit blokkokban a fő szálra küldi (a mintavétel-csökkentés és a
// PCM-konverzió ott történik, `pcm.ts`). Különálló fájl, mert a worklet saját szkript-környezetben fut.
class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(2048)
    this.length = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.length++] = channel[i]
        if (this.length === this.buffer.length) {
          const chunk = this.buffer.slice()
          this.port.postMessage(chunk, [chunk.buffer])
          this.length = 0
        }
      }
    }
    return true
  }
}

registerProcessor('mic-capture', MicCapture)
