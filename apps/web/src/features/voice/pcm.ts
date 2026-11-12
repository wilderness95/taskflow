/** Tiszta PCM-segédek a hangasszisztenshez (a böngésző Web Audio rétegétől függetlenül tesztelhetők). */

/** Lineáris átlagoló mintavétel-csökkentés (`inRate` >= `outRate`); azonos ráta esetén másolat. */
export function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return input.slice()
  const ratio = inRate / outRate
  const length = Math.floor(input.length / ratio)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j] ?? 0
    out[i] = end > start ? sum / (end - start) : 0
  }
  return out
}

/** Lebegőpontos minták (-1..1) 16 bites előjeles egészekké. */
export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0))
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
  }
  return out
}

/** Nyers 16 bites little-endian PCM bájtok lebegőpontos mintákká (a páratlan utolsó bájt eldobva). */
export function pcm16ToFloat(bytes: ArrayBuffer): Float32Array {
  const view = new DataView(bytes)
  const count = Math.floor(bytes.byteLength / 2)
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true) / 0x8000
  return out
}
