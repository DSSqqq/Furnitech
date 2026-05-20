import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

export type TileGearMenuProps = {
  open: boolean
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  ariaLabel: string
  gearTitle?: string
}

export function TileGearMenu({
  open,
  onToggle,
  onClose,
  onEdit,
  onDelete,
  ariaLabel,
  gearTitle = 'Действия',
}: TileGearMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const placeMenu = useCallback(() => {
    const btn = btnRef.current
    if (!btn || !open) {
      setMenuPos(null)
      return
    }
    const rect = btn.getBoundingClientRect()
    const menuWidth = menuRef.current?.offsetWidth ?? 160
    const menuHeight = menuRef.current?.offsetHeight ?? 68
    let left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
    left = Math.max(8, left)
    let top = rect.bottom + 6
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - 6
    }
    top = Math.max(8, top)
    setMenuPos({ top, left })
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    placeMenu()
    const id = requestAnimationFrame(placeMenu)
    return () => cancelAnimationFrame(id)
  }, [open, placeMenu])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', placeMenu)
    window.addEventListener('scroll', placeMenu, true)
    return () => {
      window.removeEventListener('resize', placeMenu)
      window.removeEventListener('scroll', placeMenu, true)
    }
  }, [open, placeMenu])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: globalThis.MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <>
      <div className="tile-gear-wrap">
        <div className="tree-line-actions tile-gear-menu-anchor">
          <button
            ref={btnRef}
            type="button"
            className="tree-gear-btn"
            title={gearTitle}
            aria-label={ariaLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={onToggle}
          >
            <span className="tree-gear-ico" aria-hidden>
              ⚙
            </span>
          </button>
        </div>
      </div>
      {open
        ? createPortal(
            <ul
              ref={menuRef}
              className="tree-gear-menu tree-gear-menu--portal"
              role="menu"
              style={
                menuPos
                  ? { top: menuPos.top, left: menuPos.left }
                  : { visibility: 'hidden', top: 0, left: 0 }
              }
            >
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="tree-gear-menu-item"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                >
                  Редактировать
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="tree-gear-menu-item tree-gear-menu-item--danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  Удалить
                </button>
              </li>
            </ul>,
            document.body,
          )
        : null}
    </>
  )
}
