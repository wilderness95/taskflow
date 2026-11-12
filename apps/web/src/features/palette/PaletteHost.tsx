import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { CommandPalette } from './CommandPalette'

/** Ezt az eseményt a felületi elemek (pl. a felhasználói menü) küldik a paletta megnyitásához. */
export const OPEN_PALETTE_EVENT = 'taskflow:open-palette'

/** A védett oldalak burkolója: Ctrl/Cmd + K bárhol megnyitja a parancspalettát. */
export function PaletteHost() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsOpen((open) => !open)
      }
    }
    const onOpen = () => setIsOpen(true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [])

  return (
    <>
      <Outlet />
      {isOpen && <CommandPalette onClose={() => setIsOpen(false)} />}
    </>
  )
}
