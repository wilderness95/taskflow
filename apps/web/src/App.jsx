import { useEffect, useMemo, useState } from 'react'
import { getChecklistProgress, getDueDateState, parseTags, PRIORITIES } from '@taskflow/shared'
import './App.css'

const defaultColumnPalette = ['blue', 'amber', 'green', 'purple', 'rose']

const createColumnId = () => `column-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

const initialColumns = {
  todo: {
    title: 'Teendők',
    accent: 'blue',
    done: false,
    tasks: [
      {
        id: 'task-1',
        title: 'Landing page vázlat',
        description: 'Készítsünk néhány főbb szekciót a közönség számára.',
        priority: 'high',
        tags: [
          { label: 'UI', color: 'blue' },
          { label: 'Vezetői', color: 'purple' },
        ],
        dueDate: '2026-11-14',
        checklist: { done: 2, total: 4 },
      },
      {
        id: 'task-2',
        title: 'Felhasználói visszajelzés',
        description: 'Összegyűjtjük a legfontosabb UX észrevételeket.',
        priority: 'medium',
        tags: [{ label: 'UX', color: 'green' }],
        dueDate: '2026-11-11',
        checklist: { done: 1, total: 3 },
      },
    ],
  },
  doing: {
    title: 'Folyamatban',
    accent: 'amber',
    done: false,
    tasks: [
      {
        id: 'task-3',
        title: 'Dashboard felület',
        description: 'A fő adatok és grafikonok elkészítése a képernyőn.',
        priority: 'high',
        coverImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
        tags: [{ label: 'Analytics', color: 'amber' }],
        dueDate: '2026-11-10',
        checklist: { done: 3, total: 5 },
      },
    ],
  },
  done: {
    title: 'Kész',
    accent: 'green',
    done: true,
    tasks: [
      {
        id: 'task-4',
        title: 'Brand guideline',
        description: 'A színpaletta és a tipográfia jóváhagyása elkészült.',
        priority: 'low',
        tags: [{ label: 'Brand', color: 'rose' }],
        dueDate: '2026-11-08',
        checklist: { done: 4, total: 4 },
      },
    ],
  },
}

// Átmeneti: az i18n lépésben t('card:priority.<érték>') váltja fel.
const priorityLabels = { high: 'Magas', medium: 'Közepes', low: 'Alacsony' }

const emptyDraft = {
  title: '',
  description: '',
  priority: 'medium',
  column: 'todo',
  dueDate: '',
  tags: '',
  checklistTitle: 'Content Checklist',
  checklistItems: [],
}

const formatDueDate = (dueDate) => {
  if (!dueDate) {
    return ''
  }

  const date = new Date(`${dueDate}T12:00:00`)
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function App() {
  const [columns, setColumns] = useState(initialColumns)
  const [draggedTask, setDraggedTask] = useState(null)
  const [draggedColumn, setDraggedColumn] = useState(null)
  const [dragState, setDragState] = useState({
    activeTaskId: null,
    sourceColumnId: null,
    targetColumnId: null,
    targetTaskId: null,
    pointerY: null,
  })
  const [columnDragState, setColumnDragState] = useState({
    activeColumnId: null,
    targetColumnId: null,
  })
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create',
    taskId: null,
    sourceColumn: 'todo',
    draft: emptyDraft,
  })
  const [renameModal, setRenameModal] = useState({
    isOpen: false,
    columnId: null,
    value: '',
    accent: 'blue',
  })
  const [deleteColumnModal, setDeleteColumnModal] = useState({
    isOpen: false,
    columnId: null,
  })
  const [boardTitle, setBoardTitle] = useState('Web App Fejlesztés (Csapat)')
  const [titleDraft, setTitleDraft] = useState('Web App Fejlesztés (Csapat)')
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [isStarred, setIsStarred] = useState(false)
  const [visibility, setVisibility] = useState('workspace')
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false)
  const [activeView, setActiveView] = useState('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState('Web App Fejlesztés')
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  const workspaceOptions = ['Web App Fejlesztés', 'Marketing', 'CRM']
  const visibilityOptions = [
    { value: 'private', label: 'Privát', description: 'Csak meghívottak látják' },
    { value: 'workspace', label: 'Munkaterületi', description: 'A munkaterület tagjai látják' },
    { value: 'public', label: 'Nyilvános', description: 'Bárki megtekintheti' },
  ]
  const viewOptions = [
    { value: 'kanban', label: 'Kanban Tábla' },
    { value: 'list', label: 'Lista' },
    { value: 'calendar', label: 'Naptár' },
    { value: 'timeline', label: 'Idővonal' },
  ]

  const filteredColumns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return columns
    }

    return Object.fromEntries(
      Object.entries(columns).map(([columnId, column]) => {
        const tasks = column.tasks.filter((task) => {
          const searchTarget = [
            task.title,
            task.description,
            priorityLabels[task.priority],
            task.dueDate,
            ...(task.tags ?? []).map((tag) => tag.label),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return searchTarget.includes(query)
        })

        return [columnId, { ...column, tasks }]
      }),
    )
  }, [columns, searchQuery])

  useEffect(() => {
    const handlePointerDown = (event) => {
      const clickedInsideWorkspaceMenu = event.target.closest('.workspace-switcher-wrap')
      const clickedInsideVisibilityMenu = event.target.closest('.visibility-badge-wrap')

      if (!clickedInsideWorkspaceMenu && !clickedInsideVisibilityMenu) {
        setWorkspaceMenuOpen(false)
        setVisibilityMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setWorkspaceMenuOpen(false)
        setVisibilityMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const totalTasks = useMemo(
    () =>
      Object.values(columns).reduce(
        (sum, column) => sum + column.tasks.length,
        0,
      ),
    [columns],
  )

  const columnEntries = Object.entries(filteredColumns)

  const handleBoardTitleSubmit = () => {
    const trimmed = titleDraft.trim()
    if (!trimmed) {
      setTitleDraft(boardTitle)
      setIsTitleEditing(false)
      return
    }

    setBoardTitle(trimmed)
    setIsTitleEditing(false)
  }

  const addColumn = () => {
    const nextIndex = columnEntries.length
    const nextId = createColumnId()

    setColumns((current) => ({
      ...current,
      [nextId]: {
        title: `Új oszlop ${nextIndex + 1}`,
        accent: defaultColumnPalette[nextIndex % defaultColumnPalette.length],
        done: false,
        tasks: [],
      },
    }))
  }

  const openRenameModal = (columnId) => {
    setRenameModal({
      isOpen: true,
      columnId,
      value: columns[columnId]?.title ?? '',
      accent: columns[columnId]?.accent ?? 'blue',
    })
  }

  const closeRenameModal = () => {
    setRenameModal({
      isOpen: false,
      columnId: null,
      value: '',
      accent: 'blue',
    })
  }

  const handleRenameFieldChange = (event) => {
    const { value } = event.target
    setRenameModal((current) => ({
      ...current,
      value,
    }))
  }

  const saveColumnRename = (event) => {
    event.preventDefault()

    const trimmed = renameModal.value.trim()
    if (!renameModal.columnId || !trimmed) {
      return
    }

    setColumns((current) => ({
      ...current,
      [renameModal.columnId]: {
        ...current[renameModal.columnId],
        title: trimmed,
        accent: renameModal.accent,
      },
    }))

    closeRenameModal()
  }

  const openDeleteColumnModal = (columnId) => {
    if (!columns[columnId]) {
      return
    }

    if (Object.keys(columns).length <= 1) {
      window.alert('Legalább egy oszlopnak maradnia kell.')
      return
    }

    setDeleteColumnModal({
      isOpen: true,
      columnId,
    })
  }

  const closeDeleteColumnModal = () => {
    setDeleteColumnModal({
      isOpen: false,
      columnId: null,
    })
  }

  const confirmDeleteColumn = () => {
    const { columnId } = deleteColumnModal
    if (!columnId || !columns[columnId]) {
      closeDeleteColumnModal()
      return
    }

    setColumns((current) => {
      const orderedIds = Object.keys(current)
      const index = orderedIds.indexOf(columnId)

      if (index === -1) {
        return current
      }

      const next = { ...current }
      const tasksToMove = [...(next[columnId]?.tasks ?? [])]
      delete next[columnId]

      const fallbackColumnId = orderedIds[index - 1] ?? orderedIds[index + 1]
      if (fallbackColumnId && fallbackColumnId !== columnId) {
        next[fallbackColumnId] = {
          ...next[fallbackColumnId],
          tasks: [...(next[fallbackColumnId]?.tasks ?? []), ...tasksToMove],
        }
      }

      return next
    })

    closeDeleteColumnModal()
  }

  const openCreateModal = (columnId = 'todo') => {
    setModalState({
      isOpen: true,
      mode: 'create',
      taskId: null,
      sourceColumn: columnId,
      draft: { ...emptyDraft, column: columnId },
    })
  }

  const openEditModal = (columnId, task) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      taskId: task.id,
      sourceColumn: columnId,
      draft: {
        title: task.title,
        description: task.description,
        priority: task.priority,
        column: columnId,
        dueDate: task.dueDate ?? '',
        tags: Array.isArray(task.tags) ? task.tags.map((tag) => tag.label).join(', ') : '',
        checklistTitle: task.checklist?.title ?? 'Content Checklist',
        checklistItems: Array.isArray(task.checklist?.items) ? task.checklist.items : [],
      },
    })
  }

  const moveTask = (taskId, fromColumnId, toColumnId, targetTaskId = null) => {
    setColumns((current) => {
      const sourceTasks = [...current[fromColumnId].tasks]
      const sourceIndex = sourceTasks.findIndex((task) => task.id === taskId)

      if (sourceIndex === -1) {
        return current
      }

      const [taskToMove] = sourceTasks.splice(sourceIndex, 1)
      const targetColumnMeta = current[toColumnId]
      const normalizedTask = {
        ...taskToMove,
        done: Boolean(targetColumnMeta?.done),
      }

      if (fromColumnId === toColumnId) {
        const reordered = [...sourceTasks]
        const insertIndex = targetTaskId
          ? reordered.findIndex((task) => task.id === targetTaskId)
          : reordered.length

        reordered.splice(insertIndex >= 0 ? insertIndex : reordered.length, 0, normalizedTask)

        return {
          ...current,
          [fromColumnId]: {
            ...current[fromColumnId],
            tasks: reordered,
          },
        }
      }

      const targetTasks = [...current[toColumnId].tasks]
      const insertIndex = targetTaskId
        ? targetTasks.findIndex((task) => task.id === targetTaskId)
        : targetTasks.length

      targetTasks.splice(insertIndex >= 0 ? insertIndex : targetTasks.length, 0, normalizedTask)

      return {
        ...current,
        [fromColumnId]: {
          ...current[fromColumnId],
          tasks: sourceTasks,
        },
        [toColumnId]: {
          ...current[toColumnId],
          tasks: targetTasks,
        },
      }
    })
  }

  const reorderColumns = (sourceColumnId, targetColumnId) => {
    if (sourceColumnId === targetColumnId) {
      return
    }

    setColumns((current) => {
      const orderedIds = Object.keys(current)
      const sourceIndex = orderedIds.indexOf(sourceColumnId)
      const targetIndex = orderedIds.indexOf(targetColumnId)

      if (sourceIndex === -1 || targetIndex === -1) {
        return current
      }

      const nextOrderedIds = [...orderedIds]
      const [movedColumnId] = nextOrderedIds.splice(sourceIndex, 1)
      nextOrderedIds.splice(targetIndex, 0, movedColumnId)

      return Object.fromEntries(nextOrderedIds.map((id) => [id, current[id]]))
    })
  }

  const closeModal = () => {
    setModalState({
      isOpen: false,
      mode: 'create',
      taskId: null,
      sourceColumn: 'todo',
      draft: emptyDraft,
    })
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setModalState((current) => ({
      ...current,
      draft: { ...current.draft, [name]: value },
    }))
  }

  const updateChecklistItem = (index, value) => {
    setModalState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        checklistItems: current.draft.checklistItems.map((item, itemIndex) =>
          itemIndex === index ? { ...item, text: value } : item,
        ),
      },
    }))
  }

  const toggleChecklistItem = (index) => {
    setModalState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        checklistItems: current.draft.checklistItems.map((item, itemIndex) =>
          itemIndex === index ? { ...item, done: !item.done } : item,
        ),
      },
    }))
  }

  const addChecklistItem = () => {
    setModalState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        checklistItems: [...current.draft.checklistItems, { id: `item-${Date.now()}-${Math.random()}`, text: '', done: false }],
      },
    }))
  }

  const removeChecklistItem = (index) => {
    setModalState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        checklistItems: current.draft.checklistItems.filter((_, itemIndex) => itemIndex !== index),
      },
    }))
  }

  const handleSaveTask = (event) => {
    event.preventDefault()

    if (!modalState.draft.title.trim()) {
      return
    }

    const normalizedChecklistItems = (modalState.draft.checklistItems ?? [])
      .filter((item) => item.text?.trim())
      .map((item) => ({
        id: item.id ?? `item-${Date.now()}-${Math.random()}`,
        text: item.text.trim(),
        done: Boolean(item.done),
      }))

    const nextTask = {
      id: modalState.taskId ?? `task-${Date.now()}`,
      title: modalState.draft.title.trim(),
      description: modalState.draft.description.trim() || 'Nincs hozzácsatolt leírás.',
      priority: modalState.draft.priority,
      done: Boolean(columns[modalState.draft.column]?.done),
      dueDate: modalState.draft.dueDate || '',
      tags: parseTags(modalState.draft.tags),
      checklist: {
        title: modalState.draft.checklistTitle?.trim() || 'Content Checklist',
        items: normalizedChecklistItems,
      },
    }

    setColumns((current) => {
      const next = { ...current }

      if (modalState.mode === 'edit' && modalState.taskId) {
        const originalColumn = modalState.sourceColumn
        const originalTasks = [...next[originalColumn].tasks]
        const taskIndex = originalTasks.findIndex((task) => task.id === modalState.taskId)

        if (taskIndex >= 0) {
          const updatedTask = { ...originalTasks[taskIndex], ...nextTask }

          if (modalState.draft.column === originalColumn) {
            originalTasks[taskIndex] = updatedTask
            next[originalColumn] = {
              ...next[originalColumn],
              tasks: originalTasks,
            }
            return next
          }

          next[originalColumn] = {
            ...next[originalColumn],
            tasks: originalTasks.filter((task) => task.id !== modalState.taskId),
          }
          next[modalState.draft.column] = {
            ...next[modalState.draft.column],
            tasks: [updatedTask, ...next[modalState.draft.column].tasks],
          }
          return next
        }
      }

      next[modalState.draft.column] = {
        ...next[modalState.draft.column],
        tasks: [nextTask, ...next[modalState.draft.column].tasks],
      }

      return next
    })

    closeModal()
  }

  const handleDeleteTask = (columnId, taskId) => {
    setColumns((current) => ({
      ...current,
      [columnId]: {
        ...current[columnId],
        tasks: current[columnId].tasks.filter((task) => task.id !== taskId),
      },
    }))
  }

  const handleDragStart = (taskId, sourceColumnId) => {
    setDraggedTask({ taskId, sourceColumnId })
    setDragState({
      activeTaskId: taskId,
      sourceColumnId,
      targetColumnId: sourceColumnId,
      targetTaskId: null,
      pointerY: null,
    })
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragState({
      activeTaskId: null,
      sourceColumnId: null,
      targetColumnId: null,
      targetTaskId: null,
      pointerY: null,
    })
  }

  const handleDrop = (targetColumnId, targetTaskId = null) => {
    if (!draggedTask) {
      return
    }

    const { taskId, sourceColumnId } = draggedTask

    if (sourceColumnId === targetColumnId && !targetTaskId) {
      handleDragEnd()
      return
    }

    moveTask(taskId, sourceColumnId, targetColumnId, targetTaskId)
    handleDragEnd()
  }

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-badge">T</div>
            <span className="brand-name">TaskFlow</span>
          </div>

          <div className="workspace-switcher-wrap">
            <button type="button" className="workspace-switcher" onClick={() => setWorkspaceMenuOpen((current) => !current)}>
              <span>{selectedWorkspace}</span>
              <span className="caret">⌄</span>
            </button>
            {workspaceMenuOpen && (
              <div className="menu-panel workspace-panel">
                {workspaceOptions.map((workspace) => (
                  <button
                    key={workspace}
                    type="button"
                    className={`menu-item ${selectedWorkspace === workspace ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedWorkspace(workspace)
                      setWorkspaceMenuOpen(false)
                    }}
                  >
                    {workspace}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Keresés kártyákra, címkékre, határidőre..."
              aria-label="Keresés"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="topbar-actions">
            <div className="stat-pill">{totalTasks} feladat</div>
            <button type="button" className="icon-button" aria-label="Értesítések">◔</button>
            <button type="button" className="icon-button" aria-label="Beállítások">⚙</button>
            <div className="avatar">A</div>
          </div>
        </header>

        <div className="workspace-layout">
          <main className="board-page">
            <section className="board-header">
              <div className="board-header-main">
                <span className="eyebrow">Board</span>
                {isTitleEditing ? (
                  <input
                    className="board-title-input"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={handleBoardTitleSubmit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleBoardTitleSubmit()
                      }

                      if (event.key === 'Escape') {
                        setTitleDraft(boardTitle)
                        setIsTitleEditing(false)
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className="board-title-row"
                    onClick={() => setIsTitleEditing(true)}
                    aria-label="Táblacím szerkesztése"
                  >
                    <h1>{boardTitle}</h1>
                  </button>
                )}
              </div>

              <div className="board-actions">
                <button
                  type="button"
                  className={`board-star-button ${isStarred ? 'is-starred' : ''}`}
                  onClick={() => setIsStarred((current) => !current)}
                  aria-label={isStarred ? 'Kedvenc eltávolítása' : 'Kedvenc hozzáadása'}
                >
                  ★
                </button>

                <div className="visibility-badge-wrap">
                  <button type="button" className="visibility-badge" onClick={() => setVisibilityMenuOpen((current) => !current)}>
                    <span className="visibility-icon">
                      {visibility === 'private' ? '🔒' : visibility === 'public' ? '🌍' : '👥'}
                    </span>
                    <span>{visibilityOptions.find((item) => item.value === visibility)?.label ?? 'Munkaterületi'}</span>
                  </button>
                  {visibilityMenuOpen && (
                    <div className="menu-panel visibility-panel">
                      {visibilityOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`menu-item ${visibility === option.value ? 'selected' : ''}`}
                          onClick={() => {
                            setVisibility(option.value)
                            setVisibilityMenuOpen(false)
                          }}
                        >
                          <span>{option.value === 'private' ? '🔒' : option.value === 'public' ? '🌍' : '👥'}</span>
                          <span className="menu-copy">
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="view-switcher" aria-label="Nézet választó">
                  {viewOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`view-tab ${activeView === option.value ? 'active' : ''}`}
                      onClick={() => setActiveView(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="member-stack">
                  <span className="member">A</span>
                  <span className="member">B</span>
                  <span className="member">C</span>
                </div>

                <button type="button" className="secondary-button" onClick={() => setInviteModalOpen(true)}>
                  + Meghívás
                </button>
                <button type="button" className="primary-button" onClick={addColumn}>
                  + Új oszlop
                </button>
              </div>
            </section>

            <div className="board-toolbar">
              <div className="board-filter-bar">
                <span className="search-icon">⌕</span>
                <input
                  type="text"
                  placeholder="Szűrés..."
                  aria-label="Szűrés"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="board-meta">
                <span className="meta-pill">Láthatóság: {visibilityOptions.find((item) => item.value === visibility)?.label ?? 'Munkaterületi'}</span>
                <span className="meta-pill">{activeView === 'kanban' ? 'Táblás' : activeView === 'list' ? 'Lista' : activeView === 'calendar' ? 'Naptár' : 'Idővonal'}</span>
                <span className="meta-pill">{isStarred ? 'Kedvenc' : 'Normál'}</span>
              </div>
            </div>

            <section className="board" aria-label="Kanban board">
              {columnEntries.map(([columnId, columnData], index) => {
                const accent = columnData.accent ?? defaultColumnPalette[index % defaultColumnPalette.length]

                return (
                  <div
                    key={columnId}
                    draggable
                    className={`column ${accent} ${dragState.targetColumnId === columnId ? 'is-drop-target' : ''} ${columnDragState.activeColumnId === columnId ? 'is-column-dragging' : ''} ${columnDragState.targetColumnId === columnId && columnDragState.activeColumnId !== columnId ? 'is-column-drop-target' : ''}`}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', columnId)
                      setDraggedColumn(columnId)
                      setColumnDragState({
                        activeColumnId: columnId,
                        targetColumnId: columnId,
                      })
                    }}
                    onDragEnd={() => {
                      setDraggedColumn(null)
                      setColumnDragState({
                        activeColumnId: null,
                        targetColumnId: null,
                      })
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      if (event.dataTransfer) {
                        event.dataTransfer.dropEffect = 'move'
                      }

                      if (draggedColumn) {
                        if (draggedColumn !== columnId) {
                          setColumnDragState((current) => ({
                            ...current,
                            targetColumnId: columnId,
                          }))
                        }
                        return
                      }

                      setDragState((current) => ({
                        ...current,
                        targetColumnId: columnId,
                        targetTaskId: null,
                        pointerY: event.clientY,
                      }))
                    }}
                    onDragEnter={() => {
                      if (draggedColumn) {
                        if (draggedColumn !== columnId) {
                          setColumnDragState((current) => ({
                            ...current,
                            targetColumnId: columnId,
                          }))
                        }
                        return
                      }

                      setDragState((current) => ({
                        ...current,
                        targetColumnId: columnId,
                        targetTaskId: null,
                      }))
                    }}
                    onDrop={(event) => {
                      event.preventDefault()

                      if (draggedColumn) {
                        if (draggedColumn !== columnId) {
                          reorderColumns(draggedColumn, columnId)
                        }
                        setDraggedColumn(null)
                        setColumnDragState({
                          activeColumnId: null,
                          targetColumnId: null,
                        })
                        return
                      }

                      if (draggedTask) {
                        handleDrop(columnId)
                      }
                    }}
                  >
                    <header className="column-header">
                      <div className="column-title-wrap">
                        <span className="column-dot" aria-hidden="true" />
                        <h2>{columnData.title}</h2>
                      </div>

                      <div className="column-tools">
                        <button
                          type="button"
                          className="column-action"
                          aria-label={`Oszlop átnevezése: ${columnData.title}`}
                          onClick={() => openRenameModal(columnId)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="column-action danger"
                          aria-label={`Oszlop törlése: ${columnData.title}`}
                          onClick={() => openDeleteColumnModal(columnId)}
                        >
                          🗑
                        </button>
                      </div>
                    </header>

                    <div className="task-list">
                      {columnData.tasks.length === 0 ? (
                        <button
                          type="button"
                          className={`empty-state ${dragState.targetColumnId === columnId ? 'is-drop-target' : ''}`}
                          onClick={() => openCreateModal(columnId)}
                          onDragOver={(event) => {
                            event.preventDefault()
                            setDragState((current) => ({
                              ...current,
                              targetColumnId: columnId,
                              targetTaskId: null,
                              pointerY: event.clientY,
                            }))
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            handleDrop(columnId)
                          }}
                        >
                          + Kártya hozzáadása
                        </button>
                      ) : (
                        <>
                          {columnData.tasks.map((task) => {
                            const checklistProgress = getChecklistProgress(task.checklist)
                            const dueState = getDueDateState(task.dueDate)

                            return (
                              <article
                                key={task.id}
                                className={`task-card ${dragState.activeTaskId === task.id ? 'is-dragging' : ''} ${dragState.targetTaskId === task.id ? 'is-over-target' : ''}`}
                                draggable
                                onDoubleClick={() => openEditModal(columnId, task)}
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = 'move'
                                  event.dataTransfer.setData('text/plain', task.id)
                                  handleDragStart(task.id, columnId)
                                }}
                                onDragEnd={handleDragEnd}
                                onDragOver={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  if (event.dataTransfer) {
                                    event.dataTransfer.dropEffect = 'move'
                                  }
                                  setDragState((current) => ({
                                    ...current,
                                    targetColumnId: columnId,
                                    targetTaskId: task.id,
                                    pointerY: event.clientY,
                                  }))
                                }}
                                onDrop={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  handleDrop(columnId, task.id)
                                }}
                              >
                                {dragState.activeTaskId && dragState.targetTaskId === task.id && (
                                  <div className="insert-indicator" aria-hidden="true" />
                                )}

                                <div className="task-card-top">
                                  <span className={`priority-pill priority-${task.priority}`}>
                                    {priorityLabels[task.priority]}
                                  </span>
                                  <button
                                    type="button"
                                    className="delete-button"
                                    aria-label={`Töröld a ${task.title} feladatot`}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleDeleteTask(columnId, task.id)
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>

                                <h3>{task.title}</h3>

                                {task.tags?.length > 0 && (
                                  <div className="task-tags">
                                    {task.tags.slice(0, 3).map((tag) => (
                                      <span key={`${task.id}-${tag.label}`} className={`task-tag tag-${tag.color}`}>
                                        {tag.label}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <p>{task.description}</p>

                                {task.dueDate && (
                                  <div className={`task-due ${dueState}`}>
                                    <span className="task-due-label">Határidő</span>
                                    <strong>{formatDueDate(task.dueDate)}</strong>
                                  </div>
                                )}

                                {checklistProgress.total > 0 && (
                                  <div className="task-checklist-summary">
                                    <div className="task-checklist-status">
                                      <span className="checklist-toggle">✓</span>
                                      <span>{checklistProgress.done}/{checklistProgress.total}</span>
                                    </div>
                                    <div className="task-progress-pill">
                                      {checklistProgress.percent}%
                                    </div>
                                  </div>
                                )}

                                {checklistProgress.total > 0 && (
                                  <div className="task-checklist-track-wrap">
                                    <div className="checklist-track">
                                      <span className="checklist-fill" style={{ width: `${checklistProgress.percent}%` }} />
                                    </div>
                                  </div>
                                )}

                              </article>
                            )
                          })}

                          <button type="button" className="add-card" onClick={() => openCreateModal(columnId)}>
                            + Kártya hozzáadása
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          </main>
        </div>
      </div>

      {renameModal.isOpen && (
        <div className="modal-overlay" onClick={closeRenameModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Oszlop neve</span>
                <h2>Átnevezés</h2>
              </div>
              <button type="button" className="close-button" onClick={closeRenameModal} aria-label="Bezárás">
                ×
              </button>
            </div>

            <form className="task-form" onSubmit={saveColumnRename}>
              <label>
                Név
                <input
                  type="text"
                  value={renameModal.value}
                  onChange={handleRenameFieldChange}
                  placeholder="Írd be az új oszlop nevét"
                />
              </label>

              <label>
                Pötty szín
                <div className="accent-picker">
                  {defaultColumnPalette.map((accent) => (
                    <button
                      key={accent}
                      type="button"
                      className={`accent-swatch ${renameModal.accent === accent ? 'selected' : ''}`}
                      style={{ background: accent === 'blue' ? '#60a5fa' : accent === 'amber' ? '#fbbf24' : accent === 'green' ? '#34d399' : accent === 'purple' ? '#a78bfa' : '#fb7185' }}
                      aria-label={`Szín: ${accent}`}
                      onClick={() => setRenameModal((current) => ({ ...current, accent }))}
                    />
                  ))}
                </div>
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeRenameModal}>
                  Mégse
                </button>
                <button type="submit" className="primary-button">
                  Mentés
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteColumnModal.isOpen && (
        <div className="modal-overlay" onClick={closeDeleteColumnModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Oszlop törlése</span>
                <h2>Biztos vagy benne?</h2>
              </div>
              <button type="button" className="close-button" onClick={closeDeleteColumnModal} aria-label="Bezárás">
                ×
              </button>
            </div>

            <p className="confirm-copy">
              A törölt oszlopban lévő feladatok a szomszédos oszlopba kerülnek.
            </p>

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeDeleteColumnModal}>
                Mégse
              </button>
              <button type="button" className="primary-button" onClick={confirmDeleteColumn}>
                Törlés
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteModalOpen && (
        <div className="modal-overlay" onClick={() => setInviteModalOpen(false)}>
          <div className="invite-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Meghívás</span>
                <h2>Tag hozzáadása</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setInviteModalOpen(false)} aria-label="Bezárás">
                ×
              </button>
            </div>

            <form
              className="invite-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!inviteEmail.trim()) {
                  return
                }

                setInviteEmail('')
                setInviteModalOpen(false)
              }}
            >
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="email@pelda.hu"
                aria-label="Email cím"
              />

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setInviteModalOpen(false)}>
                  Mégse
                </button>
                <button type="submit" className="primary-button">
                  Meghívás
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalState.isOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">{modalState.mode === 'create' ? 'Új feladat' : 'Feladat szerkesztése'}</span>
                <h2>{modalState.mode === 'create' ? 'Kártya hozzáadása' : 'Kártya módosítása'}</h2>
              </div>
              <button type="button" className="close-button" onClick={closeModal} aria-label="Bezárás">
                ×
              </button>
            </div>

            <form className="task-form" onSubmit={handleSaveTask}>
              <label>
                Cím
                <input
                  type="text"
                  name="title"
                  value={modalState.draft.title}
                  placeholder="Pl. Jira ticket frissítése"
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Leírás
                <textarea
                  name="description"
                  rows="4"
                  value={modalState.draft.description}
                  placeholder="Mit kell megcsinálni?"
                  onChange={handleFieldChange}
                />
              </label>

              <div className="form-row">
                <label>
                  Prioritás
                  <select name="priority" value={modalState.draft.priority} onChange={handleFieldChange}>
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priorityLabels[priority]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Oszlop
                  <select name="column" value={modalState.draft.column} onChange={handleFieldChange}>
                    {columnEntries.map(([columnId, columnData]) => (
                      <option key={columnId} value={columnId}>
                        {columnData.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="single-field">
                Címkék
                <input
                  type="text"
                  name="tags"
                  value={modalState.draft.tags}
                  placeholder="UI, UX, Marketing"
                  onChange={handleFieldChange}
                />
                <div className="tag-preview-row">
                  {parseTags(modalState.draft.tags).map((tag) => (
                    <span key={`${tag.label}-${tag.color}`} className={`task-tag tag-${tag.color}`}>
                      {tag.label}
                    </span>
                  ))}
                </div>
              </label>

              <label className="single-field">
                Határidő
                <input
                  type="date"
                  name="dueDate"
                  value={modalState.draft.dueDate}
                  onChange={handleFieldChange}
                />
              </label>

              <div className="checklist-panel">
                <div className="checklist-title-row">
                  <button type="button" className="checklist-toggle-button" aria-label="Checklist bejelölése">
                    ✓
                  </button>
                  <input
                    type="text"
                    className="checklist-title-input"
                    value={modalState.draft.checklistTitle}
                    onChange={(event) =>
                      setModalState((current) => ({
                        ...current,
                        draft: { ...current.draft, checklistTitle: event.target.value },
                      }))
                    }
                  />
                  <button type="button" className="delete-checklist-button">
                    Delete
                  </button>
                </div>

                <div className="checklist-progress-row">
                  <div className="checklist-progress-track">
                    <span
                      className="checklist-progress-fill"
                      style={{
                        width: `${
                          modalState.draft.checklistItems.length > 0
                            ? Math.round(
                                (modalState.draft.checklistItems.filter((item) => item.done).length /
                                  modalState.draft.checklistItems.length) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="checklist-progress-percent">
                    {modalState.draft.checklistItems.length > 0
                      ? Math.round(
                          (modalState.draft.checklistItems.filter((item) => item.done).length /
                            modalState.draft.checklistItems.length) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>

                <div className="checklist-items">
                  {modalState.draft.checklistItems.length === 0 && (
                    <div className="checklist-empty-state">Nincs elem a listában.</div>
                  )}

                  {modalState.draft.checklistItems.map((item, index) => (
                    <div key={item.id ?? `checklist-${index}`} className="checklist-item-row">
                      <button
                        type="button"
                        className={`checklist-item-toggle ${item.done ? 'is-checked' : ''}`}
                        onClick={() => toggleChecklistItem(index)}
                        aria-label={item.done ? 'Kijelölés megszüntetése' : 'Kijelölés'}
                      >
                        {item.done ? '✓' : ''}
                      </button>
                      <input
                        type="text"
                        value={item.text}
                        placeholder="Add an item"
                        onChange={(event) => updateChecklistItem(index, event.target.value)}
                      />
                      <button type="button" className="checklist-delete-item" onClick={() => removeChecklistItem(index)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" className="add-checklist-item-button" onClick={addChecklistItem}>
                  Add an item
                </button>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeModal}>
                  Mégse
                </button>
                <button type="submit" className="primary-button">
                  {modalState.mode === 'create' ? 'Hozzáadás' : 'Mentés'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
