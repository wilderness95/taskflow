import { describe, expect, it } from 'vitest'
import { extractMentionIds, splitMentions } from './mentions'

const people = [
  { id: 'u1', name: 'Zoli' },
  { id: 'u2', name: 'Zoli Kis' },
  { id: 'u3', name: 'Éva (QA)' },
]

describe('extractMentionIds', () => {
  it('finds mentions, preferring the longest matching name', () => {
    expect(extractMentionIds('Szia @Zoli Kis és @Zoli!', people)).toEqual(['u2', 'u1'])
  })

  it('is case-insensitive, handles special characters and deduplicates', () => {
    expect(extractMentionIds('@éva (qa) @Éva (QA)', people)).toEqual(['u3'])
  })

  it('ignores partial words, e-mail addresses and unknown names', () => {
    expect(extractMentionIds('mail@Zoli.hu @Zolika @Senki', people)).toEqual([])
  })

  it('works without people', () => {
    expect(extractMentionIds('@Zoli', [])).toEqual([])
  })
})

describe('splitMentions', () => {
  it('splits the text around mentions', () => {
    const segments = splitMentions('Hé @Zoli, nézd meg', people)
    expect(segments.map((s) => s.text)).toEqual(['Hé ', '@Zoli', ', nézd meg'])
    expect(segments.map((s) => s.mention?.id ?? null)).toEqual([null, 'u1', null])
  })

  it('returns the whole text when there is no mention', () => {
    expect(splitMentions('semmi', people)).toEqual([{ text: 'semmi', mention: null }])
  })
})
