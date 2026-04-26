import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './HintButton.css'

type Props = { text: string }

/** Круглая кнопка i: клик открывает/закрывает текст; клик снаружи и Escape — закрывают. */
export function HintButton({ text }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const syncPos = () => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const gap = 6
    setPos({
      top: Math.round(r.bottom + gap),
      left: Math.round(r.left),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    syncPos()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScroll = () => syncPos()
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <span className="hint-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="hint-btn"
        aria-label={text}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            id={panelId}
            className="hint-popover"
            role="region"
            aria-label="Подсказка"
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
          >
            {text}
          </div>,
          document.body
        )}
    </span>
  )
}
