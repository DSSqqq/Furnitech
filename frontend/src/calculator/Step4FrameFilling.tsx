import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createCalculatorFillingType,
  deleteCalculatorFillingType,
  fetchCalculatorFillingTypes,
  fetchCalculatorProfileTypes,
  fetchMaterial,
  searchMaterials,
  updateCalculatorFillingType,
} from '../api'
import type { CalculatorFillingType, Material } from '../types'
import { useCalcPaths } from './calcPathsContext'
import { isFrameStep2Ready, notifyFrameCalcSession, readCalculatorPriceConfigKey, subscribeFrameCalcSession } from './frameCalcSession'
import { resolveMediaUrl, sketchFrameInlineStyle } from './sketchFrame'
import './Step2FrameFacade.css'
import './Step3FrameSizes.css'

function asNum(s: string) {
  const t = s.trim().replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function blendAspect(defaultAspect: number, targetAspect: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultAspect + (targetAspect - defaultAspect) * k
}

function blendScale(defaultScale: number, targetScale: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultScale + (targetScale - defaultScale) * k
}

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

function fillingPaperStyle(m: Material | null | undefined): CSSProperties {
  if (!m) return {}
  const img = resolveMediaUrl((m.texture_image ?? '') as string)
  if (img) return { backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  const c = (m.texture_color ?? '').trim()
  if (c) return { backgroundColor: c }
  return { background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(240,244,248,0.95) 100%)' }
}

export function Step4FrameFilling() {
  const nav = useNavigate()
  const { readOnly, step } = useCalcPaths()
  const [fillingTypes, setFillingTypes] = useState<CalculatorFillingType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null)
  const [modalTypeId, setModalTypeId] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [frameTypeName, setFrameTypeName] = useState('—')
  const [frameColorMaterial, setFrameColorMaterial] = useState<Material | null>(null)

  // Габариты (и qty) живут в localStorage, шаг 3 их записывает. На шаге 4 — читаем через подписку,
  // чтобы размеры не “пропадали” и обновлялись при навигации/изменениях.
  const cfgKey = useSyncExternalStore(subscribeFrameCalcSession, readCalculatorPriceConfigKey, () => '')
  const dims = useMemo(() => {
    const parts = cfgKey.split('|')
    const h = parts[1] || '—'
    const w = parts[2] || '—'
    return { h, w }
  }, [cfgKey])
  const heightN = useMemo(() => (dims.h === '—' ? null : asNum(dims.h)), [dims.h])
  const widthN = useMemo(() => (dims.w === '—' ? null : asNum(dims.w)), [dims.w])
  const sketchAspect = useMemo(() => {
    if (heightN == null || widthN == null || heightN <= 0 || widthN <= 0) return undefined
    const target = widthN / heightN
    const softened = blendAspect(3 / 4.2, target, 0.28)
    return clamp(softened, 0.56, 0.92)
  }, [heightN, widthN])
  const sketchScaleY = useMemo(() => {
    if (heightN == null || heightN <= 0) return undefined
    const target = heightN / 2000
    const softened = blendScale(1, target, 0.22)
    return clamp(softened, 0.9, 1.1)
  }, [heightN])

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createImageFile, setCreateImageFile] = useState<File | null>(null)
  const cardImageInputRef = useRef<HTMLInputElement>(null)
  const [createMatQ, setCreateMatQ] = useState('')
  const [createMatHit, setCreateMatHit] = useState<Material[]>([])
  const [createMatPicking, setCreateMatPicking] = useState(false)
  const [createMatIds, setCreateMatIds] = useState<Record<number, true>>({})

  const [editFillingId, setEditFillingId] = useState<number | null>(null)
  const [editFillingName, setEditFillingName] = useState('')
  const [editFillingImageFile, setEditFillingImageFile] = useState<File | null>(null)
  const editFillingImageRef = useRef<HTMLInputElement>(null)
  const [editFillingMatQ, setEditFillingMatQ] = useState('')
  const [editFillingMatHit, setEditFillingMatHit] = useState<Material[]>([])
  const [editFillingMatPicking, setEditFillingMatPicking] = useState(false)
  const [editFillingMatIds, setEditFillingMatIds] = useState<Record<number, true>>({})

  const [modalAddQ, setModalAddQ] = useState('')
  const [modalAddHit, setModalAddHit] = useState<Material[]>([])
  const [modalAddPicking, setModalAddPicking] = useState(false)
  const [modalAddIds, setModalAddIds] = useState<Record<number, true>>({})
  const [modalSaving, setModalSaving] = useState(false)

  const [texByMaterialId, setTexByMaterialId] = useState<
    Record<number, { texture_color?: string; texture_image?: string | null; name?: string }>
  >({})

  const reload = useCallback(() => {
    setErr(null)
    setLoading(true)
    fetchCalculatorFillingTypes()
      .then((r) => {
        const rows = (r.results ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        setFillingTypes(rows)
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const tid = localStorage.getItem('calc_frame_type_id')
      const cid = localStorage.getItem('calc_frame_color_id')
      if (cid) {
        try {
          const m = await fetchMaterial(Number(cid))
          if (!cancel) setFrameColorMaterial(m)
        } catch {
          /* ignore */
        }
      }
      if (tid) {
        try {
          const r = await fetchCalculatorProfileTypes()
          const t = (r.results ?? []).find((x) => x.id === Number(tid))
          if (!cancel && t) setFrameTypeName(t.name)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    try {
      const t = localStorage.getItem('calc_filling_type_id')
      const m = localStorage.getItem('calc_filling_material_id')
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
        localStorage.setItem('calc_filling_type_id', String(selectedTypeId))
        localStorage.setItem('calc_filling_material_id', String(selectedMaterialId))
      } else {
        localStorage.removeItem('calc_filling_type_id')
        localStorage.removeItem('calc_filling_material_id')
      }
    } catch {
      /* ignore */
    }
    notifyFrameCalcSession()
  }, [hydrated, selectedTypeId, selectedMaterialId])

  useEffect(() => {
    if (!hydrated || loading) return
    if (selectedTypeId != null && !fillingTypes.some((x) => x.id === selectedTypeId)) {
      setSelectedTypeId(null)
    }
    if (modalTypeId != null && !fillingTypes.some((x) => x.id === modalTypeId)) {
      setModalTypeId(null)
    }
  }, [hydrated, loading, modalTypeId, fillingTypes, selectedTypeId])

  useEffect(() => {
    if (!hydrated) return
    if (selectedTypeId == null) {
      setSelectedMaterialId(null)
      return
    }
    if (loading) return
    const t = fillingTypes.find((x) => x.id === selectedTypeId) ?? null
    if (!t) {
      setSelectedMaterialId(null)
      return
    }
    const mats = t.materials ?? []
    if (selectedMaterialId != null && mats.some((c) => c.material_id === selectedMaterialId)) return
    setSelectedMaterialId(mats[0]?.material_id ?? null)
  }, [hydrated, loading, selectedTypeId, fillingTypes, selectedMaterialId])

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
    if (modalTypeId == null) {
      setModalAddQ('')
      setModalAddHit([])
      setModalAddIds({})
      return
    }
    const q = modalAddQ.trim()
    const id = window.setTimeout(() => {
      if (!q) {
        setModalAddHit([])
        return
      }
      setModalAddPicking(true)
      searchMaterials(q)
        .then((r) => setModalAddHit(r.results ?? []))
        .catch(() => setModalAddHit([]))
        .finally(() => setModalAddPicking(false))
    }, 250)
    return () => clearTimeout(id)
  }, [modalAddQ, modalTypeId])

  useEffect(() => {
    if (editFillingId == null) return
    const q = editFillingMatQ.trim()
    const id = window.setTimeout(() => {
      if (!q) {
        setEditFillingMatHit([])
        return
      }
      setEditFillingMatPicking(true)
      searchMaterials(q)
        .then((r) => setEditFillingMatHit(r.results ?? []))
        .catch(() => setEditFillingMatHit([]))
        .finally(() => setEditFillingMatPicking(false))
    }, 250)
    return () => clearTimeout(id)
  }, [editFillingMatQ, editFillingId])

  const createImagePreview = useMemo(() => {
    if (!createImageFile) return ''
    return URL.createObjectURL(createImageFile)
  }, [createImageFile])

  useEffect(() => {
    return () => {
      if (createImagePreview) URL.revokeObjectURL(createImagePreview)
    }
  }, [createImagePreview])

  const editFillingImagePreview = useMemo(() => {
    if (!editFillingImageFile) return ''
    return URL.createObjectURL(editFillingImageFile)
  }, [editFillingImageFile])

  useEffect(() => {
    return () => {
      if (editFillingImagePreview) URL.revokeObjectURL(editFillingImagePreview)
    }
  }, [editFillingImagePreview])

  const editingFilling = useMemo(
    () => (editFillingId != null ? fillingTypes.find((p) => p.id === editFillingId) ?? null : null),
    [editFillingId, fillingTypes]
  )

  const editFillingExistingCardUrl = useMemo(() => {
    if (!editingFilling) return ''
    return resolveMediaUrl(((editingFilling.card_image ?? '') || (editingFilling.image_url ?? '')).trim())
  }, [editingFilling])

  const closeEditFilling = () => {
    setEditFillingId(null)
    setEditFillingName('')
    setEditFillingImageFile(null)
    if (editFillingImageRef.current) editFillingImageRef.current.value = ''
    setEditFillingMatIds({})
    setEditFillingMatQ('')
    setEditFillingMatHit([])
  }

  const openEditFilling = (t: CalculatorFillingType) => {
    setCreateOpen(false)
    setErr(null)
    setEditFillingId(t.id)
    setEditFillingName(t.name)
    setEditFillingImageFile(null)
    if (editFillingImageRef.current) editFillingImageRef.current.value = ''
    const ids: Record<number, true> = {}
    for (const m of t.materials ?? []) ids[m.material_id] = true
    setEditFillingMatIds(ids)
    setEditFillingMatQ('')
    setEditFillingMatHit([])
  }

  const submitEditFilling = async () => {
    const t = editingFilling
    if (!t || editFillingId == null) return
    const name = editFillingName.trim()
    if (!name) {
      setErr('Укажите название типа наполнения.')
      return
    }
    setErr(null)
    try {
      const materials = Object.keys(editFillingMatIds).map((id) => ({ material_id: Number(id) }))
      let updated: CalculatorFillingType
      if (editFillingImageFile) {
        const fd = new FormData()
        fd.append('name', name)
        fd.append('is_active', String(t.is_active))
        fd.append('sort_order', String(t.sort_order))
        fd.append('materials', JSON.stringify(materials))
        fd.append('card_image', editFillingImageFile)
        updated = await updateCalculatorFillingType(editFillingId, fd)
      } else {
        updated = await updateCalculatorFillingType(editFillingId, {
          name,
          is_active: t.is_active,
          sort_order: t.sort_order,
          materials,
        })
      }
      setFillingTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      closeEditFilling()
    } catch (e) {
      setErr(String(e))
    }
  }

  const submitCreate = async () => {
    const name = createName.trim()
    if (!name) {
      setErr('Укажите название типа наполнения.')
      return
    }
    setErr(null)
    try {
      const materials = Object.keys(createMatIds).map((id) => ({ material_id: Number(id) }))
      const fd = new FormData()
      fd.append('name', name)
      fd.append('is_active', 'true')
      fd.append('sort_order', String(fillingTypes.length))
      fd.append('materials', JSON.stringify(materials))
      if (createImageFile) fd.append('card_image', createImageFile)
      const created = await createCalculatorFillingType(fd)
      setFillingTypes((prev) => [...prev, created])
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
    const selected = fillingTypes.find((p) => p.id === selectedTypeId) ?? null
    if (!selected) return
    if (!window.confirm('Удалить тип наполнения?')) return
    setErr(null)
    deleteCalculatorFillingType(selected.id)
      .then(() => {
        setFillingTypes((prev) => prev.filter((p) => p.id !== selected.id))
        setSelectedTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setModalTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setEditFillingId((prev) => (prev === selected.id ? null : prev))
      })
      .catch((e) => setErr(String(e)))
  }

  useEffect(() => {
    if (editFillingId == null) return
    if (!fillingTypes.some((p) => p.id === editFillingId)) {
      setEditFillingId(null)
      setEditFillingName('')
      setEditFillingImageFile(null)
      if (editFillingImageRef.current) editFillingImageRef.current.value = ''
      setEditFillingMatIds({})
      setEditFillingMatQ('')
      setEditFillingMatHit([])
    }
  }, [editFillingId, fillingTypes])

  const selectedType = useMemo(
    () => fillingTypes.find((p) => p.id === selectedTypeId) ?? null,
    [fillingTypes, selectedTypeId]
  )

  const modalType = useMemo(
    () => fillingTypes.find((p) => p.id === modalTypeId) ?? null,
    [fillingTypes, modalTypeId]
  )

  const selectedFillingMaterial = useMemo(() => {
    if (!selectedType) return null
    const row = (selectedType.materials ?? []).find((c) => c.material_id === selectedMaterialId) ?? null
    return row?.material ?? null
  }, [selectedMaterialId, selectedType])

  useEffect(() => {
    const ids = new Set<number>()
    for (const c of modalType?.materials ?? []) {
      const cm = c.material as any
      const has = (cm?.texture_color ?? '').trim() || (cm?.texture_image ?? '')
      if (!has) ids.add(c.material_id)
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
  }, [modalType, texByMaterialId])

  const patchModalMaterials = async (rows: { material_id: number }[]) => {
    if (!modalType) return
    setModalSaving(true)
    setErr(null)
    try {
      const updated = await updateCalculatorFillingType(modalType.id, { materials: rows })
      setFillingTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    } catch (e) {
      setErr(String(e))
    } finally {
      setModalSaving(false)
    }
  }

  const addModalMaterials = async () => {
    if (!modalType) return
    const existing = new Set((modalType.materials ?? []).map((m) => m.material_id))
    for (const id of Object.keys(modalAddIds)) existing.add(Number(id))
    const rows = [...existing].map((material_id) => ({ material_id }))
    await patchModalMaterials(rows)
    setModalAddIds({})
    setModalAddQ('')
    setModalAddHit([])
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
      <div className="frame2">
        <section className="frame2-card calc-side-panel">
          <div className="admin-heading-row calc-card-title-row">
            <h3 className="calc-h3">Наполнение</h3>
          </div>
          <p className="admin-muted frame2-lead">Выберите тип наполнения и материалы для каталога калькулятора.</p>

          {err && <div className="admin-error">{err}</div>}
          {loading && <p className="admin-muted">Загрузка…</p>}

          <div className="frame2-card-head">
            <h4 className="frame2-h4">Типы наполнения</h4>
            {!readOnly && (
              <div className="frame2-actions">
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => {
                    setErr(null)
                    setCreateOpen((was) => {
                      if (!was) closeEditFilling()
                      return !was
                    })
                  }}
                >
                  + Добавить тип наполнения
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
                <div className="frame2-create-title">Создание типа наполнения</div>
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
                  <button type="button" className="admin-primary" onClick={submitCreate}>
                    Создать
                  </button>
                </div>
              </div>
              <div className="frame2-create-grid">
                <div className="frame2-block">
                  <div className="frame2-block-title">Тип наполнения</div>
                  <input
                    className="admin-input"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Например: Лакобель, Мателюкс…"
                  />
                  <div className="frame2-file-row">
                    <label className="frame2-file-label" htmlFor="filling-type-card-image">
                      Изображение для карточки
                    </label>
                    <input
                      id="filling-type-card-image"
                      ref={cardImageInputRef}
                      className="frame2-file-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCreateImageFile(e.target.files?.[0] ?? null)}
                    />
                    {createImagePreview && (
                      <div className="frame2-file-preview frame2-file-preview--cover">
                        <img src={createImagePreview} alt="" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="frame2-block">
                  <div className="frame2-block-title">Материалы (из справочника)</div>
                  <input
                    className="admin-input"
                    value={createMatQ}
                    onChange={(e) => setCreateMatQ(e.target.value)}
                    placeholder="Поиск материалов…"
                  />
                  {createMatPicking && <p className="admin-muted">Поиск…</p>}
                  {createMatHit.length > 0 && (
                    <ul className="frame2-checklist">
                      {createMatHit.map((m) => (
                        <li key={m.id}>
                          <label className="frame2-checkrow" title={matLabel(m)}>
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
                            <span className="frame2-check-name">{m.name}</span>
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

          {!readOnly && editFillingId != null && editingFilling && (
            <div className="frame2-create">
              <div className="frame2-create-head">
                <div className="frame2-create-title">Редактирование типа наполнения</div>
                <div className="frame2-actions">
                  <button type="button" className="admin-secondary" onClick={closeEditFilling}>
                    Отмена
                  </button>
                  <button type="button" className="admin-primary" onClick={() => void submitEditFilling()}>
                    Сохранить
                  </button>
                </div>
              </div>
              <div className="frame2-create-grid">
                <div className="frame2-block">
                  <div className="frame2-block-title">Тип наполнения</div>
                  <input
                    className="admin-input"
                    value={editFillingName}
                    onChange={(e) => setEditFillingName(e.target.value)}
                    placeholder="Название…"
                  />
                  <div className="frame2-file-row">
                    <label className="frame2-file-label" htmlFor="filling-type-card-image-edit">
                      Новое изображение (необязательно)
                    </label>
                    <input
                      id="filling-type-card-image-edit"
                      ref={editFillingImageRef}
                      className="frame2-file-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditFillingImageFile(e.target.files?.[0] ?? null)}
                    />
                    {(editFillingImagePreview || editFillingExistingCardUrl) && (
                      <div className="frame2-file-preview frame2-file-preview--cover">
                        <img src={editFillingImagePreview || editFillingExistingCardUrl} alt="" />
                      </div>
                    )}
                    <p className="admin-muted frame2-file-hint">
                      Пустое поле файла — оставить текущую картинку.
                    </p>
                  </div>
                </div>
                <div className="frame2-block">
                  <div className="frame2-block-title">Материалы (из справочника)</div>
                  <input
                    className="admin-input"
                    value={editFillingMatQ}
                    onChange={(e) => setEditFillingMatQ(e.target.value)}
                    placeholder="Поиск материалов…"
                  />
                  {editFillingMatPicking && <p className="admin-muted">Поиск…</p>}
                  {editFillingMatHit.length > 0 && (
                    <ul className="frame2-checklist">
                      {editFillingMatHit.map((m) => (
                        <li key={m.id}>
                          <label className="frame2-checkrow" title={matLabel(m)}>
                            <input
                              type="checkbox"
                              checked={editFillingMatIds[m.id] === true}
                              onChange={() =>
                                setEditFillingMatIds((prev) => {
                                  const next = { ...prev }
                                  if (next[m.id]) delete next[m.id]
                                  else next[m.id] = true
                                  return next
                                })
                              }
                            />
                            <span className="frame2-check-article">{m.article || '—'}</span>
                            <span className="frame2-check-name">{m.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  {Object.keys(editFillingMatIds).length > 0 && (
                    <div className="admin-muted">Выбрано материалов: {Object.keys(editFillingMatIds).length}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="tiles" aria-label="Типы наполнения">
            {fillingTypes.length === 0 && !loading && <p className="admin-muted">Типов наполнения пока нет.</p>}
            {fillingTypes.map((t) => {
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
                        openEditFilling(t)
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
            <button type="button" className="admin-secondary" onClick={() => nav(step('frame/size'))}>
              ← Предыдущий шаг
            </button>
            <button type="button" className="admin-primary" disabled title="Следующий шаг пока не реализован">
              Следующий шаг →
            </button>
          </div>
        </section>

        <section className="frame2-sketch" aria-label="Эскиз фасада">
          <div className="frame2-sketch-inner">
            <div className="frame3-drawing" aria-label="Чертёж фасада с размерами">
              <div
                className="sketch"
                style={
                  sketchAspect || sketchScaleY
                    ? ({
                        aspectRatio: sketchAspect,
                        ['--sketch-scale-y' as any]: sketchScaleY,
                      } as any)
                    : undefined
                }
              >
                <div className="sketch-frame" style={sketchFrameInlineStyle(frameColorMaterial)} />
                <div className="sketch-paper" style={fillingPaperStyle(selectedFillingMaterial as Material)} />
                <div className="sketch-sheet">
                  <div className="sketch-title">ЛИЦЕВАЯ СТОРОНА ФАСАДА</div>
                  <div className="sketch-sub">Визуализация примерная</div>
                  <div className="sketch-table">
                    <div className="sketch-row">
                      <div className="sketch-key">Тип профиля</div>
                      <div className="sketch-val">{frameTypeName}</div>
                    </div>
                    <div className="sketch-row">
                      <div className="sketch-key">Цвет</div>
                      <div className="sketch-val">{frameColorMaterial?.name || '—'}</div>
                    </div>
                    <div className="sketch-row">
                      <div className="sketch-key">Наполнение</div>
                      <div className="sketch-val">
                        {selectedType?.name || '—'}
                        {selectedFillingMaterial ? ` — ${selectedFillingMaterial.name}` : ''}
                      </div>
                    </div>
                    <div className="sketch-row">
                      <div className="sketch-key">Размеры</div>
                      <div className="sketch-val">
                        {dims.h}×{dims.w} мм
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Размеры в стиле чертежа (как на шаге 3) */}
              <div className="frame3-dim-drawing frame3-dim-drawing--top">
                <div className="frame3-dim-drawing__value">{widthN ?? '—'} мм</div>
                <div className="frame3-dim-drawing__top-row">
                  <span className="frame3-dim-drawing__ext-v frame3-dim-drawing__ext-v--l" aria-hidden />
                  <div className="frame3-dim-drawing__h">
                    <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--w" />
                    <span className="frame3-dim-drawing__h-line" />
                    <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--e" />
                  </div>
                  <span className="frame3-dim-drawing__ext-v frame3-dim-drawing__ext-v--r" aria-hidden />
                </div>
              </div>

              <div className="frame3-dim-drawing frame3-dim-drawing--left">
                <div className="frame3-dim-drawing__left-col">
                  <div className="frame3-dim-drawing__value frame3-dim-drawing__value--side">{heightN ?? '—'} мм</div>
                  <div className="frame3-dim-drawing__v">
                    <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--n" />
                    <span className="frame3-dim-drawing__v-line" />
                    <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--s" />
                  </div>
                </div>
                <span className="frame3-dim-drawing__ext-h frame3-dim-drawing__ext-h--t" />
                <span className="frame3-dim-drawing__ext-h frame3-dim-drawing__ext-h--b" />
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
          aria-label="Материалы наполнения"
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
                ? 'Выберите материал наполнения для предпросмотра.'
                : 'Выберите материал для предпросмотра или добавьте из справочника.'}
            </p>

            <div className="tiles tiles--colors">
              {(modalType.materials ?? []).map((c) => {
                const active = c.material_id === selectedMaterialId
                return (
                  <div key={c.id} className="tile tile--with-action">
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
                          if (!window.confirm('Убрать этот материал из типа наполнения?')) return
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
                  ? 'Для этого типа наполнения материалы ещё не настроены.'
                  : 'Материалы не добавлены — воспользуйтесь поиском ниже.'}
              </div>
            )}

            {!readOnly && (
              <div className="frame2-modal-add">
                <div className="frame2-block-title">Добавить материалы</div>
                <input
                  className="admin-input"
                  value={modalAddQ}
                  onChange={(e) => setModalAddQ(e.target.value)}
                  placeholder="Поиск по названию или артикулу…"
                />
                {modalAddPicking && <p className="admin-muted">Поиск…</p>}
                {modalAddHit.length > 0 && (
                  <ul className="frame2-checklist">
                    {modalAddHit.map((m) => {
                      const already = (modalType.materials ?? []).some((x) => x.material_id === m.id)
                      return (
                        <li key={m.id}>
                          <label className={`frame2-checkrow ${already ? 'frame2-checkrow--disabled' : ''}`}>
                            <input
                              type="checkbox"
                              disabled={already}
                              checked={already || modalAddIds[m.id] === true}
                              onChange={() =>
                                setModalAddIds((prev) => {
                                  const next = { ...prev }
                                  if (next[m.id]) delete next[m.id]
                                  else next[m.id] = true
                                  return next
                                })
                              }
                            />
                            <span className="frame2-check-article">{m.article || '—'}</span>
                            <span className="frame2-check-name">{m.name}</span>
                            {already && <span className="admin-muted"> (уже в типе)</span>}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="frame2-modal-add-actions">
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={modalSaving || Object.keys(modalAddIds).length === 0}
                    onClick={() => void addModalMaterials()}
                  >
                    Добавить выбранные
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Step4FrameFilling
