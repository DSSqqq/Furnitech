import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './AdminApp.css'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export type CalculatorTypeFormModalProps = {
  open: boolean
  title: string
  titleId: string
  onClose: () => void
  onSubmit: () => void
  submitLabel: string
  busy?: boolean
  error?: string | null
  children: ReactNode
}

export function CalculatorTypeFormModal({
  open,
  title,
  titleId,
  onClose,
  onSubmit,
  submitLabel,
  busy = false,
  error = null,
  children,
}: CalculatorTypeFormModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose, open])

  if (!open) return null

  return createPortal(
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog calculator-type-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mat-form">
          <div className="mat-form-head">
            <div className="admin-heading-row mat-form-title-line">
              <h3 id={titleId} className="admin-h2">
                {title}
              </h3>
            </div>
            <button
              type="button"
              className="admin-primary admin-modal-head-icon-close"
              aria-label="Закрыть"
              title="Закрыть"
              disabled={busy}
              onClick={onClose}
            >
              {MODAL_CLOSE_X_SVG}
            </button>
          </div>
          {error ? <div className="admin-error">{error}</div> : null}
          <div className="mat-form-tab-panel calculator-type-form-modal-body" role="region" aria-label={title}>
            {children}
            <div className="admin-row mat-form-actions">
              <button type="button" className="admin-secondary" disabled={busy} onClick={onClose}>
                Отмена
              </button>
              <button type="button" className="admin-primary" disabled={busy} onClick={onSubmit}>
                {busy ? 'Сохранение…' : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
