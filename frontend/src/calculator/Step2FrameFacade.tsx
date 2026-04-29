import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createCalculatorProfileType,
  deleteCalculatorProfileType,
  fetchCalculatorProfileTypes,
  fetchMaterial,
  searchMaterials,
  updateCalculatorProfileType,
} from '../api'
import type { CalculatorProfileType, Material } from '../types'
import { HintButton } from '../HintButton'
import { useCalcPaths } from './calcPathsContext'
import { notifyFrameCalcSession } from './frameCalcSession'
import { MaterialCheckSwatch } from './MaterialCheckSwatch'
import { resolveMediaUrl, materialTextureLayerStyle } from './sketchFrame'
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

type ColorFlags = { is_new: boolean; is_hit: boolean; is_sale: boolean }

export function Step2FrameFacade() {
  const nav = useNavigate()
  const { readOnly, step } = useCalcPaths()
  const [profileTypes, setProfileTypes] = useState<CalculatorProfileType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [modalTypeId, setModalTypeId] = useState<number | null>(null)
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [removeColorConfirm, setRemoveColorConfirm] = useState<null | { id: number; name: string }>(null)
  const [texByMaterialId, setTexByMaterialId] = useState<
    Record<number, { texture_color?: string; texture_image?: string | null; name?: string }>
  >({})

  const [createOpen, setCreateOpen] = useState(false)
  const [createTypeName, setCreateTypeName] = useState('')
  const [createTypeImageFile, setCreateTypeImageFile] = useState<File | null>(null)
  const cardImageInputRef = useRef<HTMLInputElement>(null)

  const [createColorsQ, setCreateColorsQ] = useState('')
  const [createColorsHit, setCreateColorsHit] = useState<Material[]>([])
  const [createColorsPicking, setCreateColorsPicking] = useState(false)
  const [createColors, setCreateColors] = useState<Record<number, ColorFlags>>({})
  const [calcSessionHydrated, setCalcSessionHydrated] = useState(false)

  const [editTypeId, setEditTypeId] = useState<number | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [editTypeImageFile, setEditTypeImageFile] = useState<File | null>(null)
  const editImageInputRef = useRef<HTMLInputElement>(null)
  const [editColorsQ, setEditColorsQ] = useState('')
  const [editColorsHit, setEditColorsHit] = useState<Material[]>([])
  const [editColorsPicking, setEditColorsPicking] = useState(false)
  const [editColors, setEditColors] = useState<Record<number, ColorFlags>>({})

  const reload = useCallback(() => {
    setErr(null)
    setLoading(true)
    fetchCalculatorProfileTypes()
      .then((r) => {
        const rows = (r.results ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        setProfileTypes(rows)
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Склейка шагов 2→3 через localStorage (без глобального стора).
  useEffect(() => {
    try {
      const t = localStorage.getItem('calc_frame_type_id')
      const c = localStorage.getItem('calc_frame_color_id')
      const tid = t ? Number(t) : null
      const cid = c ? Number(c) : null
      if (tid && Number.isFinite(tid)) setSelectedTypeId(tid)
      if (cid && Number.isFinite(cid)) setSelectedColorId(cid)
    } catch {
      // ignore
    }
    setCalcSessionHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!calcSessionHydrated) return
    try {
      if (selectedTypeId == null || selectedColorId == null) {
        localStorage.removeItem('calc_frame_type_id')
        localStorage.removeItem('calc_frame_color_id')
      } else {
        const t = profileTypes.find((x) => x.id === selectedTypeId)
        if (t && (t.colors ?? []).some((c) => c.color_material_id === selectedColorId)) {
          localStorage.setItem('calc_frame_type_id', String(selectedTypeId))
          localStorage.setItem('calc_frame_color_id', String(selectedColorId))
        }
      }
    } catch {
      // ignore
    }
    notifyFrameCalcSession()
  }, [calcSessionHydrated, selectedTypeId, selectedColorId, profileTypes])

  useEffect(() => {
    if (!calcSessionHydrated || loading) return
    if (selectedTypeId != null && !profileTypes.some((x) => x.id === selectedTypeId)) {
      setSelectedTypeId(null)
    }
    if (modalTypeId != null && !profileTypes.some((x) => x.id === modalTypeId)) {
      setModalTypeId(null)
    }
  }, [calcSessionHydrated, loading, modalTypeId, profileTypes, selectedTypeId])

  useEffect(() => {
    if (!calcSessionHydrated) return
    if (selectedTypeId == null) {
      setSelectedColorId(null)
      return
    }
    // Пока типы не подгрузились, не сбрасывать цвет (иначе при «Назад» с шага 3 всё обнуляется).
    if (loading) return
    const t = profileTypes.find((x) => x.id === selectedTypeId) ?? null
    if (!t) {
      setSelectedColorId(null)
      return
    }
    if (selectedColorId != null && (t.colors ?? []).some((c) => c.color_material_id === selectedColorId)) return
    setSelectedColorId((t.colors ?? [])[0]?.color_material_id ?? null)
  }, [calcSessionHydrated, loading, selectedTypeId, profileTypes, selectedColorId])

  useEffect(() => {
    if (!createOpen) return
    const q = createColorsQ.trim()
    const t = window.setTimeout(() => {
      if (!q) {
        setCreateColorsHit([])
        return
      }
      setCreateColorsPicking(true)
      searchMaterials(q)
        .then((r) => setCreateColorsHit(r.results ?? []))
        .catch(() => setCreateColorsHit([]))
        .finally(() => setCreateColorsPicking(false))
    }, 250)
    return () => clearTimeout(t)
  }, [createColorsQ, createOpen])

  useEffect(() => {
    if (editTypeId == null) return
    const q = editColorsQ.trim()
    const t = window.setTimeout(() => {
      if (!q) {
        setEditColorsHit([])
        return
      }
      setEditColorsPicking(true)
      searchMaterials(q)
        .then((r) => setEditColorsHit(r.results ?? []))
        .catch(() => setEditColorsHit([]))
        .finally(() => setEditColorsPicking(false))
    }, 250)
    return () => clearTimeout(t)
  }, [editColorsQ, editTypeId])

  useEffect(() => {
    const list = [...createColorsHit, ...editColorsHit]
    const ids = new Set<number>()
    for (const m of list) {
      const has = (m.texture_image ?? '').trim() || (m.texture_color ?? '').trim()
      if (!has) ids.add(m.id)
    }
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
  }, [createColorsHit, editColorsHit, texByMaterialId])

  const createTypeImagePreview = useMemo(() => {
    if (!createTypeImageFile) return ''
    return URL.createObjectURL(createTypeImageFile)
  }, [createTypeImageFile])

  useEffect(() => {
    return () => {
      if (createTypeImagePreview) URL.revokeObjectURL(createTypeImagePreview)
    }
  }, [createTypeImagePreview])

  const editTypeImagePreview = useMemo(() => {
    if (!editTypeImageFile) return ''
    return URL.createObjectURL(editTypeImageFile)
  }, [editTypeImageFile])

  useEffect(() => {
    return () => {
      if (editTypeImagePreview) URL.revokeObjectURL(editTypeImagePreview)
    }
  }, [editTypeImagePreview])

  const editingType = useMemo(
    () => (editTypeId != null ? profileTypes.find((p) => p.id === editTypeId) ?? null : null),
    [editTypeId, profileTypes]
  )

  const editExistingCardUrl = useMemo(() => {
    if (!editingType) return ''
    return resolveMediaUrl(((editingType.card_image ?? '') || (editingType.image_url ?? '')).trim())
  }, [editingType])

  const openEditType = (t: CalculatorProfileType) => {
    setCreateOpen(false)
    setErr(null)
    setEditTypeId(t.id)
    setEditTypeName(t.name)
    setEditTypeImageFile(null)
    if (editImageInputRef.current) editImageInputRef.current.value = ''
    const m: Record<number, ColorFlags> = {}
    for (const c of t.colors ?? []) {
      m[c.color_material_id] = {
        is_new: !!c.is_new,
        is_hit: !!c.is_hit,
        is_sale: !!c.is_sale,
      }
    }
    setEditColors(m)
    setEditColorsQ('')
    setEditColorsHit([])
  }

  const closeEditType = () => {
    setEditTypeId(null)
    setEditTypeName('')
    setEditTypeImageFile(null)
    if (editImageInputRef.current) editImageInputRef.current.value = ''
    setEditColors({})
    setEditColorsQ('')
    setEditColorsHit([])
  }

  const submitEditType = async () => {
    const t = editingType
    if (!t || editTypeId == null) return
    const name = editTypeName.trim()
    if (!name) {
      setErr('Укажите название типа профиля.')
      return
    }
    setErr(null)
    try {
      const colors = Object.entries(editColors).map(([id, f]) => ({
        color_material_id: Number(id),
        is_new: !!f.is_new,
        is_hit: !!f.is_hit,
        is_sale: !!f.is_sale,
      }))
      let updated: CalculatorProfileType
      if (editTypeImageFile) {
        const fd = new FormData()
        fd.append('name', name)
        fd.append('is_active', String(t.is_active))
        fd.append('sort_order', String(t.sort_order))
        fd.append('colors', JSON.stringify(colors))
        fd.append('card_image', editTypeImageFile)
        updated = await updateCalculatorProfileType(editTypeId, fd)
      } else {
        updated = await updateCalculatorProfileType(editTypeId, {
          name,
          is_active: t.is_active,
          sort_order: t.sort_order,
          colors,
        })
      }
      setProfileTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      closeEditType()
    } catch (e) {
      setErr(String(e))
    }
  }

  const submitCreate = async () => {
    const name = createTypeName.trim()
    if (!name) {
      setErr('Укажите название типа профиля.')
      return
    }
    setErr(null)
    try {
      const colors = Object.entries(createColors).map(([id, f]) => ({
        color_material_id: Number(id),
        is_new: !!f.is_new,
        is_hit: !!f.is_hit,
        is_sale: !!f.is_sale,
      }))
      const fd = new FormData()
      fd.append('name', name)
      fd.append('is_active', 'true')
      fd.append('sort_order', String(profileTypes.length))
      fd.append('colors', JSON.stringify(colors))
      if (createTypeImageFile) fd.append('card_image', createTypeImageFile)
      const created = await createCalculatorProfileType(fd)
      setProfileTypes((prev) => [...prev, created])
      setSelectedTypeId(created.id)
      setCreateOpen(false)
      setCreateTypeName('')
      setCreateTypeImageFile(null)
      if (cardImageInputRef.current) cardImageInputRef.current.value = ''
      setCreateColorsQ('')
      setCreateColorsHit([])
      setCreateColors({})
    } catch (e) {
      setErr(String(e))
    }
  }

  const deleteSelectedType = () => {
    const selected = profileTypes.find((p) => p.id === selectedTypeId) ?? null
    if (!selected) return
    if (!window.confirm('Удалить тип профиля?')) return
    setErr(null)
    deleteCalculatorProfileType(selected.id)
      .then(() => {
        setProfileTypes((prev) => prev.filter((p) => p.id !== selected.id))
        setSelectedTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setModalTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setEditTypeId((prev) => (prev === selected.id ? null : prev))
      })
      .catch((e) => setErr(String(e)))
  }

  useEffect(() => {
    if (editTypeId == null) return
    if (!profileTypes.some((p) => p.id === editTypeId)) {
      setEditTypeId(null)
      setEditTypeName('')
      setEditTypeImageFile(null)
      if (editImageInputRef.current) editImageInputRef.current.value = ''
      setEditColors({})
      setEditColorsQ('')
      setEditColorsHit([])
    }
  }, [editTypeId, profileTypes])

  const selectedType = useMemo(
    () => profileTypes.find((p) => p.id === selectedTypeId) ?? null,
    [profileTypes, selectedTypeId]
  )

  const modalType = useMemo(
    () => profileTypes.find((p) => p.id === modalTypeId) ?? null,
    [profileTypes, modalTypeId]
  )

  const patchModalColors = useCallback(async (typeId: number, rows: { color_material_id: number; is_new?: boolean; is_hit?: boolean; is_sale?: boolean }[]) => {
    setModalSaving(true)
    setErr(null)
    try {
      const updated = await updateCalculatorProfileType(typeId, { colors: rows })
      setProfileTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e) {
      setErr(String(e))
    } finally {
      setModalSaving(false)
    }
  }, [])

  const removeModalColor = useCallback(async (colorMaterialId: number) => {
    if (!modalType) return
    const nextColors = (modalType.colors ?? [])
      .filter((c) => c.color_material_id !== colorMaterialId)
      .map((c) => ({
        color_material_id: c.color_material_id,
        is_new: Boolean(c.is_new),
        is_hit: Boolean(c.is_hit),
        is_sale: Boolean(c.is_sale),
      }))

    await patchModalColors(modalType.id, nextColors)

    if (selectedColorId === colorMaterialId) {
      const nextSel = nextColors[0]?.color_material_id ?? null
      setSelectedColorId(nextSel)
    }
  }, [modalType, patchModalColors, selectedColorId])

  useEffect(() => {
    const ids = new Set<number>()
    for (const c of modalType?.colors ?? []) {
      const cm = c.color_material as any
      const has = (cm?.texture_color ?? '').trim() || (cm?.texture_image ?? '')
      if (!has) ids.add(c.color_material_id)
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
  }, [modalType, selectedType, texByMaterialId])

  const selectedColorMaterial = useMemo(() => {
    if (!selectedType) return null
    const hit = (selectedType.colors ?? []).find((c) => c.color_material_id === selectedColorId) ?? null
    const base = hit?.color_material ?? null
    if (!base) return null
    const fallback = texByMaterialId[hit!.color_material_id]
    if (!fallback) return base
    return {
      ...base,
      texture_color: (base as any).texture_color || fallback.texture_color,
      texture_image: (base as any).texture_image || fallback.texture_image,
      name: base.name || fallback.name,
    }
  }, [selectedColorId, selectedType, texByMaterialId])

  // Для параметров текстуры (opacity/offset/step/rotate/mirror) нужен полный материал, а не summary из списка цветов.
  const [selectedColorMaterialFull, setSelectedColorMaterialFull] = useState<Material | null>(null)
  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!selectedColorId) {
        setSelectedColorMaterialFull(null)
        return
      }
      try {
        const m = await fetchMaterial(selectedColorId)
        if (!cancel) setSelectedColorMaterialFull(m)
      } catch {
        if (!cancel) setSelectedColorMaterialFull(null)
      }
    })()
    return () => {
      cancel = true
    }
  }, [selectedColorId])

  const selectedColorFlags = useMemo(() => {
    if (!selectedType) return null
    return (selectedType.colors ?? []).find((c) => c.color_material_id === selectedColorId) ?? null
  }, [selectedColorId, selectedType])

  return (
    <>
      <div className="frame2">
        <section className="frame2-card calc-side-panel">
          <div className="admin-heading-row calc-card-title-row">
            <h3 className="calc-h3">Тип профиля и цвет</h3>
          </div>

          {err && <div className="admin-error">{err}</div>}
          {loading && <p className="admin-muted">Загрузка…</p>}

          <div className="frame2-card-head">
            <h4 className="frame2-h4">Типы профилей</h4>
            {!readOnly && (
              <div className="frame2-actions">
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => {
                    setErr(null)
                    setCreateOpen((was) => {
                      if (!was) closeEditType()
                      return !was
                    })
                  }}
                >
                  + Добавить тип профиля
                </button>
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={!selectedType}
                  onClick={deleteSelectedType}
                  title={!selectedType ? 'Выберите тип профиля' : undefined}
                >
                  Удалить тип
                </button>
              </div>
            )}
          </div>

          {!readOnly && createOpen && (
            <div className="frame2-create">
              <div className="frame2-create-head">
                <div className="frame2-create-title">Создание типа профиля</div>
                <div className="frame2-actions">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => {
                      setCreateOpen(false)
                      setCreateTypeName('')
                      setCreateTypeImageFile(null)
                      if (cardImageInputRef.current) cardImageInputRef.current.value = ''
                      setCreateColorsQ('')
                      setCreateColorsHit([])
                      setCreateColors({})
                    }}
                  >
                    Отмена
                  </button>
                  <button type="button" className="admin-primary" onClick={submitCreate}>
                    Создать
                  </button>
                </div>
              </div>

              <div className="frame2-create-grid">
                <div className="frame2-block">
                  <div className="frame2-block-title">Тип профиля</div>
                  <input
                    className="admin-input"
                    value={createTypeName}
                    onChange={(e) => setCreateTypeName(e.target.value)}
                    placeholder="Название типа профиля…"
                  />
                  <div className="frame2-file-row">
                    <div className="frame2-file-label-row">
                      <label className="frame2-file-label" htmlFor="profile-type-card-image">
                        Изображение для карточки
                      </label>
                      <HintButton text="Выберите изображение с компьютера. Обычно в диалоге можно открыть «Рабочий стол». Поддерживаются форматы изображений (PNG/JPG/WebP и т.п.)." />
                    </div>
                    <input
                      id="profile-type-card-image"
                      ref={cardImageInputRef}
                      className="frame2-file-input frame2-file-input--sr"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        setCreateTypeImageFile(f)
                      }}
                    />
                    <div className="frame2-file-picker-row">
                      <button
                        type="button"
                        className="admin-secondary frame2-file-btn"
                        onClick={() => cardImageInputRef.current?.click()}
                      >
                        {createTypeImageFile ? 'Изменить файл…' : 'Выбрать файл…'}
                      </button>
                      <div className="frame2-file-name" aria-live="polite">
                        {createTypeImageFile ? createTypeImageFile.name : 'Файл не выбран'}
                      </div>
                    </div>
                    {createTypeImagePreview && (
                      <div className="frame2-file-preview frame2-file-preview--cover">
                        <img src={createTypeImagePreview} alt="" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="frame2-block">
                  <div className="frame2-block-title">Цвета (материалы)</div>
                  <input
                    className="admin-input"
                    value={createColorsQ}
                    onChange={(e) => setCreateColorsQ(e.target.value)}
                    placeholder="Поиск материалов…"
                  />
                  {createColorsPicking && <p className="admin-muted">Поиск…</p>}
                  {createColorsHit.length > 0 && (
                    <ul className="frame2-checklist">
                      {createColorsHit.map((m) => {
                        const checked = createColors[m.id] != null
                        const flags = createColors[m.id] ?? { is_new: false, is_hit: false, is_sale: false }
                        return (
                          <li key={m.id}>
                            <div
                              className={[
                                'frame2-checkrow',
                                checked ? 'frame2-checkrow--checked' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              title={matLabel(m)}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setCreateColors((prev) => {
                                    const next = { ...prev }
                                    if (next[m.id]) delete next[m.id]
                                    else next[m.id] = { is_new: false, is_hit: false, is_sale: false }
                                    return next
                                  })
                                }
                              />
                              <span className="frame2-check-article">{m.article || '—'}</span>
                              <MaterialCheckSwatch
                                name={m.name}
                                material={m}
                                texExtra={texByMaterialId[m.id]}
                              />
                              <span className="frame2-check-name-wrap">
                                <span className="frame2-check-name">{m.name}</span>
                              </span>
                            </div>
                            {checked && (
                              <div className="frame2-flags">
                                <label className="frame2-flag">
                                  <input
                                    type="checkbox"
                                    checked={flags.is_new}
                                    onChange={() =>
                                      setCreateColors((prev) => ({
                                        ...prev,
                                        [m.id]: { ...flags, is_new: !flags.is_new },
                                      }))
                                    }
                                  />{' '}
                                  New
                                </label>
                                <label className="frame2-flag">
                                  <input
                                    type="checkbox"
                                    checked={flags.is_hit}
                                    onChange={() =>
                                      setCreateColors((prev) => ({
                                        ...prev,
                                        [m.id]: { ...flags, is_hit: !flags.is_hit },
                                      }))
                                    }
                                  />{' '}
                                  Hit
                                </label>
                                <label className="frame2-flag">
                                  <input
                                    type="checkbox"
                                    checked={flags.is_sale}
                                    onChange={() =>
                                      setCreateColors((prev) => ({
                                        ...prev,
                                        [m.id]: { ...flags, is_sale: !flags.is_sale },
                                      }))
                                    }
                                  />{' '}
                                  Sale
                                </label>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {Object.keys(createColors).length > 0 && (
                    <div className="admin-muted">Выбрано цветов: {Object.keys(createColors).length}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!readOnly && editTypeId != null && editingType && (
            <div className="frame2-create">
              <div className="frame2-create-head">
                <div className="frame2-create-title">Редактирование типа профиля</div>
                <div className="frame2-actions">
                  <button type="button" className="admin-secondary" onClick={closeEditType}>
                    Отмена
                  </button>
                  <button type="button" className="admin-primary" onClick={() => void submitEditType()}>
                    Сохранить
                  </button>
                </div>
              </div>

              <div className="frame2-create-grid">
                <div className="frame2-block">
                  <div className="frame2-block-title">Тип профиля</div>
                  <input
                    className="admin-input"
                    value={editTypeName}
                    onChange={(e) => setEditTypeName(e.target.value)}
                    placeholder="Название типа профиля…"
                  />
                  <div className="frame2-file-row">
                    <div className="frame2-file-label-row">
                      <label className="frame2-file-label" htmlFor="profile-type-card-image-edit">
                        Новое изображение (необязательно)
                      </label>
                      <HintButton text="Оставьте поле пустым, чтобы сохранить текущую картинку. Если выбрать файл — он заменит текущую картинку." />
                    </div>
                    <input
                      id="profile-type-card-image-edit"
                      ref={editImageInputRef}
                      className="frame2-file-input frame2-file-input--sr"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditTypeImageFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="frame2-file-picker-row">
                      <button
                        type="button"
                        className="admin-secondary frame2-file-btn"
                        onClick={() => editImageInputRef.current?.click()}
                      >
                        {editTypeImageFile ? 'Изменить файл…' : 'Выбрать файл…'}
                      </button>
                      <div className="frame2-file-name" aria-live="polite">
                        {editTypeImageFile ? editTypeImageFile.name : 'Файл не выбран'}
                      </div>
                    </div>
                    {(editTypeImagePreview || editExistingCardUrl) && (
                      <div className="frame2-file-preview frame2-file-preview--cover">
                        <img src={editTypeImagePreview || editExistingCardUrl} alt="" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="frame2-block">
                  <div className="frame2-block-title">Цвета (материалы)</div>
                  <input
                    className="admin-input"
                    value={editColorsQ}
                    onChange={(e) => setEditColorsQ(e.target.value)}
                    placeholder="Поиск материалов…"
                  />
                  {editColorsPicking && <p className="admin-muted">Поиск…</p>}
                  {editColorsHit.length > 0 && (
                    <ul className="frame2-checklist">
                      {editColorsHit.map((m) => {
                        const checked = editColors[m.id] != null
                        const flags = editColors[m.id] ?? { is_new: false, is_hit: false, is_sale: false }
                        return (
                          <li key={m.id}>
                            <div
                              className={[
                                'frame2-checkrow',
                                checked ? 'frame2-checkrow--checked' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              title={matLabel(m)}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setEditColors((prev) => {
                                    const next = { ...prev }
                                    if (next[m.id]) delete next[m.id]
                                    else next[m.id] = { is_new: false, is_hit: false, is_sale: false }
                                    return next
                                  })
                                }
                              />
                              <span className="frame2-check-article">{m.article || '—'}</span>
                              <MaterialCheckSwatch
                                name={m.name}
                                material={m}
                                texExtra={texByMaterialId[m.id]}
                              />
                              <span className="frame2-check-name-wrap">
                                <span className="frame2-check-name">{m.name}</span>
                              </span>
                            </div>
                            {checked && (
                              <div className="frame2-flags">
                                <label className="frame2-flag">
                                  <input
                                    type="checkbox"
                                    checked={flags.is_new}
                                    onChange={() =>
                                      setEditColors((prev) => ({
                                        ...prev,
                                        [m.id]: { ...flags, is_new: !flags.is_new },
                                      }))
                                    }
                                  />{' '}
                                  New
                                </label>
                                <label className="frame2-flag">
                                  <input
                                    type="checkbox"
                                    checked={flags.is_hit}
                                    onChange={() =>
                                      setEditColors((prev) => ({
                                        ...prev,
                                        [m.id]: { ...flags, is_hit: !flags.is_hit },
                                      }))
                                    }
                                  />{' '}
                                  Hit
                                </label>
                                <label className="frame2-flag">
                                  <input
                                    type="checkbox"
                                    checked={flags.is_sale}
                                    onChange={() =>
                                      setEditColors((prev) => ({
                                        ...prev,
                                        [m.id]: { ...flags, is_sale: !flags.is_sale },
                                      }))
                                    }
                                  />{' '}
                                  Sale
                                </label>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {Object.keys(editColors).length > 0 && (
                    <div className="admin-muted">Выбрано цветов: {Object.keys(editColors).length}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <ul className="frame2-list" aria-label="Список типов профилей">
            {profileTypes.length === 0 && <li className="admin-muted">Типов профилей пока нет.</li>}
          </ul>

          <div className="tiles" aria-label="Типы профилей плитками">
            {profileTypes.map((t) => {
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
                    <div className="tile-sub">Цветов: {(t.colors ?? []).length}</div>
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
                        openEditType(t)
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

          <div className="frame2-card-nav">
            <button type="button" className="admin-secondary" onClick={() => nav(step(''))}>
              ← Предыдущий шаг
            </button>
            <button
              type="button"
              className="admin-primary"
              disabled={!selectedTypeId || !selectedColorId}
              title={!selectedTypeId || !selectedColorId ? 'Сначала выберите тип профиля и цвет' : undefined}
              onClick={() => nav(step('frame/size'))}
            >
              Следующий шаг →
            </button>
          </div>
        </section>

        <section className="frame2-sketch" aria-label="Эскиз фасада">
          <div className="frame2-sketch-inner">
            <div className="sketch">
              <div className="sketch-frame">
                <div
                  className="sketch-frame-texture"
                  style={materialTextureLayerStyle(selectedColorMaterialFull ?? selectedColorMaterial)}
                />
              </div>
              <div className="sketch-paper">
                <div className="sketch-paper-texture" />
              </div>
              <div className="sketch-sheet">
                <div className="sketch-title">ЛИЦЕВАЯ СТОРОНА ФАСАДА</div>
                <div className="sketch-sub">Визуализация примерная</div>
                <div className="sketch-table">
                  <div className="sketch-row">
                    <div className="sketch-key">Тип профиля</div>
                    <div className="sketch-val">
                      {selectedType?.name || '—'}
                    </div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Цвет</div>
                    <div className="sketch-val">
                      {selectedColorMaterial?.name || '—'}
                    </div>
                  </div>
                </div>
                {selectedColorFlags && (selectedColorFlags.is_new || selectedColorFlags.is_hit || selectedColorFlags.is_sale) && (
                  <div className="sketch-flags">
                    {selectedColorFlags.is_new && <span className="tile-flag tile-flag--new">New</span>}
                    {selectedColorFlags.is_hit && <span className="tile-flag tile-flag--hit">Hit</span>}
                    {selectedColorFlags.is_sale && <span className="tile-flag tile-flag--sale">Sale</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {modalType && (
        <div
          className="frame2-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор цвета"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalTypeId(null)
          }}
        >
          <div className="frame2-modal" role="document" onClick={(e) => e.stopPropagation()}>
            <div className="frame2-modal-head">
              <div className="frame2-modal-title">
                {modalType.name || `Тип #${modalType.id}`}
              </div>
              <button type="button" className="admin-secondary" onClick={() => setModalTypeId(null)}>
                Закрыть
              </button>
            </div>

            <div className="tiles tiles--colors">
              {(modalType.colors ?? []).map((c) => {
                const active = c.color_material_id === selectedColorId
                return (
                  <div key={c.id} className="tile-cell">
                    <button
                      type="button"
                      className={active ? 'tile tile--active tile--fill' : 'tile tile--fill'}
                      onClick={() => {
                        setSelectedColorId(c.color_material_id)
                        setModalTypeId(null)
                      }}
                      title={matLabel(c.color_material)}
                    >
                      {textureThumb({
                        texture_image:
                          (c.color_material as any).texture_image ??
                          texByMaterialId[c.color_material_id]?.texture_image ??
                          null,
                        texture_color:
                          (c.color_material as any).texture_color ??
                          texByMaterialId[c.color_material_id]?.texture_color ??
                          '',
                        name: c.color_material.name,
                      })}
                      <div className="tile-title">{c.color_material.name}</div>
                      <div className="tile-sub">{c.color_material.article || '—'}</div>
                      {(c.is_new || c.is_hit || c.is_sale) && (
                        <div className="tile-flags">
                          {c.is_new && <span className="tile-flag tile-flag--new">New</span>}
                          {c.is_hit && <span className="tile-flag tile-flag--hit">Hit</span>}
                          {c.is_sale && <span className="tile-flag tile-flag--sale">Sale</span>}
                        </div>
                      )}
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className="tile-action-remove"
                        title="Убрать цвет из типа"
                        disabled={modalSaving}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setRemoveColorConfirm({ id: c.color_material_id, name: c.color_material.name })
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {(modalType.colors ?? []).length === 0 && (
              <div className="admin-muted">Цвета для типа профиля не заданы.</div>
            )}
          </div>
        </div>
      )}

      {removeColorConfirm && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Подтверждение удаления"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRemoveColorConfirm(null)
          }}
        >
          <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-modal-title">Убрать цвет из типа?</h3>
            <p className="admin-modal-text">
              Вы уверены, что хотите убрать «{removeColorConfirm.name}» из этого типа профиля?
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary" onClick={() => setRemoveColorConfirm(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="admin-primary"
                disabled={modalSaving}
                onClick={() => {
                  const id = removeColorConfirm.id
                  setRemoveColorConfirm(null)
                  void removeModalColor(id)
                }}
              >
                Убрать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Step2FrameFacade
