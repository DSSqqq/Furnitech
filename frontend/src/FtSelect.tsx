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
    setMenuStyle({
      position: 'fixed',
      left,
      top,
      width,
      maxHeight: menuMaxH,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const handler = () => updatePosition()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [open, updatePosition])

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
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            className="ft-select-menu"
            style={menuStyle}
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
                      className={[
                        'ft-select-option',
                        isSelected ? 'ft-select-option--current' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
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
          </div>,
          document.body
        )}
    </div>
  )
}
