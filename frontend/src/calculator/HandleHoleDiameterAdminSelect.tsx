import { useEffect, useId, useRef, useState } from 'react'
import {
  createCalculatorHandleHoleDiameter,
  deleteCalculatorHandleHoleDiameter,
  updateCalculatorHandleHoleDiameter,
} from '../api'
import type { CalculatorHandleHoleDiameter } from '../types'
import '../FtSelect.css'
import './HandleHoleDiameterAdminSelect.css'

export type HandleHoleDiameterAdminSelectProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  rows: CalculatorHandleHoleDiameter[]
  onRowsChange: (rows: CalculatorHandleHoleDiameter[]) => void
  adminError: string | null
  onAdminError: (msg: string | null) => void
  'aria-label'?: string
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

export function HandleHoleDiameterAdminSelect({
  id: idProp,
  value,
  onChange,
  rows,
  onRowsChange,
  adminError,
  onAdminError,
  'aria-label': ariaLabel,
}: HandleHoleDiameterAdminSelectProps) {
  const uid = useId()
  const baseId = idProp ?? `ft-select-${uid.replace(/:/g, '')}`
  const listboxId = `${baseId}-listbox`

  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [addMm, setAddMm] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  const selected = rows.find((r) => String(r.diameter_mm) === value)
  const displayLabel = selected ? `${selected.diameter_mm} мм` : '—'

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

  const handleToggleClient = (row: CalculatorHandleHoleDiameter, client_visible: boolean) => {
    onAdminError(null)
    updateCalculatorHandleHoleDiameter(row.id, { client_visible })
      .then((updated) => {
        onRowsChange(rows.map((x) => (x.id === row.id ? updated : x)))
      })
      .catch((ex) => onAdminError(String(ex)))
  }

  const handleDelete = (row: CalculatorHandleHoleDiameter) => {
    if (
      !window.confirm(
        `Удалить размер ${row.diameter_mm} мм? Вы уверены?`,
      )
    ) {
      return
    }
    onAdminError(null)
    deleteCalculatorHandleHoleDiameter(row.id)
      .then(() => {
        const next = rows.filter((x) => x.id !== row.id)
        onRowsChange(next)
        if (String(row.diameter_mm) === value) {
          const fallback = next[0]?.diameter_mm
          onChange(fallback != null ? String(fallback) : '')
        }
      })
      .catch((ex) => onAdminError(String(ex)))
  }

  const handleAdd = () => {
    const raw = addMm.trim().replace(',', '.')
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) {
      onAdminError('Введите диаметр в миллиметрах (целое число > 0).')
      return
    }
    const diameter_mm = clampInt(n, 1, 999)
    if (rows.some((r) => r.diameter_mm === diameter_mm)) {
      onAdminError(`Размер ${diameter_mm} мм уже есть в списке.`)
      return
    }
    const sort_order =
      rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1
    onAdminError(null)
    setAddBusy(true)
    createCalculatorHandleHoleDiameter({
      diameter_mm,
      client_visible: true,
      sort_order,
    })
      .then((created) => {
        const next = [...rows, created].sort(
          (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.diameter_mm - b.diameter_mm,
        )
        onRowsChange(next)
        setAddMm('')
        pick(String(created.diameter_mm))
      })
      .catch((ex) => onAdminError(String(ex)))
      .finally(() => setAddBusy(false))
  }

  const rootClass = 'ft-select'

  const menu = open ? (
    <div
      ref={menuRef}
      id={listboxId}
      className="ft-select-menu ft-select-menu--inline step7-dia-admin-menu"
      role="listbox"
      aria-label="Диаметры и настройки для клиента"
    >
      <div className="step7-dia-admin-menu-scroll">
        {rows.length === 0 ? (
          <div className="step7-dia-admin-empty">Пока нет размеров — добавьте ниже.</div>
        ) : (
          rows.map((row) => {
            const isSelected = String(row.diameter_mm) === value
            return (
              <div
                key={row.id}
                className={['step7-dia-row', isSelected ? 'step7-dia-row--current' : ''].filter(Boolean).join(' ')}
                role="presentation"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className="step7-dia-row__pick"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(String(row.diameter_mm))
                  }}
                >
                  {row.diameter_mm} мм
                </button>
                <button
                  type="button"
                  className={[
                    'step7-dia-row__vis',
                    row.client_visible ? 'step7-dia-row__vis--on' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={row.client_visible}
                  title={
                    row.client_visible
                      ? 'Видимость для клиента включена'
                      : 'Видимость для клиента выключена'
                  }
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleToggleClient(row, !row.client_visible)
                  }}
                >
                  Видимость
                </button>
                <button
                  type="button"
                  className="step7-dia-row__del"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDelete(row)
                  }}
                >
                  Удалить
                </button>
              </div>
            )
          })
        )}
      </div>
      <div className="step7-dia-admin-add" onMouseDown={(e) => e.stopPropagation()}>
        <div className="step7-dia-admin-add__label">Добавить размер</div>
        <div className="step7-dia-admin-add__row">
          <input
            className="admin-input step7-dia-admin-add__input"
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
            placeholder="мм"
            value={addMm}
            disabled={addBusy}
            onChange={(e) => setAddMm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <button
            type="button"
            className="admin-secondary step7-dia-admin-add__btn"
            disabled={addBusy}
            onClick={() => handleAdd()}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className={rootClass}>
      <button
        ref={btnRef}
        type="button"
        className={`ft-select-trigger${open ? ' ft-select-trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ft-select-value">{displayLabel}</span>
        <span className="ft-select-chevron" aria-hidden />
      </button>
      {menu}
      {adminError ? (
        <p className="admin-error step7-dia-admin-err" style={{ margin: '0.35rem 0 0' }}>
          {adminError}
        </p>
      ) : null}
    </div>
  )
}
