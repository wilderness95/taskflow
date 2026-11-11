import { useState } from 'react'
import type { BoardView, Visibility } from './types'

// Átmeneti, csak kliensoldali állapot: az M1/M3 mérföldkőben a tábla adataival együtt a szerverre kerül.
export function useBoardMeta() {
  const [title, setTitle] = useState('Web App Fejlesztés (Csapat)')
  const [isStarred, setIsStarred] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('workspace')
  const [activeView, setActiveView] = useState<BoardView>('kanban')

  return {
    title,
    setTitle,
    isStarred,
    toggleStar: () => setIsStarred((current) => !current),
    visibility,
    setVisibility,
    activeView,
    setActiveView,
  }
}

export type BoardMeta = ReturnType<typeof useBoardMeta>
