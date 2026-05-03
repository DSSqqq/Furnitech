import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import './FtSelect.css'

export type FtSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

function collectScrollParents(el: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = []
  let node: HTMLElement | null = el?.parentElement ?? null
  while (node) {
    const st = window.getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(st.overflowY) || /(auto|scroll|overlay)/.test(st.overflowX)) {
      out.push(node)
    }
    node = node.parentElement
  }
  return out
}

export type FtSelectProps = {
  value: string
  onChange: (value: string) => void | Promise<void>
  options: FtSelectOption[]
  disabled?: boolean
  placeholder?: string
  className?: string
  compact?: boolean
  id?: string
  'aria-label'?: string
  title?: string
  /**
   * `portal` (по умолчанию) — список в `document.body`, `position: fixed` (не обрезается родителем).
   * `inline` — список под триггером в разметке (`absolute`), обрезается при `overflow` у предков
   * (например `.calc-side-panel` на шаге калькулятора).
   */
  menuStrategy?: 'portal' | 'inline'
}

export function FtSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = '—',
  className = '',
  compact = false,
  id: idProp,
  'aria-label': ariaLabel,
  title,
  menuStrategy = 'portal',
}: FtSelectProps) {
  const uid = useId()
  const baseId = idProp ?? `ft-select-${uid.replace(/:/g, '')}`
  const listboxId = `${baseId}-listbox`

  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder

  const updatePosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const menuMaxH = 280
    let top = r.bottom + 4
    let left = r.left
    const width = Math.max(r.width, 160)
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8)
    if (top + menuMaxH > vh - 8) {
      const above = r.top - 4 - menuMaxH
      if (above >= 8) top = above
    }
    const leftR = Math.round(left)
    const topR = Math.round(top)
    const widthR = Math.round(width)
    setMenuStyle((prev) => {
      const next: CSSProperties = {
        position: 'fixed',
        left: leftR,
        top: topR,
        width: widthR,
        maxHeight: menuMaxH,
      }
      if (
        prev.position === next.position &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.maxHeight === next.maxHeight
      ) {
        return prev
      }
      return next
    })
  }, [])

  useLayoutEffect(() => {
    if (!open || menuStrategy === 'inline') return
    updatePosition()
    let raf = 0
    const tick = () => {
      updatePosition()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onResize = () => updatePosition()
    window.addEventListener('resize', onResize)
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    const scrollParents = collectScrollParents(btnRef.current)
    for (const p of scrollParents) {
      p.addEventListener('scroll', onScroll, { passive: true })
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (vv) {
      vv.addEventListener('scroll', onScroll)
      vv.addEventListener('resize', onResize)
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      for (const p of scrollParents) {
        p.removeEventListener('scroll', onScroll)
      }
      if (vv) {
        vv.removeEventListener('scroll', onScroll)
        vv.removeEventListener('resize', onResize)
      }
    }
  }, [open, menuStrategy, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (v: string) => {
    void Promise.resolve(onChange(v))
    setOpen(false)
  }

  const rootClass = ['ft-select', compact && 'ft-select--compact', className]
    .filter(Boolean)
    .join(' ')

  const menu = open ? (
    <div
      ref={menuRef}
      id={listboxId}
      className={['ft-select-menu', menuStrategy === 'inline' ? 'ft-select-menu--inline' : '']
        .filter(Boolean)
        .join(' ')}
      style={menuStrategy === 'portal' ? menuStyle : undefined}
      role="listbox"
    >
      <ul className="ft-select-options" role="presentation">
        {options.map((opt) => {
          const isSelected = opt.value === value
          const isDisabled = opt.disabled === true
          const key = opt.value === '' ? `${baseId}-empty` : opt.value
          return (
            <li key={key} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                className={['ft-select-option', isSelected ? 'ft-select-option--current' : ''].filter(Boolean).join(' ')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (!isDisabled) pick(opt.value)
                }}
              >
                {opt.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  ) : null

  return (
    <div className={rootClass}>
      <button
        ref={btnRef}
        type="button"
        className={`ft-select-trigger${open ? ' ft-select-trigger--open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        title={title}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="ft-select-value">{displayLabel}</span>
        <span className="ft-select-chevron" aria-hidden />
      </button>
      {menuStrategy === 'inline' ? menu : menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
