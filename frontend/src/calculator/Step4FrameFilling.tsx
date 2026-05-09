import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createCalculatorFillingType,
  deleteCalculatorFillingType,
  fetchCalculatorFillingTypes,
  fetchCalculatorProfileTypes,
  fetchCategoryTree,
  fetchMaterial,
  fetchMaterialClasses,
  updateCalculatorFillingType,
} from '../api'
import { MaterialSearchModal } from '../MaterialSearchModal'
import type { CalculatorFillingType, Material, MaterialCategory, MaterialClass } from '../types'
import { HintButton } from '../HintButton'
import { useCalcPaths } from './calcPathsContext'
import { isFrameStep2Ready, notifyFrameCalcSession, readCalculatorPriceConfigKey, subscribeFrameCalcSession } from './frameCalcSession'
import { MaterialCheckSwatch } from './MaterialCheckSwatch'
import { materialTextureLabel, sketchFillingLine, textureLabelDisplayWrap } from './materialTextureLabel'
import { resolveMediaUrl, materialTextureLayerStyle } from './sketchFrame'
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

function matLabel(m: {
  name: string
  article?: string | null
  texture_mode?: string
  texture_color?: string
  texture_image?: string | null
}) {
  const a = (m.article ?? '').trim()
  const lab = materialTextureLabel(m)
  return a ? `${lab} (${a})` : lab
}

