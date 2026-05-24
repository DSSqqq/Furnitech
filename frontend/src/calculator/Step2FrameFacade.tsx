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
import { CalcStepPriceTotals } from './CalcPriceTotals'
import {
  FRAME_DEFAULT_HEIGHT_MM,
  FRAME_DEFAULT_WIDTH_MM,
  frameDimDefaultsFromMaterial,
  notifyFrameCalcSession,
  readFrameDimsMm,
  seedFrameDimsFromMaterial,
  subscribeFrameCalcSession,
} from './frameCalcSession'
import { MaterialCheckSwatch } from './MaterialCheckSwatch'
import {
  materialTextureLabel,
  textureLabelDisplayWrap,
  type MaterialTextureFields,
} from './materialTextureLabel'
import {
  CalculatorCardTileStriped,
  ProfileCardImageTileRow,
  appendCalcCardImagesToFormData,
  calcCardImageGridSlots,
  calcCardImageTileUrls,
  calcCardImageUrlsFromEntity,
  emptyCalcCardImageFiles,
  type CalcCardImageFiles,
} from './calculatorCardTiles'
import { TileGearMenu } from './TileGearMenu'
import { facadeSketchBoxStyle, resolveMediaUrl, materialTextureLayerStyle } from './sketchFrame'
import './Step2FrameFacade.css'
import './Step3FrameSizes.css'

function matLabel(m: MaterialTextureFields & { article?: string | null }) {
  const a = (m.article ?? '').trim()
  const lab = materialTextureLabel(m)
  return a ? `${lab} (${a})` : lab
}

