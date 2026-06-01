import { createPortal } from 'react-dom'
import { useCallback, useEffect, useState } from 'react'
import { AdminPanelLoadingOverlay, adminPanelBodyClass } from './AdminPanelLoadingOverlay'
import { createUom, deleteUom, fetchUom, updateUom } from './api'
import { sortUomForSelect } from './uomSelectOrder'
import type { UnitOfMeasure } from './types'
import './AdminApp.css'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const UOM_LIST_COLUMNS = ['Код', 'Сокращение', 'Наименование'] as const

function dashIfEmpty(s: string | undefined | null) {
  const t = (s ?? '').trim()
  return t ? t : '—'
}

export function AdminUomPanel() {
  const [items, setItems] = useState<UnitOfMeasure[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<UnitOfMeasure | 'new' | null>(null)
  const [formName, setFormName] = useState('')
  const [formShortName, setFormShortName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formErr, setFormErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    setErr(null)
    return fetchUom()
      .then((r) => setItems(sortUomForSelect(r.results ?? [])))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const openNew = useCallback(() => {
    setEditing('new')
    setFormName('')
    setFormShortName('')
    setFormCode('')
    setFormErr(null)
    setDeleteOpen(false)
  }, [])

  const openEdit = useCallback((u: UnitOfMeasure) => {
    setEditing(u)
    setFormName(u.name ?? '')
    setFormShortName(u.short_name ?? '')
    setFormCode((u.code ?? '').trim())
    setFormErr(null)
    setDeleteOpen(false)
  }, [])

  const closeModal = useCallback(() => {
    if (saving || deleting) return
    setEditing(null)
    setFormErr(null)
    setDeleteOpen(false)
  }, [deleting, saving])

  const save = useCallback(async () => {
    const name = formName.trim()
    if (!name) {
      setFormErr('Укажите наименование.')
      return
    }
    const codeRaw = formCode.trim()
    if (!codeRaw) {
      setFormErr('Укажите код.')
      return
    }
    setSaving(true)
    setFormErr(null)
    try {
      const payload = {
        name,
        short_name: formShortName.trim(),
        code: codeRaw,
      }
      if (editing === 'new') {
        const created = await createUom(payload)
        setItems((prev) => sortUomForSelect([...prev, created]))
        setEditing(null)
      } else if (editing) {
        const updated = await updateUom(editing.id, payload)
        setItems((prev) => sortUomForSelect(prev.map((x) => (x.id === updated.id ? updated : x))))
        setEditing(null)
      }
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [editing, formCode, formName, formShortName])

  const confirmDelete = useCallback(async () => {
    if (editing == null || editing === 'new') return
    setDeleting(true)
    setFormErr(null)
    try {
      await deleteUom(editing.id)
      setItems((prev) => prev.filter((x) => x.id !== editing.id))
      setDeleteOpen(false)
      setEditing(null)
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }, [editing])

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || saving || deleting) return
      e.preventDefault()
      if (deleteOpen) {
        setDeleteOpen(false)
        return
      }
      closeModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeModal, deleteOpen, deleting, editing, saving])

  return (
    <>
      <div
        className={adminPanelBodyClass(loading)}
        id="admin-panel-uom"
        role="tabpanel"
        aria-labelledby="admin-tab-uom"
      >
        <AdminPanelLoadingOverlay active={loading} ariaLabel="Загрузка единиц измерения" />
        <div className="admin-main-col">
          <main className="admin-main">
            <div className="admin-main-scroll">
              {err ? <div className="admin-error">{err}</div> : null}
              <div className="admin-heading-row">
                <h2 className="admin-h2">Единицы измерения</h2>
              </div>
              <button type="button" className="admin-primary" disabled={loading || saving} onClick={openNew}>
                + Ед. изм.
              </button>
              {editing ? (
                <p className="admin-material-card-context" aria-live="polite">
                  {editing === 'new' ? 'Новая единица измерения' : formName.trim() || '—'}
                </p>
              ) : null}
              <div className="mat-list-table mat-list-table--uom" aria-label="Список единиц измерения">
                <div className="mat-list-item-inner mat-list-item-inner--legend" role="row">
                  <div className="mat-list-legend" role="presentation">
                    {UOM_LIST_COLUMNS.map((label) => (
                      <span key={label} role="columnheader">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <ul className="mat-list">
                  {!loading &&
                    items.map((u) => {
                      const rowActive = editing && editing !== 'new' && editing.id === u.id
                      return (
                        <li key={u.id} className="mat-list-item">
                          <div className="mat-list-item-inner">
                            <div
                              role="button"
                              tabIndex={0}
                              className={rowActive ? 'mat-list-row mat-list-row--active' : 'mat-list-row'}
                              aria-current={rowActive ? 'true' : undefined}
                              aria-label={`Редактировать: ${u.name}`}
                              onClick={() => openEdit(u)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  openEdit(u)
                                }
                              }}
                            >
                              <span className="mat-list-cell mat-list-cell-article">{dashIfEmpty(u.code)}</span>
                              <span className="mat-list-cell mat-list-cell-uom">{dashIfEmpty(u.short_name || u.name)}</span>
                              <span className="mat-list-cell mat-list-cell-name">{u.name}</span>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                </ul>
              </div>
              {!loading && items.length === 0 ? (
                <p className="admin-muted admin-calculations-classes-empty">Нет единиц измерения — нажмите «+ Ед. изм.».</p>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      {editing
        ? createPortal(
            <>
              <div
                className="admin-modal-backdrop"
                role="presentation"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !saving && !deleting && !deleteOpen) closeModal()
                }}
              >
                <section
                  className="admin-panel admin-panel--in-material-modal admin-calculations-modal-surface admin-modal--material-card admin-material-card-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="uom-card-dialog-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mat-form">
                    <div className="mat-form-head">
                      <div className="admin-heading-row mat-form-title-line">
                        <h3 id="uom-card-dialog-title" className="admin-h2">
                          {editing === 'new' ? 'Новая единица измерения' : 'Редактирование единицы измерения'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        className="admin-primary admin-modal-head-icon-close"
                        aria-label="Закрыть"
                        title="Закрыть"
                        disabled={saving || deleting}
                        onClick={closeModal}
                      >
                        {MODAL_CLOSE_X_SVG}
                      </button>
                    </div>
                    {formErr ? <div className="admin-error">{formErr}</div> : null}
                    <div className="mat-form-tab-panel" role="region" aria-label="Данные единицы измерения">
                      <label className="field mat-form-field-span-2">
                        <span>Наименование *</span>
                        <input
                          className="admin-input"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          autoFocus
                          disabled={saving || deleting}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void save()
                            }
                          }}
                        />
                      </label>
                      <label className="field mat-form-field-span-2">
                        <span>Сокращение</span>
                        <input
                          className="admin-input"
                          value={formShortName}
                          onChange={(e) => setFormShortName(e.target.value)}
                          disabled={saving || deleting}
                        />
                      </label>
                      <label className="field mat-form-field-span-2">
                        <span>Код *</span>
                        <input
                          className="admin-input"
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value)}
                          required
                          aria-required
                          disabled={saving || deleting}
                        />
                      </label>
                      <div className="admin-row mat-form-actions">
                        {editing !== 'new' ? (
                          <button
                            type="button"
                            className="admin-secondary admin-danger"
                            disabled={saving || deleting}
                            onClick={() => setDeleteOpen(true)}
                          >
                            Удалить
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="admin-primary"
                          disabled={saving || deleting}
                          onClick={() => void save()}
                        >
                          {saving ? 'Сохранение…' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              {deleteOpen && editing !== 'new' ? (
                <div
                  className="admin-modal-backdrop admin-modal-backdrop--stack-top"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="uom-delete-title"
                  onClick={(e) => {
                    if (e.target === e.currentTarget && !deleting) setDeleteOpen(false)
                  }}
                >
                  <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
                    <h4 id="uom-delete-title" className="admin-modal-title">
                      Удалить единицу измерения?
                    </h4>
                    <p className="admin-modal-text">
                      «{formName.trim() || '—'}» будет удалена. Материалы с этой единицей измерения нужно будет
                      переназначить вручную.
                    </p>
                    <div className="admin-modal-actions">
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={deleting}
                        onClick={() => setDeleteOpen(false)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className="admin-primary admin-modal-confirm"
                        disabled={deleting}
                        onClick={() => void confirmDelete()}
                      >
                        {deleting ? 'Удаление…' : 'Удалить'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>,
            document.body
          )
        : null}
    </>
  )
}
