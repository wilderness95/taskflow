import { describe, expect, it } from 'vitest'
import { makeTask } from '../boards/testUtils'
import { buildTaskFromDraft, createDraftFromTask, createEmptyDraft } from './taskDraft'

const DEFAULT_TITLE = 'Alapértelmezett lista'

describe('createEmptyDraft', () => {
  it('az adott oszlopra és közepes prioritásra áll', () => {
    expect(createEmptyDraft('doing', DEFAULT_TITLE)).toMatchObject({
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
    expect(createDraftFromTask(task, 'todo', DEFAULT_TITLE).tags).toBe('UI, UX')
  })

  it('checklist nélkül az alapértelmezett cím és üres lista jön', () => {
    const draft = createDraftFromTask(makeTask('t'), 'todo', DEFAULT_TITLE)
    expect(draft.checklistTitle).toBe(DEFAULT_TITLE)
    expect(draft.checklistItems).toEqual([])
  })
})

describe('buildTaskFromDraft', () => {
  const draft = () => ({
    ...createEmptyDraft('todo', DEFAULT_TITLE),
    title: '  Cím  ',
    tags: 'a, b',
    checklistItems: [
      { id: 'i1', text: ' egy ', done: true },
      { text: '   ', done: false },
      { text: 'kettő', done: false },
    ],
  })

  it('trimmel, címkéket parse-ol, az üres checklist-tételeket eldobja', () => {
    const task = buildTaskFromDraft(draft(), {
      id: 't1',
      done: false,
      defaultChecklistTitle: DEFAULT_TITLE,
    })
    expect(task.title).toBe('Cím')
    expect(task.tags.map((tag) => tag.label)).toEqual(['a', 'b'])
    expect(task.checklist?.items?.map((item) => item.text)).toEqual(['egy', 'kettő'])
    expect(task.checklist?.items?.[0]?.id).toBe('i1')
    expect(task.checklist?.items?.[1]?.id).toBeTruthy()
  })

  it('az üres leírás üresen marad (a feliratot a megjelenítés adja)', () => {
    expect(
      buildTaskFromDraft(draft(), { id: 't1', done: false, defaultChecklistTitle: DEFAULT_TITLE })
        .description,
    ).toBe('')
  })

  it('üres checklist-cím esetén az alapértelmezett címet adja', () => {
    const task = buildTaskFromDraft(
      { ...draft(), checklistTitle: '  ' },
      { id: 't1', done: false, defaultChecklistTitle: DEFAULT_TITLE },
    )
    expect(task.checklist?.title).toBe(DEFAULT_TITLE)
  })

  it('átveszi a "done" jelzőt', () => {
    expect(
      buildTaskFromDraft(draft(), { id: 't1', done: true, defaultChecklistTitle: DEFAULT_TITLE })
        .done,
    ).toBe(true)
  })
})
