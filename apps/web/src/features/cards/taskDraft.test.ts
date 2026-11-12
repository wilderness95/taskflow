import { describe, expect, it } from 'vitest'
import { makeTask } from '../boards/testUtils'
import { buildTaskFromDraft, createDraftFromTask, createEmptyDraft } from './taskDraft'

const DEFAULT_TITLE = 'Alapértelmezett lista'

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

  it('checklist nélkül nincs checklist, több checklist megmarad', () => {
    expect(createDraftFromTask(makeTask('t'), 'todo').checklists).toEqual([])
    const lists = [
      { id: 'a', title: 'A', items: [] },
      { id: 'b', title: 'B', items: [{ id: 'i', text: 'x', done: false }] },
    ]
    expect(createDraftFromTask(makeTask('t', { checklists: lists }), 'todo').checklists).toEqual(
      lists,
    )
  })
})

describe('buildTaskFromDraft', () => {
  const draft = () => ({
    ...createEmptyDraft('todo'),
    title: '  Cím  ',
    tags: 'a, b',
    checklists: [
      {
        id: 'c1',
        title: 'Lista',
        items: [
          { id: 'i1', text: ' egy ', done: true },
          { text: '   ', done: false },
          { text: 'kettő', done: false },
        ],
      },
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
    expect(task.checklists[0]?.items.map((item) => item.text)).toEqual(['egy', 'kettő'])
    expect(task.checklists[0]?.items[0]?.id).toBe('i1')
    expect(task.checklists[0]?.items[1]?.id).toBeTruthy()
  })

  it('az üres leírás üresen marad (a feliratot a megjelenítés adja)', () => {
    expect(
      buildTaskFromDraft(draft(), { id: 't1', done: false, defaultChecklistTitle: DEFAULT_TITLE })
        .description,
    ).toBe('')
  })

  it('üres checklist-cím esetén az alapértelmezett címet adja', () => {
    const task = buildTaskFromDraft(
      {
        ...draft(),
        checklists: [{ id: 'c1', title: '  ', items: [] }],
      },
      { id: 't1', done: false, defaultChecklistTitle: DEFAULT_TITLE },
    )
    expect(task.checklists[0]?.title).toBe(DEFAULT_TITLE)
  })

  it('átveszi a "done" jelzőt', () => {
    expect(
      buildTaskFromDraft(draft(), { id: 't1', done: true, defaultChecklistTitle: DEFAULT_TITLE })
        .done,
    ).toBe(true)
  })
})
