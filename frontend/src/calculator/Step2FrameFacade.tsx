import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  createCalculatorProfileType,
  deleteCalculatorProfileType,
  fetchCalculatorProfileTypes,
  fetchCategoryTree,
  fetchMaterial,
  fetchMaterialClasses,
  updateCalculatorProfileType,
} from '../api'
import { MaterialSearchModal } from '../MaterialSearchModal'
import type { CalculatorProfileType, Material, MaterialCategory, MaterialClass } from '../types'
import { HintButton } from '../HintButton'
import { useCalcPaths } from './calcPathsContext'
import {
  FRAME_DEFAULT_HEIGHT_MM,
  FRAME_DEFAULT_WIDTH_MM,
  notifyFrameCalcSession,
  readFrameDimsMm,
  subscribeFrameCalcSession,
} from './frameCalcSession'
import { MaterialCheckSwatch } from './MaterialCheckSwatch'
import { materialTextureLabel, textureLabelDisplayWrap } from './materialTextureLabel'
import { facadeSketchBoxStyle, resolveMediaUrl, materialTextureLayerStyle } from './sketchFrame'
import './Step2FrameFacade.css'

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

  const [createColorsHit, setCreateColorsHit] = useState<Material[]>([])
  const [createColors, setCreateColors] = useState<Record<number, ColorFlags>>({})
  const [calcSessionHydrated, setCalcSessionHydrated] = useState(false)

  const [editTypeId, setEditTypeId] = useState<number | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [editTypeImageFile, setEditTypeImageFile] = useState<File | null>(null)
  const editImageInputRef = useRef<HTMLInputElement>(null)
  const [editColorsHit, setEditColorsHit] = useState<Material[]>([])
  const [editColors, setEditColors] = useState<Record<number, ColorFlags>>({})

  const [gearMenuTypeId, setGearMenuTypeId] = useState<number | null>(null)
  const gearMenuWrapRef = useRef<HTMLDivElement | null>(null)
  const [profileTypeDeleteModal, setProfileTypeDeleteModal] = useState<CalculatorProfileType | null>(null)

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
    const flags: ColorFlags = { is_new: false, is_hit: false, is_sale: false }
    if (target === 'create') {
      setCreateColorsHit((prev) => {
        let next = prev
        for (let i = materials.length - 1; i >= 0; i--) {
          const m = materials[i]!
          if (!next.some((x) => x.id === m.id)) next = [m, ...next]
        }
        return next
      })
      setCreateColors((prev) => {
        const next = { ...prev }
        for (const m of materials) {
          if (next[m.id] == null) next[m.id] = flags
        }
        return next
      })
    } else if (target === 'edit') {
      setEditColorsHit((prev) => {
        let next = prev
        for (let i = materials.length - 1; i >= 0; i--) {
          const m = materials[i]!
          if (!next.some((x) => x.id === m.id)) next = [m, ...next]
        }
        return next
      })
      setEditColors((prev) => {
        const next = { ...prev }
        for (const m of materials) {
          if (next[m.id] == null) next[m.id] = flags
        }
        return next
      })
    }
  }, [])

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
    closeMaterialSearch()
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
    setEditColorsHit([])
    void Promise.all(
      (t.colors ?? []).map((c) => fetchMaterial(c.color_material_id).catch(() => null))
    ).then((rows) => {
      setEditColorsHit(rows.filter((x): x is Material => x != null))
    })
  }

  const closeEditType = () => {
    closeMaterialSearch()
    setEditTypeId(null)
    setEditTypeName('')
    setEditTypeImageFile(null)
    if (editImageInputRef.current) editImageInputRef.current.value = ''
    setEditColors({})
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
      setCreateColorsHit([])
      setCreateColors({})
      closeMaterialSearch()
    } catch (e) {
      setErr(String(e))
    }
  }

  const confirmDeleteProfileType = useCallback(() => {
    const selected = profileTypeDeleteModal
    if (!selected) return
    setProfileTypeDeleteModal(null)
    setErr(null)
    deleteCalculatorProfileType(selected.id)
      .then(() => {
        setProfileTypes((prev) => prev.filter((p) => p.id !== selected.id))
        setSelectedTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setModalTypeId((prevSel) => (prevSel === selected.id ? null : prevSel))
        setEditTypeId((prev) => (prev === selected.id ? null : prev))
      })
      .catch((e) => setErr(String(e)))
  }, [profileTypeDeleteModal])

  const cancelDeleteProfileType = useCallback(() => {
    setProfileTypeDeleteModal(null)
  }, [])

  useEffect(() => {
    if (gearMenuTypeId == null) {
      gearMenuWrapRef.current = null
      return
    }
    const onDoc = (e: MouseEvent) => {
      if (gearMenuWrapRef.current && !gearMenuWrapRef.current.contains(e.target as Node)) {
        setGearMenuTypeId(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGearMenuTypeId(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [gearMenuTypeId])

  useEffect(() => {
    if (!profileTypeDeleteModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setProfileTypeDeleteModal(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [profileTypeDeleteModal])

  useEffect(() => {
    if (editTypeId == null) return
    if (!profileTypes.some((p) => p.id === editTypeId)) {
      setEditTypeId(null)
      setEditTypeName('')
      setEditTypeImageFile(null)
      if (editImageInputRef.current) editImageInputRef.current.value = ''
      setEditColors({})
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

  // Снимок — примитив (строка), иначе useSyncExternalStore каждый раз видит новый объект и уходит в бесконечный ререндер.
  const sketchDimsKey = useSyncExternalStore(
    subscribeFrameCalcSession,
    () => {
      const d = readFrameDimsMm()
      const h = d.h ?? FRAME_DEFAULT_HEIGHT_MM
      const w = d.w ?? FRAME_DEFAULT_WIDTH_MM
      return `${h}|${w}`
    },
    () => `${FRAME_DEFAULT_HEIGHT_MM}|${FRAME_DEFAULT_WIDTH_MM}`
  )

  const step2SketchBoxStyle = useMemo(() => {
    const [hs, ws] = sketchDimsKey.split('|')
    const h = Number(hs)
    const w = Number(ws)
    if (!Number.isFinite(h) || !Number.isFinite(w)) {
      return facadeSketchBoxStyle(FRAME_DEFAULT_HEIGHT_MM, FRAME_DEFAULT_WIDTH_MM)
    }
    return facadeSketchBoxStyle(h, w)
  }, [sketchDimsKey])

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
                      closeMaterialSearch()
                      setCreateOpen(false)
                      setCreateTypeName('')
                      setCreateTypeImageFile(null)
                      if (cardImageInputRef.current) cardImageInputRef.current.value = ''
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

              <div className="frame2-create-grid frame2-create-grid--file-status-pair">
                <div className="frame2-block frame2-create-tl">
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
                  </div>
                </div>

                <div className="frame2-block frame2-create-tr">
                  <div className="frame2-block-title">Цвета (материалы)</div>
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
                      {createTypeImageFile ? 'Изменить файл…' : 'Выбрать файл…'}
                    </button>
                  </div>
                </div>
                <div className="frame2-create-mr">
                  <div
                    className={[
                      'frame2-file-name',
                      createTypeImageFile ? '' : 'frame2-file-name--empty',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-live="polite"
                  >
                    {createTypeImageFile ? createTypeImageFile.name : 'Файл не выбран'}
                  </div>
                </div>

                <div className="frame2-create-bl">
                  {createTypeImagePreview && (
                    <div className="frame2-file-preview frame2-file-preview--cover">
                      <img src={createTypeImagePreview} alt="" />
                    </div>
                  )}
                </div>
                <div className="frame2-create-br">
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
                                name={materialTextureLabel(m)}
                                material={m}
                                texExtra={texByMaterialId[m.id]}
                              />
                              <span className="frame2-check-name-wrap">
                                <span className="frame2-check-name">{materialTextureLabel(m)}</span>
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

              <div className="frame2-create-grid frame2-create-grid--file-status-pair">
                <div className="frame2-block frame2-create-tl">
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
                  </div>
                </div>

                <div className="frame2-block frame2-create-tr">
                  <div className="frame2-block-title">Цвета (материалы)</div>
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
                      onClick={() => editImageInputRef.current?.click()}
                    >
                      {editTypeImageFile ? 'Изменить файл…' : 'Выбрать файл…'}
                    </button>
                  </div>
                </div>
                <div className="frame2-create-mr">
                  <div
                    className={[
                      'frame2-file-name',
                      editTypeImageFile ? '' : 'frame2-file-name--empty',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-live="polite"
                  >
                    {editTypeImageFile ? editTypeImageFile.name : 'Файл не выбран'}
                  </div>
                </div>

                <div className="frame2-create-bl">
                  {(editTypeImagePreview || editExistingCardUrl) && (
                    <div className="frame2-file-preview frame2-file-preview--cover">
                      <img src={editTypeImagePreview || editExistingCardUrl} alt="" />
                    </div>
                  )}
                </div>
                <div className="frame2-create-br">
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
                                name={materialTextureLabel(m)}
                                material={m}
                                texExtra={texByMaterialId[m.id]}
                              />
                              <span className="frame2-check-name-wrap">
                                <span className="frame2-check-name">{materialTextureLabel(m)}</span>
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
                    <div
                      className="tile-gear-wrap"
                      ref={(node) => {
                        if (gearMenuTypeId === t.id) gearMenuWrapRef.current = node
                      }}
                    >
                      <div className="tree-line-actions tile-gear-menu-anchor">
                        <button
                          type="button"
                          className="tree-gear-btn"
                          title="Действия с типом профиля"
                          aria-label={`Действия с типом «${title}»: редактировать или удалить`}
                          aria-haspopup="menu"
                          aria-expanded={gearMenuTypeId === t.id}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setGearMenuTypeId((id) => (id === t.id ? null : t.id))
                          }}
                        >
                          <span className="tree-gear-ico" aria-hidden>
                            ⚙
                          </span>
                        </button>
                        {gearMenuTypeId === t.id && (
                          <ul className="tree-gear-menu" role="menu">
                            <li role="none">
                              <button
                                type="button"
                                role="menuitem"
                                className="tree-gear-menu-item"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setGearMenuTypeId(null)
                                  openEditType(t)
                                }}
                              >
                                Редактировать
                              </button>
                            </li>
                            <li role="none">
                              <button
                                type="button"
                                role="menuitem"
                                className="tree-gear-menu-item tree-gear-menu-item--danger"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setGearMenuTypeId(null)
                                  setProfileTypeDeleteModal(t)
                                }}
                              >
                                Удалить
                              </button>
                            </li>
                          </ul>
                        )}
                      </div>
                    </div>
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
            <div className="sketch" style={step2SketchBoxStyle}>
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
                    <div className="sketch-val sketch-val--texture-wrap">
                      {textureLabelDisplayWrap(
                        materialTextureLabel(selectedColorMaterialFull ?? selectedColorMaterial),
                      )}
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
                        texture_mode: (c.color_material as any).texture_mode,
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
                      <div className="tile-title tile-title--texture-wrap">
                        {textureLabelDisplayWrap(materialTextureLabel(c.color_material))}
                      </div>
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
                          setRemoveColorConfirm({
                            id: c.color_material_id,
                            name: materialTextureLabel(c.color_material),
                          })
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

      {materialSearchOverlay && (
        <MaterialSearchModal
          tree={materialSearchOverlay.tree}
          mclasses={materialSearchOverlay.mclasses}
          onClose={closeMaterialSearch}
          onPick={handleMaterialPickedFromTree}
        />
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

      {profileTypeDeleteModal &&
        createPortal(
          <div
            className="admin-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-type-delete-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelDeleteProfileType()
            }}
          >
            <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
              <h4 id="profile-type-delete-title" className="admin-modal-title">
                Удалить тип профиля?
              </h4>
              <p className="admin-modal-text">
                Тип профиля «{profileTypeDeleteModal.name || `Тип #${profileTypeDeleteModal.id}`}» будет удалён
                безвозвратно вместе со списком цветов, привязанных к этому типу в калькуляторе. Продолжить?
              </p>
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary" onClick={cancelDeleteProfileType}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="admin-primary admin-modal-confirm"
                  onClick={confirmDeleteProfileType}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default Step2FrameFacade
