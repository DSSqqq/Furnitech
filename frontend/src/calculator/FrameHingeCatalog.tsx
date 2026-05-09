import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCalculatorHingeType,
  deleteCalculatorHingeType,
  fetchCalculatorHingeTypes,
  fetchMaterial,
  searchMaterials,
  updateCalculatorHingeType,
} from '../api'
import type { CalculatorHingeType, Material } from '../types'
import { HintButton } from '../HintButton'
import {
  CALC_LS_HINGE_MATERIAL_ID,
  CALC_LS_HINGE_TYPE_ID,
  notifyFrameCalcSession,
} from './frameCalcSession'
import { MaterialCheckSwatch } from './MaterialCheckSwatch'
import { resolveMediaUrl } from './sketchFrame'
import './Step2FrameFacade.css'

function matLabel(m: { name: string; article?: string | null }) {
  const a = (m.article ?? '').trim()
  return a ? `${m.name} (${a})` : m.name
}

function textureThumb(m: { texture_image?: string | null; texture_color?: string; name: string }) {
  const img = resolveMediaUrl(m.texture_image ?? '')
  const color = (m.texture_color ?? '').trim()
  if (img) {
    return (
      <div className="tile-thumb tile-thumb--color">
        <img className="tile-thumb-img" src={img} alt={m.name} />
      </div>
    )
  }
  return <div className="tile-thumb" style={color ? { backgroundColor: color } : undefined} />
}

function typeThumb(t: { name: string; image_url?: string; card_image?: string | null }) {
  const raw = ((t.card_image ?? '') || (t.image_url ?? '')).trim()
  const img = resolveMediaUrl(raw)
  if (img) {
    return (
      <div className="tile-thumb tile-thumb--profile-type">
        <img className="tile-thumb-img" src={img} alt={t.name} />
      </div>
    )
  }
  return <div className="tile-thumb tile-thumb--profile-type" />
}

export type FrameHingeCatalogProps = {
  readOnly: boolean
}