function textureThumb(m: MaterialTextureFields & { name: string }) {
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
    Record<
      number,
      {
        texture_mode?: string
        texture_color?: string
        texture_image?: string | null
        texture_library_item_name?: string | null
        name?: string
      }
    >
  >({})

  const [createOpen, setCreateOpen] = useState(false)
  const [createTypeName, setCreateTypeName] = useState('')
  const [createCardFiles, setCreateCardFiles] = useState<CalcCardImageFiles>(emptyCalcCardImageFiles())
  const cardImageInputRef0 = useRef<HTMLInputElement>(null)
  const cardImageInputRef1 = useRef<HTMLInputElement>(null)
  const cardImageInputRef2 = useRef<HTMLInputElement>(null)
  const cardImageInputRef3 = useRef<HTMLInputElement>(null)

  const [createColorsHit, setCreateColorsHit] = useState<Material[]>([])
  const [createColors, setCreateColors] = useState<Record<number, ColorFlags>>({})
  const [calcSessionHydrated, setCalcSessionHydrated] = useState(false)

  const [editTypeId, setEditTypeId] = useState<number | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [editCardFiles, setEditCardFiles] = useState<CalcCardImageFiles>(emptyCalcCardImageFiles())
  const editImageInputRef0 = useRef<HTMLInputElement>(null)
  const editImageInputRef1 = useRef<HTMLInputElement>(null)
  const editImageInputRef2 = useRef<HTMLInputElement>(null)
  const editImageInputRef3 = useRef<HTMLInputElement>(null)
  const [editColorsHit, setEditColorsHit] = useState<Material[]>([])
  const [editColors, setEditColors] = useState<Record<number, ColorFlags>>({})

  const [gearMenuTypeId, setGearMenuTypeId] = useState<number | null>(null)
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
            texture_mode: r.m.texture_mode,
            texture_color: r.m.texture_color,
            texture_image: r.m.texture_image ?? null,
            texture_library_item_name: r.m.texture_library_item_name ?? null,
            name: r.m.name,
          }
        }
        return next
      })
    })
  }, [createColorsHit, editColorsHit, texByMaterialId])

  const createPreview0 = useMemo(
    () => (createCardFiles[0] ? URL.createObjectURL(createCardFiles[0]) : ''),
    [createCardFiles[0]],
  )
  const createPreview1 = useMemo(
    () => (createCardFiles[1] ? URL.createObjectURL(createCardFiles[1]) : ''),
    [createCardFiles[1]],
  )
  const createPreview2 = useMemo(
    () => (createCardFiles[2] ? URL.createObjectURL(createCardFiles[2]) : ''),
    [createCardFiles[2]],
  )
  const createPreview3 = useMemo(
    () => (createCardFiles[3] ? URL.createObjectURL(createCardFiles[3]) : ''),
    [createCardFiles[3]],
  )

  useEffect(() => {
    return () => {
      for (const u of [createPreview0, createPreview1, createPreview2, createPreview3]) {
        if (u) URL.revokeObjectURL(u)
      }
    }
  }, [createPreview0, createPreview1, createPreview2, createPreview3])

  const editingType = useMemo(
    () => (editTypeId != null ? profileTypes.find((p) => p.id === editTypeId) ?? null : null),
    [editTypeId, profileTypes]
  )

  const editSlotExistingResolved = useMemo(() => {
    if (!editingType) return calcCardImageUrlsFromEntity({})
    return calcCardImageUrlsFromEntity(editingType)
  }, [editingType])

  const editBlob0 = useMemo(
    () => (editCardFiles[0] ? URL.createObjectURL(editCardFiles[0]) : ''),
    [editCardFiles[0]],
  )
  const editBlob1 = useMemo(
    () => (editCardFiles[1] ? URL.createObjectURL(editCardFiles[1]) : ''),
    [editCardFiles[1]],
  )
  const editBlob2 = useMemo(
    () => (editCardFiles[2] ? URL.createObjectURL(editCardFiles[2]) : ''),
    [editCardFiles[2]],
  )
  const editBlob3 = useMemo(
    () => (editCardFiles[3] ? URL.createObjectURL(editCardFiles[3]) : ''),
    [editCardFiles[3]],
  )

  useEffect(() => {
    return () => {
      for (const u of [editBlob0, editBlob1, editBlob2, editBlob3]) {
        if (u) URL.revokeObjectURL(u)
      }
    }
  }, [editBlob0, editBlob1, editBlob2, editBlob3])

  const editCardTileUrls = useMemo(
    () =>
      calcCardImageTileUrls(editCardFiles, [editBlob0, editBlob1, editBlob2, editBlob3], editSlotExistingResolved),
    [
      editBlob0,
      editBlob1,
      editBlob2,
      editBlob3,
      editCardFiles,
      editSlotExistingResolved,
    ],
  )

  const openEditType = (t: CalculatorProfileType) => {
    closeMaterialSearch()
    setCreateOpen(false)
    setErr(null)
    setEditTypeId(t.id)
    setEditTypeName(t.name)
    setEditCardFiles(emptyCalcCardImageFiles())
    for (const r of [editImageInputRef0, editImageInputRef1, editImageInputRef2, editImageInputRef3]) {
      if (r.current) r.current.value = ''
    }
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
    setEditCardFiles(emptyCalcCardImageFiles())
    for (const r of [editImageInputRef0, editImageInputRef1, editImageInputRef2, editImageInputRef3]) {
      if (r.current) r.current.value = ''
    }
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
      const hasNewCardImages = editCardFiles.some(Boolean)
      if (hasNewCardImages) {
        const fd = new FormData()
        fd.append('name', name)
        fd.append('is_active', String(t.is_active))
        fd.append('sort_order', String(t.sort_order))
        fd.append('colors', JSON.stringify(colors))
        appendCalcCardImagesToFormData(fd, editCardFiles)
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
      appendCalcCardImagesToFormData(fd, createCardFiles)
      const created = await createCalculatorProfileType(fd)
      setProfileTypes((prev) => [...prev, created])
      setSelectedTypeId(created.id)
      setCreateOpen(false)
      setCreateTypeName('')
      setCreateCardFiles(emptyCalcCardImageFiles())
      for (const r of [cardImageInputRef0, cardImageInputRef1, cardImageInputRef2, cardImageInputRef3]) {
        if (r.current) r.current.value = ''
      }
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
      setEditCardFiles(emptyCalcCardImageFiles())
      for (const r of [editImageInputRef0, editImageInputRef1, editImageInputRef2, editImageInputRef3]) {
        if (r.current) r.current.value = ''
      }
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
            texture_mode: r.m.texture_mode,
            texture_color: r.m.texture_color,
            texture_image: r.m.texture_image ?? null,
            texture_library_item_name: r.m.texture_library_item_name ?? null,
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
      texture_mode: base.texture_mode ?? fallback.texture_mode,
      texture_color: base.texture_color || fallback.texture_color,
      texture_image: base.texture_image || fallback.texture_image,
      texture_library_item_name:
        base.texture_library_item_name ?? fallback.texture_library_item_name ?? null,
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
        if (!cancel) {
          seedFrameDimsFromMaterial(m)
          setSelectedColorMaterialFull(m)
        }
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
    const d = readFrameDimsMm()
    const fallback = frameDimDefaultsFromMaterial(selectedColorMaterialFull)
    const h = d.h ?? fallback.heightMm
    const w = d.w ?? fallback.widthMm
    return facadeSketchBoxStyle(h, w)
  }, [sketchDimsKey, selectedColorMaterialFull])

  return (
    <>
      <div className="frame2">
        <section className="frame2-card calc-side-panel">
          <div className="admin-heading-row calc-card-title-row">
            <div className="frame3-title" role="heading" aria-level={3}>
              Выберите тип профиля и цвет
            </div>
            {!readOnly ? (
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
            ) : null}
          </div>

          {err && <div className="admin-error">{err}</div>}
          {loading && <p className="admin-muted">Загрузка…</p>}

          <div className="calc-side-panel-scroll">
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
                      setCreateCardFiles(emptyCalcCardImageFiles())
                      for (const r of [cardImageInputRef0, cardImageInputRef1, cardImageInputRef2, cardImageInputRef3]) {
                        if (r.current) r.current.value = ''
                      }
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

              <div className="frame2-create-grid frame2-create-grid--file-status-pair frame2-create-grid--profile-type-slim">
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
                      <span className="frame2-file-label">Изображения для карточки (до 4)</span>
                      <HintButton text="До четырёх фото на один тип профиля. Нажмите плитку, чтобы выбрать файл. В списке типов под превью — полоски: наведите, чтобы переключить кадр. PNG, JPG, WebP и др." />
                    </div>
                    {(
                      [
                        [0, cardImageInputRef0],
                        [1, cardImageInputRef1],
                        [2, cardImageInputRef2],
                        [3, cardImageInputRef3],
                      ] as const
                    ).map(([slot, refEl]) => (
                      <input
                        key={slot}
                        id={`profile-type-card-image-${slot}`}
                        ref={refEl}
                        className="frame2-file-input frame2-file-input--sr"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setCreateCardFiles((prev) => {
                            const next: CalcCardImageFiles = [...prev]
                            next[slot] = e.target.files?.[0] ?? null
                            return next
                          })
                        }}
                      />
                    ))}
                  </div>
                  <ProfileCardImageTileRow
                    urls={[createPreview0, createPreview1, createPreview2, createPreview3]}
                    inputRefs={[cardImageInputRef0, cardImageInputRef1, cardImageInputRef2, cardImageInputRef3]}
                  />
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
                  <div className="frame2-file-row frame2-colors-for-card-label">
                    <div className="frame2-file-label-row">
                      <span className="frame2-file-label">Цвета для карточки</span>
                      <HintButton text="Отметьте материалы, которые будут доступны как цвета этого типа в калькуляторе. Добавляйте через «Поиск»." />
                    </div>
                  </div>
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

              <div className="frame2-create-grid frame2-create-grid--file-status-pair frame2-create-grid--profile-type-slim">
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
                      <span className="frame2-file-label">Карточка: до 4 фото</span>
                      <HintButton text="Нажмите плитку, чтобы заменить фото в слоте. Пустой слот при сохранении не меняет уже загруженное изображение." />
                    </div>
                    {(
                      [
                        [0, editImageInputRef0],
                        [1, editImageInputRef1],
                        [2, editImageInputRef2],
                        [3, editImageInputRef3],
                      ] as const
                    ).map(([slot, refEl]) => (
                      <input
                        key={slot}
                        id={`profile-type-card-image-edit-${slot}`}
                        ref={refEl}
                        className="frame2-file-input frame2-file-input--sr"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setEditCardFiles((prev) => {
                            const next: CalcCardImageFiles = [...prev]
                            next[slot] = e.target.files?.[0] ?? null
                            return next
                          })
                        }}
                      />
                    ))}
                  </div>
                  <ProfileCardImageTileRow
                    urls={editCardTileUrls}
                    inputRefs={[editImageInputRef0, editImageInputRef1, editImageInputRef2, editImageInputRef3]}
                  />
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
                  <div className="frame2-file-row frame2-colors-for-card-label">
                    <div className="frame2-file-label-row">
                      <span className="frame2-file-label">Цвета для карточки</span>
                      <HintButton text="Отметьте материалы, которые будут доступны как цвета этого типа в калькуляторе. Добавляйте через «Поиск»." />
                    </div>
                  </div>
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
                    <CalculatorCardTileStriped
                      title={title}
                      versionKey={t.id}
                      {...calcCardImageGridSlots(t)}
                    />
                    <div className="tile-title">{title}</div>
                    <div className="tile-sub">Цветов: {(t.colors ?? []).length}</div>
                  </button>
                  {!readOnly && (
                    <TileGearMenu
                      open={gearMenuTypeId === t.id}
                      onToggle={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setGearMenuTypeId((id) => (id === t.id ? null : t.id))
                      }}
                      onClose={() => setGearMenuTypeId(null)}
                      onEdit={() => {
                        setGearMenuTypeId(null)
                        openEditType(t)
                      }}
                      onDelete={() => {
                        setGearMenuTypeId(null)
                        setProfileTypeDeleteModal(t)
                      }}
                      ariaLabel={`Действия с типом «${title}»: редактировать или удалить`}
                      gearTitle="Действия с типом профиля"
                    />
                  )}
                </div>
              )
            })}
          </div>
          <CalcStepPriceTotals />
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
                const ex = texByMaterialId[c.color_material_id]
                const cm = c.color_material
                const merged: MaterialTextureFields & {
                  name: string
                  article?: string
                } = {
                  ...cm,
                  texture_mode: cm.texture_mode ?? ex?.texture_mode,
                  texture_color: cm.texture_color || ex?.texture_color || '',
                  texture_image: cm.texture_image ?? ex?.texture_image ?? null,
                  texture_library_item_name: cm.texture_library_item_name ?? ex?.texture_library_item_name ?? null,
                  name: cm.name || ex?.name || '',
                  article: cm.article,
                }
                return (
                  <div key={c.id} className="tile-cell">
                    <button
                      type="button"
                      className={active ? 'tile tile--active tile--fill' : 'tile tile--fill'}
                      onClick={() => {
                        setSelectedColorId(c.color_material_id)
                        setModalTypeId(null)
                      }}
                      title={matLabel(merged)}
                    >
                      {textureThumb(merged)}
                      <div className="tile-title tile-title--texture-wrap">
                        {textureLabelDisplayWrap(materialTextureLabel(merged))}
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
