import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, resources, SUPPORTED_LANGUAGES } from './resources'

type Tree = { [key: string]: string | Tree }

const flatten = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  )

const keysOf = (language: keyof typeof resources): string[] =>
  Object.entries(resources[language])
    .flatMap(([namespace, tree]) => flatten(tree as Tree, `${namespace}:`))
    .sort()

describe('fordítási fájlok', () => {
  it('minden támogatott nyelvhez van fordítás', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(resources).toHaveProperty(language)
    }
  })

  it.each(SUPPORTED_LANGUAGES)(
    'a(z) %s nyelv kulcsai megegyeznek a magyar forrással',
    (language) => {
      expect(keysOf(language)).toEqual(keysOf(DEFAULT_LANGUAGE))
    },
  )
})
