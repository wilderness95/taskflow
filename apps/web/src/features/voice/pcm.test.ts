import { describe, expect, it } from 'vitest'
import { downsample, floatToPcm16, pcm16ToFloat } from './pcm'

describe('downsample', () => {
  it('averages groups of samples and halves the length at 2:1', () => {
    const out = downsample(new Float32Array([0, 1, 1, 1, 0.5, 0.5]), 48000, 24000)
    expect(Array.from(out)).toEqual([0.5, 1, 0.5])
  })

  it('keeps the length ratio for 48 kHz -> 16 kHz', () => {
    expect(downsample(new Float32Array(480), 48000, 16000)).toHaveLength(160)
  })

  it('copies the input when no reduction is needed', () => {
    const input = new Float32Array([0.1, 0.2])
    const out = downsample(input, 16000, 16000)
    expect(out).not.toBe(input)
    expect(Array.from(out)).toEqual(Array.from(input))
  })
})

describe('floatToPcm16 / pcm16ToFloat', () => {
  it('clamps and scales to 16-bit', () => {
    expect(Array.from(floatToPcm16(new Float32Array([0, 1, -1, 2, -2])))).toEqual([
      0, 32767, -32768, 32767, -32768,
    ])
  })

  it('round-trips little-endian bytes', () => {
    const pcm = floatToPcm16(new Float32Array([0.5, -0.5]))
    const back = pcm16ToFloat(pcm.buffer as ArrayBuffer)
    expect(back[0]).toBeCloseTo(0.5, 3)
    expect(back[1]).toBeCloseTo(-0.5, 3)
  })

  it('ignores a dangling odd byte', () => {
    expect(pcm16ToFloat(new Uint8Array([0, 0, 1]).buffer)).toHaveLength(1)
  })
})
