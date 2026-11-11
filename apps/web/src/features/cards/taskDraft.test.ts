import { describe, expect, it } from 'vitest'
import { makeTask } from '../boards/testUtils'
import {
  buildTaskFromDraft,
  createDraftFromTask,
  createEmptyDraft,
  DEFAULT_CHECKLIST_TITLE,
  EMPTY_DESCRIPTION,
} from './taskDraft'

describe('createEmptyDraft', () => {
  it('az adott oszlopra és közepes prioritásra áll', () => {
    expect(createEmptyDraft('doing')).toMatchObject({
      column: 'doing',
      priority: 'medium',
      title: '',
    })
  })
})

describe('createDraftFromTask', () => {
  it('a címkéket vesszős szöveggé alakítja', () => {
    const task = makeTask('t', {
      tags: [
        { label: 'UI', color: 'blue' },
        { label: 'UX', color: 'amber' },
      ],
    })
    expect(createDraftFromTask(task, 'todo').tags).toBe('UI, UX')
  })

  it('checklist nélkül az alapértelmezett cím és üres lista jön', () => {
    const draft = createDraftFromTask(makeTask('t'), 'todo')
    expect(draft.checklistTitle).toBe(DEFAULT_CHECKLIST_TITLE)
    expect(draft.checklistItems).toEqual([])
  })
})

describe('buildTaskFromDraft', () => {
  const draft = () => ({
    ...createEmptyDraft('todo'),
    title: '  Cím  ',
    tags: 'a, b',
    checklistItems: [
      { id: 'i1', text: ' egy ', done: true },
      { text: '   ', done: false },
      { text: 'kettő', done: false },
    ],
  })

  it('trimmel, címkéket parse-ol, az üres checklist-tételeket eldobja', () => {
    const task = buildTaskFromDraft(draft(), { id: 't1', done: false })
    expect(task.title).toBe('Cím')
    expect(task.tags.map((tag) => tag.label)).toEqual(['a', 'b'])
    expect(task.checklist?.items?.map((item) => item.text)).toEqual(['egy', 'kettő'])
    expect(task.checklist?.items?.[0]?.id).toBe('i1')
    expect(task.checklist?.items?.[1]?.id).toBeTruthy()
  })

  it('üres leírás helyett az alapértelmezett szöveget adja', () => {
    expect(buildTaskFromDraft(draft(), { id: 't1', done: false }).description).toBe(
      EMPTY_DESCRIPTION,
    )
  })

  it('átveszi a "done" jelzőt', () => {
    expect(buildTaskFromDraft(draft(), { id: 't1', done: true }).done).toBe(true)
  })
})
