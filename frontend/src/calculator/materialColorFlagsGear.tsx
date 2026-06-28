import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

export type ProfileColorFlags = { is_new: boolean; is_hit: boolean; is_sale: boolean }

export const PROFILE_FLAG_LABELS: Record<keyof ProfileColorFlags, string> = {
  is_new: 'Новинка',
  is_hit: 'Хит',
  is_sale: 'Акция',
}

const FLAG_KEYS: (keyof ProfileColorFlags)[] = ['is_new', 'is_hit', 'is_sale']

export type MaterialColorFlagsGearProps = {
  flags: ProfileColorFlags
  onToggleFlag: (flag: keyof ProfileColorFlags) => void
  open: boolean
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void
  onClose: () => void
  ariaLabel?: string
}

export function MaterialColorFlagsGear({
  flags,
  onToggleFlag,
  open,
  onToggle,
  onClose,
  ariaLabel = 'Метки материала',
}: MaterialColorFlagsGearProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const hasActiveFlags = flags.is_new || flags.is_hit || flags.is_sale

  const placeMenu = useCallback(() => {
    const btn = btnRef.current
    if (!btn || !open) {
      setMenuPos(null)
      return
    }
    const rect = btn.getBoundingClientRect()
    const popoverWidth = popoverRef.current?.offsetWidth ?? 160
    const popoverHeight = popoverRef.current?.offsetHeight ?? 120
    let left = Math.min(rect.right - popoverWidth, window.innerWidth - popoverWidth - 8)
    left = Math.max(8, left)
    let top = rect.bottom + 6
    if (top + popoverHeight > window.innerHeight - 8) {
      top = rect.top - popoverHeight - 6
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
      if (btnRef.current?.contains(target) || popoverRef.current?.contains(target)) return
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
      <button
        ref={btnRef}
        type="button"
        className={[
          'frame2-checkrow-gear-btn',
          hasActiveFlags ? 'frame2-checkrow-gear-btn--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        title="Метки: новинка, хит, акция"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="frame2-checkrow-gear-ico" aria-hidden>
          ⚙
        </span>
      </button>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className="frame2-flags-popover"
              role="group"
              aria-label="Метки материала"
              style={
                menuPos
                  ? { top: menuPos.top, left: menuPos.left }
                  : { visibility: 'hidden', top: 0, left: 0 }
              }
              onClick={(e) => e.stopPropagation()}
            >
              {FLAG_KEYS.map((key) => (
                <label key={key} className="frame2-flag">
                  <input
                    type="checkbox"
                    checked={flags[key]}
                    onChange={() => onToggleFlag(key)}
                  />{' '}
                  {PROFILE_FLAG_LABELS[key]}
                </label>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