/** Каталог типов петель и материалов (как типы наполнения на шаге 4). */
export function FrameHingeCatalog({ readOnly }: FrameHingeCatalogProps) {
  const [hingeTypes, setHingeTypes] = useState<CalculatorHingeType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null)
  const [modalTypeId, setModalTypeId] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createImageFile, setCreateImageFile] = useState<File | null>(null)
  const cardImageInputRef = useRef<HTMLInputElement>(null)
  const [createMatQ, setCreateMatQ] = useState('')
  const [createMatHit, setCreateMatHit] = useState<Material[]>([])
  const [createMatPicking, setCreateMatPicking] = useState(false)
  const [createMatIds, setCreateMatIds] = useState<Record<number, true>>({})

  const [editHingeId, setEditHingeId] = useState<number | null>(null)
  const [editHingeName, setEditHingeName] = useState('')
  const [editHingeImageFile, setEditHingeImageFile] = useState<File | null>(null)
  const editHingeImageRef = useRef<HTMLInputElement>(null)
  const [editHingeMatQ, setEditHingeMatQ] = useState('')
  const [editHingeMatHit, setEditHingeMatHit] = useState<Material[]>([])
  const [editHingeMatPicking, setEditHingeMatPicking] = useState(false)
  const [editHingeMatIds, setEditHingeMatIds] = useState<Record<number, true>>({})

  const [modalSaving, setModalSaving] = useState(false)

  const [texByMaterialId, setTexByMaterialId] = useState<
    Record<number, { texture_color?: string; texture_image?: string | null; name?: string }>
  >({})

  const reload = useCallback(() => {
    setErr(null)
    setLoading(true)
    fetchCalculatorHingeTypes()
      .then((r) => {
        const rows = (r.results ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        setHingeTypes(rows)
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    try {
      const t = localStorage.getItem(CALC_LS_HINGE_TYPE_ID)
      const m = localStorage.getItem(CALC_LS_HINGE_MATERIAL_ID)
      if (t) setSelectedTypeId(Number(t))
      if (m) setSelectedMaterialId(Number(m))
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      if (selectedTypeId != null && selectedMaterialId != null) {
        localStorage.setItem(CALC_LS_HINGE_TYPE_ID, String(selectedTypeId))
        localStorage.setItem(CALC_LS_HINGE_MATERIAL_ID, String(selectedMaterialId))
      } else {
        localStorage.removeItem(CALC_LS_HINGE_TYPE_ID)
        localStorage.removeItem(CALC_LS_HINGE_MATERIAL_ID)
      }
    } catch {
      /* ignore */
    }
    notifyFrameCalcSession()
  }, [hydrated, selectedTypeId, selectedMaterialId])

  useEffect(() => {
    if (!hydrated || loading) return
    if (selectedTypeId != null && !hingeTypes.some((x) => x.id === selectedTypeId)) {
      setSelectedTypeId(null)
    }
    if (modalTypeId != null && !hingeTypes.some((x) => x.id === modalTypeId)) {
      setModalTypeId(null)
    }
  }, [hydrated, loading, modalTypeId, hingeTypes, selectedTypeId])

  useEffect(() => {
    if (!hydrated) return
    if (selectedTypeId == null) {
      setSelectedMaterialId(null)
      return
    }
    if (loading) return
    const t = hingeTypes.find((x) => x.id === selectedTypeId) ?? null
    if (!t) {
      setSelectedMaterialId(null)
      return
    }
    const mats = t.materials ?? []
    if (selectedMaterialId != null && mats.some((c) => c.material_id === selectedMaterialId)) return
    setSelectedMaterialId(mats[0]?.material_id ?? null)
  }, [hydrated, loading, selectedTypeId, hingeTypes, selectedMaterialId])

  useEffect(() => {
    if (!createOpen) return
    const q = createMatQ.trim()
    const id = window.setTimeout(() => {
      if (!q) {
        setCreateMatHit([])
        return
      }
      setCreateMatPicking(true)
      searchMaterials(q)
        .then((r) => setCreateMatHit(r.results ?? []))
        .catch(() => setCreateMatHit([]))
        .finally(() => setCreateMatPicking(false))
    }, 250)
    return () => clearTimeout(id)
  }, [createMatQ, createOpen])

  useEffect(() => {
    if (editHingeId == null) return
    const q = editHingeMatQ.trim()
    const id = window.setTimeout(() => {
      if (!q) {
        setEditHingeMatHit([])
        return
      }
      setEditHingeMatPicking(true)
      searchMaterials(q)
        .then((r) => setEditHingeMatHit(r.results ?? []))
        .catch(() => setEditHingeMatHit([]))
        .finally(() => setEditHingeMatPicking(false))
    }, 250)
    return () => clearTimeout(id)
  }, [editHingeMatQ, editHingeId])

  const createImagePreview = useMemo(() => {
    if (!createImageFile) return ''
    return URL.createObjectURL(createImageFile)
  }, [createImageFile])

  useEffect(() => {
    return () => {
      if (createImagePreview) URL.revokeObjectURL(createImagePreview)
    }
  }, [createImagePreview])

  const editHingeImagePreview = useMemo(() => {
    if (!editHingeImageFile) return ''
    return URL.createObjectURL(editHingeImageFile)
  }, [editHingeImageFile])

  useEffect(() => {
    return () => {
      if (editHingeImagePreview) URL.revokeObjectURL(editHingeImagePreview)
    }
  }, [editHingeImagePreview])

  const editingHinge = useMemo(
    () => (editHingeId != null ? hingeTypes.find((p) => p.id === editHingeId) ?? null : null),
    [editHingeId, hingeTypes]
  )

  const editHingeExistingCardUrl = useMemo(() => {
    if (!editingHinge) return ''
    return resolveMediaUrl(((editingHinge.card_image ?? '') || (editingHinge.image_url ?? '')).trim())
  }, [editingHinge])

  const closeEditHinge = () => {
    setEditHingeId(null)
    setEditHingeName('')
    setEditHingeImageFile(null)
    if (editHingeImageRef.current) editHingeImageRef.current.value = ''
    setEditHingeMatIds({})
    setEditHingeMatQ('')
    setEditHingeMatHit([])
  }

  const openEditHinge = (t: CalculatorHingeType) => {
    setCreateOpen(false)
    setErr(null)
    setEditHingeId(t.id)
    setEditHingeName(t.name)
    setEditHingeImageFile(null)
    if (editHingeImageRef.current) editHingeImageRef.current.value = ''
    const ids: Record<number, true> = {}
    for (const m of t.materials ?? []) ids[m.material_id] = true
    setEditHingeMatIds(ids)
    setEditHingeMatQ('')
    setEditHingeMatHit([])
  }

  const submitEditHinge = async () => {
    const t = editingHinge
    if (!t || editHingeId == null) return
    const name = editHingeName.trim()
    if (!name) {
      setErr('Укажите название типа петель.')
      return
    }
    setErr(null)
    try {
      const materials = Object.keys(editHingeMatIds).map((id) => ({ material_id: Number(id) }))
      let updated: CalculatorHingeType
      if (editHingeImageFile) {
        const fd = new FormData()
        fd.append('name', name)
        fd.append('is_active', String(t.is_active))
        fd.append('sort_order', String(t.sort_order))
        fd.append('materials', JSON.stringify(materials))
        fd.append('card_image', editHingeImageFile)
        updated = await updateCalculatorHingeType(editHingeId, fd)
      } else {
        updated = await updateCalculatorHingeType(editHingeId, {
          name,
          is_active: t.is_active,
          sort_order: t.sort_order,
          materials,
        })
      }
      setHingeTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      closeEditHinge()
    } catch (e) {
      setErr(String(e))
    }
  }

  const submitCreate = async () => {
    const name = createName.trim()
    if (!name) {
      setErr('Укажите название типа петель.')
      return
    }
    setErr(null)
    try {
      const materials = Object.keys(createMatIds).map((id) => ({ material_id: Number(id) }))
      const fd = new FormData()
      fd.append('name', name)
      fd.append('is_active', 'true')
      fd.append('sort_order', String(hingeTypes.length))
      fd.append('materials', JSON.stringify(materials))
      if (createImageFile) fd.append('card_image', createImageFile)
      const created = await createCalculatorHingeType(fd)
      setHingeTypes((prev) => [...prev, created])
      setSelectedTypeId(created.id)
      setCreateOpen(false)
      setCreateName('')
      setCreateImageFile(null)
      if (cardImageInputRef.current) cardImageInputRef.current.value = ''
      setCreateMatQ('')
      setCreateMatHit([])
      setCreateMatIds({})
    } catch (e) {
      setErr(String(e))
    }
  }

  const deleteSelectedType = () => {
    const selected = hingeTypes.find((p) => p.id === selectedTypeId) ?? null
    if (!selected) return
    if (!window.confirm('Удалить тип петель?')) return
    setErr(null)
    deleteCalculatorHingeType(selected.id)
      .then(() => {
        setHingeTypes((prev) => prev.filter((p) => p.id !== selected.id))
        setSelectedTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setModalTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setEditHingeId((prev) => (prev === selected.id ? null : prev))
      })
      .catch((e) => setErr(String(e)))
  }

  useEffect(() => {
    if (editHingeId == null) return
    if (!hingeTypes.some((p) => p.id === editHingeId)) {
      setEditHingeId(null)
      setEditHingeName('')
      setEditHingeImageFile(null)
      if (editHingeImageRef.current) editHingeImageRef.current.value = ''
      setEditHingeMatIds({})
      setEditHingeMatQ('')
      setEditHingeMatHit([])
    }
  }, [editHingeId, hingeTypes])

  const selectedType = useMemo(
    () => hingeTypes.find((p) => p.id === selectedTypeId) ?? null,
    [hingeTypes, selectedTypeId]
  )

  const modalType = useMemo(
    () => hingeTypes.find((p) => p.id === modalTypeId) ?? null,
    [hingeTypes, modalTypeId]
  )

  useEffect(() => {
    const ids = new Set<number>()
    for (const c of modalType?.materials ?? []) {
      const cm = c.material as any
      const has = (cm?.texture_color ?? '').trim() || (cm?.texture_image ?? '')
      if (!has) ids.add(c.material_id)
    }
    for (const m of [...createMatHit, ...editHingeMatHit]) {
      const has = (m.texture_image ?? '').trim() || (m.texture_color ?? '').trim()
      if (!has) ids.add(m.id)
    }
    if (ids.size === 0) return
    const missing = [...ids].filter((id) => texByMaterialId[id] == null)
    if (missing.length === 0) return
    Promise.all(missing.map((id) => fetchMaterial(id).then((m) => ({ id, m })).catch(() => null))).then((rows) => {
      setTexByMaterialId((prev) => {
        const next = { ...prev }
        for (const r of rows) {
          if (!r) continue
          next[r.id] = {
            texture_color: (r.m as any).texture_color,
            texture_image: (r.m as any).texture_image,
            name: r.m.name,
          }
        }
        return next
      })
    })
  }, [modalType, createMatHit, editHingeMatHit, texByMaterialId])

  const patchModalMaterials = async (rows: { material_id: number }[]) => {
    if (!modalType) return
    setModalSaving(true)
    setErr(null)
    try {
      const updated = await updateCalculatorHingeType(modalType.id, { materials: rows })
      setHingeTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e) {
      setErr(String(e))
    } finally {
      setModalSaving(false)
    }
  }

  const removeModalMaterial = async (materialId: number) => {
    if (!modalType) return
    const rows = (modalType.materials ?? [])
      .filter((m) => m.material_id !== materialId)
      .map((m) => ({ material_id: m.material_id }))
    await patchModalMaterials(rows)
    if (selectedMaterialId === materialId) {
      setSelectedMaterialId(rows[0]?.material_id ?? null)
    }
  }

  return (
    <>
      {err && <div className="admin-error">{err}</div>}
      {loading && <p className="admin-muted">Загрузка…</p>}

      <div className="frame2-card-head">
        <h4 className="frame2-h4">Типы петель</h4>
        {!readOnly && (
          <div className="frame2-actions">
            <button
              type="button"
              className="admin-primary"
              onClick={() => {
                setErr(null)
                setCreateOpen((was) => {
                  if (!was) closeEditHinge()
                  return !was
                })
              }}
            >
              + Добавить тип петель
            </button>
            <button
              type="button"
              className="admin-secondary"
              disabled={!selectedType}
              onClick={deleteSelectedType}
              title={!selectedType ? 'Выберите тип' : undefined}
            >
              Удалить тип
            </button>
          </div>
        )}
      </div>

      {!readOnly && createOpen && (
        <div className="frame2-create">
          <div className="frame2-create-head">
            <div className="frame2-create-title">Создание типа петель</div>
            <div className="frame2-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => {
                  setCreateOpen(false)
                  setCreateName('')
                  setCreateImageFile(null)
                  if (cardImageInputRef.current) cardImageInputRef.current.value = ''
                  setCreateMatQ('')
                  setCreateMatHit([])
                  setCreateMatIds({})
                }}
              >
                Отмена
              </button>
              <button type="button" className="admin-primary" onClick={() => void submitCreate()}>
                Создать
              </button>
            </div>
          </div>
          <div className="frame2-create-grid frame2-create-grid--file-status-pair">
            <div className="frame2-block frame2-create-tl">
              <div className="frame2-block-title">Тип петель</div>
              <input
                className="admin-input"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Например: Петля 110°, накладная…"
              />
              <div className="frame2-file-row">
                <div className="frame2-file-label-row">
                  <label className="frame2-file-label" htmlFor="hinge-type-card-image">
                    Изображение для карточки
                  </label>
                  <HintButton text="Выберите изображение с компьютера. Поддерживаются PNG/JPG/WebP и т.п." />
                </div>
                <input
                  id="hinge-type-card-image"
                  ref={cardImageInputRef}
                  className="frame2-file-input frame2-file-input--sr"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCreateImageFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="frame2-block frame2-create-tr">
              <div className="frame2-block-title">Материалы (петли)</div>
              <input
                className="admin-input"
                value={createMatQ}
                onChange={(e) => setCreateMatQ(e.target.value)}
                placeholder="Поиск материалов…"
              />
              {createMatPicking && <p className="admin-muted">Поиск…</p>}
            </div>
            <div className="frame2-create-ml">
              <div className="frame2-file-picker-row frame2-file-picker-row--solo">
                <button
                  type="button"
                  className="admin-secondary frame2-file-btn"
                  onClick={() => cardImageInputRef.current?.click()}
                >
                  {createImageFile ? 'Изменить файл…' : 'Выбрать файл…'}
                </button>
              </div>
            </div>
            <div className="frame2-create-mr">
              <div
                className={[
                  'frame2-file-name',
                  createImageFile ? '' : 'frame2-file-name--empty',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-live="polite"
              >
                {createImageFile ? createImageFile.name : 'Файл не выбран'}
              </div>
            </div>
            <div className="frame2-create-bl">
              {createImagePreview && (
                <div className="frame2-file-preview frame2-file-preview--cover">
                  <img src={createImagePreview} alt="" />
                </div>
              )}
            </div>
            <div className="frame2-create-br">
              {createMatHit.length > 0 && (
                <ul className="frame2-checklist">
                  {createMatHit.map((m) => (
                    <li key={m.id}>
                      <label
                        className={['frame2-checkrow', createMatIds[m.id] ? 'frame2-checkrow--checked' : '']
                          .filter(Boolean)
                          .join(' ')}
                        title={matLabel(m)}
                      >
                        <input
                          type="checkbox"
                          checked={createMatIds[m.id] === true}
                          onChange={() =>
                            setCreateMatIds((prev) => {
                              const next = { ...prev }
                              if (next[m.id]) delete next[m.id]
                              else next[m.id] = true
                              return next
                            })
                          }
                        />
                        <span className="frame2-check-article">{m.article || '—'}</span>
                        <MaterialCheckSwatch name={m.name} material={m} texExtra={texByMaterialId[m.id]} />
                        <span className="frame2-check-name-wrap">
                          <span className="frame2-check-name">{m.name}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {Object.keys(createMatIds).length > 0 && (
                <div className="admin-muted">Выбрано материалов: {Object.keys(createMatIds).length}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {!readOnly && editHingeId != null && editingHinge && (
        <div className="frame2-create">
          <div className="frame2-create-head">
            <div className="frame2-create-title">Редактирование типа петель</div>
            <div className="frame2-actions">
              <button type="button" className="admin-secondary" onClick={closeEditHinge}>
                Отмена
              </button>
              <button type="button" className="admin-primary" onClick={() => void submitEditHinge()}>
                Сохранить
              </button>
            </div>
          </div>
          <div className="frame2-create-grid frame2-create-grid--file-status-pair">
            <div className="frame2-block frame2-create-tl">
              <div className="frame2-block-title">Тип петель</div>
              <input
                className="admin-input"
                value={editHingeName}
                onChange={(e) => setEditHingeName(e.target.value)}
                placeholder="Название…"
              />
              <div className="frame2-file-row">
                <div className="frame2-file-label-row">
                  <label className="frame2-file-label" htmlFor="hinge-type-card-image-edit">
                    Новое изображение (необязательно)
                  </label>
                  <HintButton text="Оставьте пустым, чтобы сохранить текущую картинку." />
                </div>
                <input
                  id="hinge-type-card-image-edit"
                  ref={editHingeImageRef}
                  className="frame2-file-input frame2-file-input--sr"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditHingeImageFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="frame2-block frame2-create-tr">
              <div className="frame2-block-title">Материалы</div>
              <input
                className="admin-input"
                value={editHingeMatQ}
                onChange={(e) => setEditHingeMatQ(e.target.value)}
                placeholder="Поиск материалов…"
              />
              {editHingeMatPicking && <p className="admin-muted">Поиск…</p>}
            </div>
            <div className="frame2-create-ml">
              <div className="frame2-file-picker-row frame2-file-picker-row--solo">
                <button
                  type="button"
                  className="admin-secondary frame2-file-btn"
                  onClick={() => editHingeImageRef.current?.click()}
                >
                  {editHingeImageFile ? 'Изменить файл…' : 'Выбрать файл…'}
                </button>
              </div>
            </div>
            <div className="frame2-create-mr">
              <div
                className={[
                  'frame2-file-name',
                  editHingeImageFile ? '' : 'frame2-file-name--empty',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-live="polite"
              >
                {editHingeImageFile ? editHingeImageFile.name : 'Файл не выбран'}
              </div>
            </div>
            <div className="frame2-create-bl">
              {(editHingeImagePreview || editHingeExistingCardUrl) && (
                <div className="frame2-file-preview frame2-file-preview--cover">
                  <img src={editHingeImagePreview || editHingeExistingCardUrl} alt="" />
                </div>
              )}
            </div>
            <div className="frame2-create-br">
              {editHingeMatHit.length > 0 && (
                <ul className="frame2-checklist">
                  {editHingeMatHit.map((m) => (
                    <li key={m.id}>
                      <label
                        className={['frame2-checkrow', editHingeMatIds[m.id] ? 'frame2-checkrow--checked' : '']
                          .filter(Boolean)
                          .join(' ')}
                        title={matLabel(m)}
                      >
                        <input
                          type="checkbox"
                          checked={editHingeMatIds[m.id] === true}
                          onChange={() =>
                            setEditHingeMatIds((prev) => {
                              const next = { ...prev }
                              if (next[m.id]) delete next[m.id]
                              else next[m.id] = true
                              return next
                            })
                          }
                        />
                        <span className="frame2-check-article">{m.article || '—'}</span>
                        <MaterialCheckSwatch name={m.name} material={m} texExtra={texByMaterialId[m.id]} />
                        <span className="frame2-check-name-wrap">
                          <span className="frame2-check-name">{m.name}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {Object.keys(editHingeMatIds).length > 0 && (
                <div className="admin-muted">Выбрано материалов: {Object.keys(editHingeMatIds).length}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="tiles" aria-label="Типы петель">
        {hingeTypes.length === 0 && !loading && <p className="admin-muted">Типов петель пока нет.</p>}
        {hingeTypes.map((t) => {
          const title = t.name || `Тип #${t.id}`
          const active = t.id === selectedTypeId
          return (
            <div key={t.id} className="tile-cell">
              <button
                type="button"
                className={active ? 'tile tile--active' : 'tile'}
                onClick={() => {
                  setSelectedTypeId(t.id)
                  setModalTypeId(t.id)
                }}
                title={title}
              >
                {typeThumb({ name: title, image_url: t.image_url, card_image: t.card_image })}
                <div className="tile-title">{title}</div>
                <div className="tile-sub">Материалов: {(t.materials ?? []).length}</div>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="tile-gear"
                  title="Редактировать тип"
                  aria-label={`Редактировать тип «${title}»`}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openEditHinge(t)
                  }}
                >
                  <span className="tile-gear-ico" aria-hidden>
                    ⚙
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {modalType && (
        <div
          className="frame2-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Материалы петель"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalTypeId(null)
          }}
        >
          <div className="frame2-modal frame2-modal--wide" role="document" onClick={(e) => e.stopPropagation()}>
            <div className="frame2-modal-head">
              <div className="frame2-modal-title">{modalType.name || `Тип #${modalType.id}`}</div>
              <button type="button" className="admin-secondary" onClick={() => setModalTypeId(null)}>
                Закрыть
              </button>
            </div>

            <p className="admin-muted frame2-modal-hint">
              {readOnly
                ? 'Выберите петлю для расчёта.'
                : 'Выберите материал. Состав типа меняется в форме «Редактировать тип» (⚙ на карточке).'}
            </p>

            <div className="tiles tiles--colors">
              {(modalType.materials ?? []).map((c) => {
                const active = c.material_id === selectedMaterialId
                return (
                  <div key={c.id} className="tile-cell">
                    <button
                      type="button"
                      className={active ? 'tile tile--active tile--fill' : 'tile tile--fill'}
                      onClick={() => {
                        setSelectedMaterialId(c.material_id)
                        setSelectedTypeId(modalType.id)
                        setModalTypeId(null)
                      }}
                      title={matLabel(c.material)}
                    >
                      {textureThumb({
                        texture_image:
                          (c.material as any).texture_image ??
                          texByMaterialId[c.material_id]?.texture_image ??
                          null,
                        texture_color:
                          (c.material as any).texture_color ??
                          texByMaterialId[c.material_id]?.texture_color ??
                          '',
                        name: c.material.name,
                      })}
                      <div className="tile-title">{c.material.name}</div>
                      <div className="tile-sub">{c.material.article || '—'}</div>
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className="tile-action-remove"
                        title="Убрать материал из типа"
                        disabled={modalSaving}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!window.confirm('Убрать этот материал из типа петель?')) return
                          void removeModalMaterial(c.material_id)
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {(modalType.materials ?? []).length === 0 && (
              <div className="admin-muted">
                {readOnly
                  ? 'Для этого типа материалы ещё не настроены.'
                  : 'Материалы не добавлены — укажите их при создании типа или в «Редактировать тип» (⚙).'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