function textureThumb(m: {
  texture_image?: string | null
  texture_color?: string
  texture_mode?: string
  name: string
}) {
  const img = resolveMediaUrl(m.texture_image ?? '')
  const color = (m.texture_color ?? '').trim()
  const alt = materialTextureLabel(m)
  if (img) {
    return (
      <div className="tile-thumb tile-thumb--color">
        <img className="tile-thumb-img" src={img} alt={alt} />
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
  // legacy fallback (если нет параметров текстуры); базовый фон "бумаги" остаётся белым.
  if (!m) return {}
  const c = (m.texture_color ?? '').trim()
  if (c) return { backgroundColor: c }
  return {}
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
  const [createMatHit, setCreateMatHit] = useState<Material[]>([])
  const [createMatIds, setCreateMatIds] = useState<Record<number, true>>({})

  const [editFillingId, setEditFillingId] = useState<number | null>(null)
  const [editFillingName, setEditFillingName] = useState('')
  const [editFillingImageFile, setEditFillingImageFile] = useState<File | null>(null)
  const editFillingImageRef = useRef<HTMLInputElement>(null)
  const [editFillingMatHit, setEditFillingMatHit] = useState<Material[]>([])
  const [editFillingMatIds, setEditFillingMatIds] = useState<Record<number, true>>({})

  const [folderTreeCache, setFolderTreeCache] = useState<MaterialCategory[]>([])
  const [materialClassesCache, setMaterialClassesCache] = useState<MaterialClass[]>([])
  const [materialSearchOverlay, setMaterialSearchOverlay] = useState<null | {
    tree: MaterialCategory[]
    mclasses: MaterialClass[]
  }>(null)
  const materialSearchTargetRef = useRef<'create' | 'edit' | null>(null)

  const closeMaterialSearch = useCallback(() => {
    materialSearchTargetRef.current = null
    setMaterialSearchOverlay(null)
  }, [])

  const openMaterialTreeSearch = useCallback(
    async (target: 'create' | 'edit') => {
      setErr(null)
      try {
        let tree = folderTreeCache
        let mclasses = materialClassesCache
        if (tree.length === 0 || mclasses.length === 0) {
          const [t, mcRes] = await Promise.all([fetchCategoryTree(), fetchMaterialClasses()])
          tree = t
          mclasses = mcRes.results ?? []
          setFolderTreeCache(t)
          setMaterialClassesCache(mclasses)
        }
        materialSearchTargetRef.current = target
        setMaterialSearchOverlay({ tree, mclasses })
      } catch (e) {
        setErr(String(e))
      }
    },
    [folderTreeCache, materialClassesCache]
  )

  const handleMaterialPickedFromTree = useCallback((materials: Material[]) => {
    if (materials.length === 0) return
    const target = materialSearchTargetRef.current
    materialSearchTargetRef.current = null
    setMaterialSearchOverlay(null)
    if (target === 'create') {
      setCreateMatHit((prev) => {
        let next = prev
        for (let i = materials.length - 1; i >= 0; i--) {
          const m = materials[i]!
          if (!next.some((x) => x.id === m.id)) next = [m, ...next]
        }
        return next
      })
      setCreateMatIds((prev) => {
        const next = { ...prev }
        for (const m of materials) next[m.id] = true
        return next
      })
    } else if (target === 'edit') {
      setEditFillingMatHit((prev) => {
        let next = prev
        for (let i = materials.length - 1; i >= 0; i--) {
          const m = materials[i]!
          if (!next.some((x) => x.id === m.id)) next = [m, ...next]
        }
        return next
      })
      setEditFillingMatIds((prev) => {
        const next = { ...prev }
        for (const m of materials) next[m.id] = true
        return next
      })
    }
  }, [])

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
    closeMaterialSearch()
    setEditFillingId(null)
    setEditFillingName('')
    setEditFillingImageFile(null)
    if (editFillingImageRef.current) editFillingImageRef.current.value = ''
    setEditFillingMatIds({})
    setEditFillingMatHit([])
  }

  const openEditFilling = (t: CalculatorFillingType) => {
    closeMaterialSearch()
    setCreateOpen(false)
    setErr(null)
    setEditFillingId(t.id)
    setEditFillingName(t.name)
    setEditFillingImageFile(null)
    if (editFillingImageRef.current) editFillingImageRef.current.value = ''
    const ids: Record<number, true> = {}
    for (const m of t.materials ?? []) ids[m.material_id] = true
    setEditFillingMatIds(ids)
    setEditFillingMatHit([])
    void Promise.all(
      (t.materials ?? []).map((row) => fetchMaterial(row.material_id).catch(() => null))
    ).then((rows) => {
      setEditFillingMatHit(rows.filter((x): x is Material => x != null))
    })
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
      setCreateMatHit([])
      setCreateMatIds({})
      closeMaterialSearch()
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

  // Для параметров текстуры (opacity/offset/step/rotate/mirror) нужен полный материал, а не summary в составе типа.
  const [selectedFillingMaterialFull, setSelectedFillingMaterialFull] = useState<Material | null>(null)
  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!selectedMaterialId) {
        setSelectedFillingMaterialFull(null)
        return
      }
      try {
        const m = await fetchMaterial(selectedMaterialId)
        if (!cancel) setSelectedFillingMaterialFull(m)
      } catch {
        if (!cancel) setSelectedFillingMaterialFull(null)
      }
    })()
    return () => {
      cancel = true
    }
  }, [selectedMaterialId])

  useEffect(() => {
    const ids = new Set<number>()
    for (const c of modalType?.materials ?? []) {
      const cm = c.material as any
      const has = (cm?.texture_color ?? '').trim() || (cm?.texture_image ?? '')
      if (!has) ids.add(c.material_id)
    }
    for (const m of [...createMatHit, ...editFillingMatHit]) {
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
  }, [modalType, createMatHit, editFillingMatHit, texByMaterialId])

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
                      closeMaterialSearch()
                      setCreateOpen(false)
                      setCreateName('')
                      setCreateImageFile(null)
                      if (cardImageInputRef.current) cardImageInputRef.current.value = ''
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
              <div className="frame2-create-grid frame2-create-grid--file-status-pair">
                <div className="frame2-block frame2-create-tl">
                  <div className="frame2-block-title">Тип наполнения</div>
                  <input
                    className="admin-input"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Например: Лакобель, Мателюкс…"
                  />
                  <div className="frame2-file-row">
                    <div className="frame2-file-label-row">
                      <label className="frame2-file-label" htmlFor="filling-type-card-image">
                        Изображение для карточки
                      </label>
                      <HintButton text="Выберите изображение с компьютера. Обычно в диалоге можно открыть «Рабочий стол». Поддерживаются форматы изображений (PNG/JPG/WebP и т.п.)." />
                    </div>
                    <input
                      id="filling-type-card-image"
                      ref={cardImageInputRef}
                      className="frame2-file-input frame2-file-input--sr"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCreateImageFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <div className="frame2-block frame2-create-tr">
                  <div className="frame2-block-title">Материалы</div>
                  <div className="frame2-material-search-row">
                    <button
                      type="button"
                      className="admin-secondary frame2-material-tree-search-btn"
                      onClick={() => void openMaterialTreeSearch('create')}
                    >
                      Поиск
                    </button>
                  </div>
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
                            className={[
                              'frame2-checkrow',
                              createMatIds[m.id] ? 'frame2-checkrow--checked' : '',
                            ]
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
                              <MaterialCheckSwatch
                                name={materialTextureLabel(m)}
                                material={m}
                                texExtra={texByMaterialId[m.id]}
                              />
                              <span className="frame2-check-name-wrap">
                                <span className="frame2-check-name">{materialTextureLabel(m)}</span>
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
              <div className="frame2-create-grid frame2-create-grid--file-status-pair">
                <div className="frame2-block frame2-create-tl">
                  <div className="frame2-block-title">Тип наполнения</div>
                  <input
                    className="admin-input"
                    value={editFillingName}
                    onChange={(e) => setEditFillingName(e.target.value)}
                    placeholder="Название…"
                  />
                  <div className="frame2-file-row">
                    <div className="frame2-file-label-row">
                      <label className="frame2-file-label" htmlFor="filling-type-card-image-edit">
                        Новое изображение (необязательно)
                      </label>
                      <HintButton text="Оставьте поле пустым, чтобы сохранить текущую картинку. Если выбрать файл — он заменит текущую картинку." />
                    </div>
                    <input
                      id="filling-type-card-image-edit"
                      ref={editFillingImageRef}
                      className="frame2-file-input frame2-file-input--sr"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditFillingImageFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <div className="frame2-block frame2-create-tr">
                  <div className="frame2-block-title">Материалы</div>
                  <div className="frame2-material-search-row">
                    <button
                      type="button"
                      className="admin-secondary frame2-material-tree-search-btn"
                      onClick={() => void openMaterialTreeSearch('edit')}
                    >
                      Поиск
                    </button>
                  </div>
                </div>
                <div className="frame2-create-ml">
                  <div className="frame2-file-picker-row frame2-file-picker-row--solo">
                    <button
                      type="button"
                      className="admin-secondary frame2-file-btn"
                      onClick={() => editFillingImageRef.current?.click()}
                    >
                      {editFillingImageFile ? 'Изменить файл…' : 'Выбрать файл…'}
                    </button>
                  </div>
                </div>
                <div className="frame2-create-mr">
                  <div
                    className={[
                      'frame2-file-name',
                      editFillingImageFile ? '' : 'frame2-file-name--empty',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-live="polite"
                  >
                    {editFillingImageFile ? editFillingImageFile.name : 'Файл не выбран'}
                  </div>
                </div>
                <div className="frame2-create-bl">
                  {(editFillingImagePreview || editFillingExistingCardUrl) && (
                    <div className="frame2-file-preview frame2-file-preview--cover">
                      <img src={editFillingImagePreview || editFillingExistingCardUrl} alt="" />
                    </div>
                  )}
                </div>
                <div className="frame2-create-br">
                  {editFillingMatHit.length > 0 && (
                    <ul className="frame2-checklist">
                      {editFillingMatHit.map((m) => (
                        <li key={m.id}>
                          <label
                            className={[
                              'frame2-checkrow',
                              editFillingMatIds[m.id] ? 'frame2-checkrow--checked' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            title={matLabel(m)}
                          >
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
                              <MaterialCheckSwatch
                                name={materialTextureLabel(m)}
                                material={m}
                                texExtra={texByMaterialId[m.id]}
                              />
                              <span className="frame2-check-name-wrap">
                                <span className="frame2-check-name">{materialTextureLabel(m)}</span>
                              </span>
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
            <button
              type="button"
              className="admin-primary"
              disabled={selectedMaterialId == null}
              onClick={() => {
                if (selectedMaterialId != null) nav(step('frame/summary'))
              }}
              title={selectedMaterialId == null ? 'Сначала выберите материал наполнения' : undefined}
            >
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
                <div className="sketch-frame">
                  <div className="sketch-frame-texture" style={materialTextureLayerStyle(frameColorMaterial)} />
                </div>
                <div className="sketch-paper" style={fillingPaperStyle((selectedFillingMaterialFull ?? selectedFillingMaterial) as Material)}>
                  <div
                    className="sketch-paper-texture"
                    style={materialTextureLayerStyle((selectedFillingMaterialFull ?? selectedFillingMaterial) as any)}
                  />
                </div>
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
                      <div className="sketch-val sketch-val--texture-wrap">
                        {textureLabelDisplayWrap(materialTextureLabel(frameColorMaterial))}
                      </div>
                    </div>
                    <div className="sketch-row">
                      <div className="sketch-key">Наполнение</div>
                      <div className="sketch-val sketch-val--texture-wrap">
                        {textureLabelDisplayWrap(
                          sketchFillingLine(
                            selectedType?.name,
                            (selectedFillingMaterialFull ?? selectedFillingMaterial) as Material | null,
                          ),
                        )}
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
                        texture_mode: (c.material as any).texture_mode,
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
                      <div className="tile-title">{materialTextureLabel(c.material)}</div>
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
                  : 'Материалы не добавлены — укажите их при создании типа или в «Редактировать тип» (⚙).'}
              </div>
            )}
          </div>
        </div>
      )}

      {materialSearchOverlay && (
        <MaterialSearchModal
          tree={materialSearchOverlay.tree}
          mclasses={materialSearchOverlay.mclasses}
          onClose={closeMaterialSearch}
          onPick={handleMaterialPickedFromTree}
        />
      )}
    </>
  )
}

export default Step4FrameFilling
