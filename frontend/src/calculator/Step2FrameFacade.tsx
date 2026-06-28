import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  createCalculatorProfileType,
  deleteCalculatorProfileType,
  fetchCalculatorFillingTypes,
  fetchCalculatorHingeTypes,
  fetchCalculatorProfileTypes,
  fetchCategoryTree,
  fetchMaterial,
  fetchMaterialClasses,
  updateCalculatorProfileType,
} from '../api'
import { MaterialSearchModal } from '../MaterialSearchModal'
import { TexturePickerModal } from '../TexturePickerModal'
import type { CalculatorProfileType, Material, MaterialCategory, MaterialClass } from '../types'
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
import { mergeFrameColorMaterial } from './useFrameColorMaterial'
import {
  materialTextureLabel,
  textureLabelDisplayWrap,
  type MaterialTextureFields,
} from './materialTextureLabel'
import {
  CalculatorCardTileStriped,
  PROFILE_CARD_IMAGE_SLOT_COUNT,
  appendProfileCardImagesToFormData,
  appendProfileCardTexturesToFormData,
  calcCardImageGridSlots,
  calcCardImageTileUrls,
  calcCardImageUrlsFromEntity,
  emptyCardImageUrls,
  emptyProfileCardImageFiles,
  emptyProfileCardTextureIds,
} from './calculatorCardTiles'
import {
  resetCardImageArrays,
  useCardFilePreviewUrls,
  useCardImageFormHandlers,
} from './cardImageFormHelpers'
import { TileGearMenu } from './TileGearMenu'
import { CalculatorTypeFormModal } from '../CalculatorTypeFormModal'
import { ProfileTypeFormGrid, defaultProfileColorEntry, isAttachedEntryActive, type ProfileColorEntry } from './CalculatorTypeFormGrid'
import { usePanelLoading } from '../AdminPanelLoadingHost'
import {
  collectCalcCardImageUrls,
  useCalcImagesPreload,
  useCalcMaterialTexturePreload,
} from './calcStepAssetsLoading'
import { facadeSketchBoxStyle, profileFrameTextureLayerStyle, resolveMediaUrl } from './sketchFrame'
import './Step2FrameFacade.css'
import './Step3FrameSizes.css'

const MODAL_CLOSE_X_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

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
        <img className="tile-thumb-img" src={img} alt={alt} loading="lazy" decoding="async" />
      </div>
    )
  }
  return <div className="tile-thumb" style={color ? { backgroundColor: color } : undefined} />
}

function activeProfileTypeColors(colors: CalculatorProfileType['colors']) {
  return (colors ?? []).filter((c) => c.is_active !== false)
}

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
  const [createCardFiles, setCreateCardFiles] = useState<(File | null)[]>(emptyProfileCardImageFiles())
  const [createCardTextures, setCreateCardTextures] = useState<(number | null)[]>(emptyProfileCardTextureIds())
  const [createCardTextureUrls, setCreateCardTextureUrls] = useState<string[]>(
    emptyCardImageUrls(PROFILE_CARD_IMAGE_SLOT_COUNT),
  )

  const [createColorsHit, setCreateColorsHit] = useState<Material[]>([])
  const [createColors, setCreateColors] = useState<Record<number, ProfileColorEntry>>({})
  const [calcSessionHydrated, setCalcSessionHydrated] = useState(false)

  const [editTypeId, setEditTypeId] = useState<number | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [editCardFiles, setEditCardFiles] = useState<(File | null)[]>(emptyProfileCardImageFiles())
  const [editCardTextures, setEditCardTextures] = useState<(number | null)[]>(emptyProfileCardTextureIds())
  const [editCardTextureUrls, setEditCardTextureUrls] = useState<string[]>(
    emptyCardImageUrls(PROFILE_CARD_IMAGE_SLOT_COUNT),
  )
  const [editColorsHit, setEditColorsHit] = useState<Material[]>([])
  const [editColors, setEditColors] = useState<Record<number, ProfileColorEntry>>({})

  const [gearMenuTypeId, setGearMenuTypeId] = useState<number | null>(null)
  const [profileTypeDeleteModal, setProfileTypeDeleteModal] = useState<CalculatorProfileType | null>(null)

  const [folderTreeCache, setFolderTreeCache] = useState<MaterialCategory[]>([])
  const [materialClassesCache, setMaterialClassesCache] = useState<MaterialClass[]>([])
  const [materialSearchOverlay, setMaterialSearchOverlay] = useState<null | {
    tree: MaterialCategory[]
    mclasses: MaterialClass[]
  }>(null)
  const materialSearchTargetRef = useRef<'create' | 'edit' | null>(null)
  const [texturePickerTarget, setTexturePickerTarget] = useState<null | { mode: 'create' | 'edit'; slot: number }>(null)

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
    const flags = defaultProfileColorEntry()
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
          if (next[m.id] == null) next[m.id] = { ...flags }
          else next[m.id] = { ...next[m.id], is_active: true }
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
          if (next[m.id] == null) next[m.id] = { ...flags }
          else next[m.id] = { ...next[m.id], is_active: true }
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

  // Прогреваем кэш справочников следующих шагов (наполнение — шаг 4, петли — шаг 6),
  // пока пользователь выбирает профиль и цвет. Ответы кэшируются (CATALOG_TTL_MS),
  // поэтому переход на эти шаги не ждёт сети. Ошибки игнорируем — не критично.
  useEffect(() => {
    void fetchCalculatorFillingTypes().catch(() => null)
    void fetchCalculatorHingeTypes().catch(() => null)
  }, [])

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

  const prevColorIdRef = useRef<number | null>(null)

  const persistFrameSelection = useCallback((typeId: number | null, colorId: number | null) => {
    try {
      if (typeId == null || colorId == null) return false
      const t = profileTypes.find((x) => x.id === typeId)
      if (!t || !activeProfileTypeColors(t.colors).some((c) => c.color_material_id === colorId)) return false
      const prevColorRaw = localStorage.getItem('calc_frame_color_id')
      const prevColor = prevColorRaw ? Number(prevColorRaw) : null
      localStorage.setItem('calc_frame_type_id', String(typeId))
      localStorage.setItem('calc_frame_color_id', String(colorId))
      if (prevColor != null && Number.isFinite(prevColor) && prevColor !== colorId) {
        localStorage.removeItem('calc_filling_type_id')
        localStorage.removeItem('calc_filling_material_id')
      }
      notifyFrameCalcSession()
      return true
    } catch {
      return false
    }
  }, [profileTypes])

  useEffect(() => {
    if (!calcSessionHydrated) return
    try {
      if (selectedTypeId == null || selectedColorId == null) {
        localStorage.removeItem('calc_frame_type_id')
        localStorage.removeItem('calc_frame_color_id')
      } else {
        persistFrameSelection(selectedTypeId, selectedColorId)
      }
      const prev = prevColorIdRef.current
      if (
        prev != null &&
        selectedColorId != null &&
        prev !== selectedColorId
      ) {
        localStorage.removeItem('calc_filling_type_id')
        localStorage.removeItem('calc_filling_material_id')
      }
      prevColorIdRef.current = selectedColorId
    } catch {
      // ignore
    }
    notifyFrameCalcSession()
  }, [calcSessionHydrated, selectedTypeId, selectedColorId, profileTypes, persistFrameSelection])

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
    const activeColors = activeProfileTypeColors(t.colors)
    if (selectedColorId != null && activeColors.some((c) => c.color_material_id === selectedColorId)) return
    setSelectedColorId(activeColors[0]?.color_material_id ?? null)
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

  const createPreviewUrls = useCardFilePreviewUrls(createCardFiles)
  const editPreviewUrls = useCardFilePreviewUrls(editCardFiles)

  const editingType = useMemo(
    () => (editTypeId != null ? profileTypes.find((p) => p.id === editTypeId) ?? null : null),
    [editTypeId, profileTypes]
  )

  const editSlotExistingResolved = useMemo(() => {
    if (!editingType) return emptyCardImageUrls(PROFILE_CARD_IMAGE_SLOT_COUNT)
    return calcCardImageUrlsFromEntity(editingType, PROFILE_CARD_IMAGE_SLOT_COUNT)
  }, [editingType])

  const editCardTileUrls = useMemo(
    () =>
      calcCardImageTileUrls(
        editCardFiles,
        editPreviewUrls,
        editSlotExistingResolved,
        editCardTextureUrls,
      ),
    [editPreviewUrls, editCardFiles, editCardTextureUrls, editSlotExistingResolved],
  )

  const createCardTileUrls = useMemo(
    () =>
      calcCardImageTileUrls(
        createCardFiles,
        createPreviewUrls,
        emptyCardImageUrls(PROFILE_CARD_IMAGE_SLOT_COUNT),
        createCardTextureUrls,
      ),
    [createCardFiles, createPreviewUrls, createCardTextureUrls],
  )

  const openCreateTexturePicker = useCallback((slot: number) => {
    setTexturePickerTarget({ mode: 'create', slot })
  }, [])

  const openEditTexturePicker = useCallback((slot: number) => {
    setTexturePickerTarget({ mode: 'edit', slot })
  }, [])

  const createCardImageHandlers = useCardImageFormHandlers({
    maxSlots: PROFILE_CARD_IMAGE_SLOT_COUNT,
    tileUrls: createCardTileUrls,
    setFiles: setCreateCardFiles,
    setTextures: setCreateCardTextures,
    setTextureUrls: setCreateCardTextureUrls,
    onOpenTexturePicker: openCreateTexturePicker,
  })

  const editCardImageHandlers = useCardImageFormHandlers({
    maxSlots: PROFILE_CARD_IMAGE_SLOT_COUNT,
    tileUrls: editCardTileUrls,
    setFiles: setEditCardFiles,
    setTextures: setEditCardTextures,
    setTextureUrls: setEditCardTextureUrls,
    onOpenTexturePicker: openEditTexturePicker,
  })

  const openEditType = (t: CalculatorProfileType) => {
    closeMaterialSearch()
    setCreateOpen(false)
    setErr(null)
    setEditTypeId(t.id)
    setEditTypeName(t.name)
    setEditCardFiles(emptyProfileCardImageFiles())
    setEditCardTextures(emptyProfileCardTextureIds())
    setEditCardTextureUrls(emptyCardImageUrls(PROFILE_CARD_IMAGE_SLOT_COUNT))
    editCardImageHandlers.resetCardFileInput()
    const m: Record<number, ProfileColorEntry> = {}
    for (const c of t.colors ?? []) {
      m[c.color_material_id] = {
        is_active: c.is_active !== false,
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
    setEditCardFiles(emptyProfileCardImageFiles())
    setEditCardTextures(emptyProfileCardTextureIds())
    setEditCardTextureUrls(emptyCardImageUrls(PROFILE_CARD_IMAGE_SLOT_COUNT))
    editCardImageHandlers.resetCardFileInput()
    setEditColors({})
    setEditColorsHit([])
    setErr(null)
  }

  const closeCreateType = () => {
    closeMaterialSearch()
    setCreateOpen(false)
    setCreateTypeName('')
    resetCardImageArrays(
      PROFILE_CARD_IMAGE_SLOT_COUNT,
      setCreateCardFiles,
      setCreateCardTextures,
      setCreateCardTextureUrls,
      emptyProfileCardImageFiles,
      emptyProfileCardTextureIds,
    )
    createCardImageHandlers.resetCardFileInput()
    setCreateColorsHit([])
    setCreateColors({})
    setErr(null)
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
        is_active: f.is_active !== false,
        is_new: !!f.is_new,
        is_hit: !!f.is_hit,
        is_sale: !!f.is_sale,
      }))
      const fd = new FormData()
      fd.append('name', name)
      fd.append('is_active', String(t.is_active))
      fd.append('sort_order', String(t.sort_order))
      fd.append('colors', JSON.stringify(colors))
      appendProfileCardImagesToFormData(fd, editCardFiles)
      appendProfileCardTexturesToFormData(fd, editCardTextures)
      const updated = await updateCalculatorProfileType(editTypeId, fd)
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
        is_active: f.is_active !== false,
        is_new: !!f.is_new,
        is_hit: !!f.is_hit,
        is_sale: !!f.is_sale,
      }))
      const fd = new FormData()
      fd.append('name', name)
      fd.append('is_active', 'true')
      fd.append('sort_order', String(profileTypes.length))
      fd.append('colors', JSON.stringify(colors))
      appendProfileCardImagesToFormData(fd, createCardFiles)
      appendProfileCardTexturesToFormData(fd, createCardTextures)
      const created = await createCalculatorProfileType(fd)
      setProfileTypes((prev) => [...prev, created])
      setSelectedTypeId(created.id)
      closeCreateType()
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
      resetCardImageArrays(
        PROFILE_CARD_IMAGE_SLOT_COUNT,
        setEditCardFiles,
        setEditCardTextures,
        setEditCardTextureUrls,
        emptyProfileCardImageFiles,
        emptyProfileCardTextureIds,
      )
      editCardImageHandlers.resetCardFileInput()
      setEditColors({})
      setEditColorsHit([])
    }
  }, [editTypeId, profileTypes, editCardImageHandlers])

  const selectedType = useMemo(
    () => profileTypes.find((p) => p.id === selectedTypeId) ?? null,
    [profileTypes, selectedTypeId]
  )

  const modalType = useMemo(
    () => profileTypes.find((p) => p.id === modalTypeId) ?? null,
    [profileTypes, modalTypeId]
  )

  const patchModalColors = useCallback(async (typeId: number, rows: { color_material_id: number; is_active?: boolean; is_new?: boolean; is_hit?: boolean; is_sale?: boolean }[]) => {
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
        is_active: c.is_active !== false,
        is_new: Boolean(c.is_new),
        is_hit: Boolean(c.is_hit),
        is_sale: Boolean(c.is_sale),
      }))

    await patchModalColors(modalType.id, nextColors)

    if (selectedColorId === colorMaterialId) {
      const nextSel = nextColors.find((c) => c.is_active !== false)?.color_material_id ?? null
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
  const [selectedColorFullLoading, setSelectedColorFullLoading] = useState(false)
  useEffect(() => {
    let cancel = false
    if (!selectedColorId) {
      setSelectedColorMaterialFull(null)
      setSelectedColorFullLoading(false)
      return
    }
    setSelectedColorFullLoading(true)
    ;(async () => {
      try {
        const m = await fetchMaterial(selectedColorId)
        if (!cancel) {
          seedFrameDimsFromMaterial(m)
          setSelectedColorMaterialFull(m)
        }
      } catch {
        if (!cancel) setSelectedColorMaterialFull(null)
      } finally {
        if (!cancel) setSelectedColorFullLoading(false)
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

  const sketchFrameColorMaterial = useMemo(
    () => mergeFrameColorMaterial(selectedColorMaterial, selectedColorMaterialFull),
    [selectedColorMaterial, selectedColorMaterialFull],
  )

  const step2SketchBoxStyle = useMemo(() => {
    const d = readFrameDimsMm()
    const fallback = frameDimDefaultsFromMaterial(selectedColorMaterialFull)
    const h = d.h ?? fallback.heightMm
    const w = d.w ?? fallback.widthMm
    return facadeSketchBoxStyle(h, w)
  }, [sketchDimsKey, selectedColorMaterialFull])

  const stepAssetsReady = !loading && calcSessionHydrated
  const profileCardImageUrls = useMemo(
    () => collectCalcCardImageUrls(profileTypes),
    [profileTypes],
  )
  const cardImagesLoading = useCalcImagesPreload(profileCardImageUrls, stepAssetsReady)
  const sketchMaterialLoading = Boolean(selectedColorId) && selectedColorFullLoading
  const sketchTextureLoading = useCalcMaterialTexturePreload(
    sketchFrameColorMaterial,
    sketchMaterialLoading,
  )
  usePanelLoading(
    'data',
    loading ||
      !calcSessionHydrated ||
      cardImagesLoading ||
      selectedColorFullLoading ||
      sketchTextureLoading,
  )

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
                    closeEditType()
                    setCreateOpen(true)
                  }}
                >
                  + Добавить тип профиля
                </button>
              </div>
            ) : null}
          </div>

          {err && !createOpen && editTypeId == null && <div className="admin-error">{err}</div>}

          <div className="calc-side-panel-scroll">
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
                      {...calcCardImageGridSlots(t, PROFILE_CARD_IMAGE_SLOT_COUNT)}
                    />
                    <div className="tile-title">{title}</div>
                    <div className="tile-sub">Цветов: {activeProfileTypeColors(t.colors).length}</div>
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
              onClick={() => {
                persistFrameSelection(selectedTypeId, selectedColorId)
                nav(step('frame/size'))
              }}
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
                  style={profileFrameTextureLayerStyle(sketchFrameColorMaterial)}
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
                      {textureLabelDisplayWrap(materialTextureLabel(sketchFrameColorMaterial))}
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
              <button
                type="button"
                className="admin-primary admin-modal-head-icon-close"
                aria-label="Закрыть"
                title="Закрыть"
                onClick={() => setModalTypeId(null)}
              >
                {MODAL_CLOSE_X_SVG}
              </button>
            </div>

            <div className="tiles tiles--colors">
              {activeProfileTypeColors(modalType.colors).map((c) => {
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
                        persistFrameSelection(selectedTypeId, c.color_material_id)
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
                        className="tile-action-remove admin-primary admin-modal-head-icon-close"
                        aria-label="Убрать цвет из типа"
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
                        {MODAL_CLOSE_X_SVG}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {activeProfileTypeColors(modalType.colors).length === 0 && (
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

      {!readOnly && createOpen && (
        <CalculatorTypeFormModal
          open
          title="Создание типа профиля"
          titleId="profile-type-create-title"
          onClose={closeCreateType}
          onSubmit={() => void submitCreate()}
          submitLabel="Создать"
          error={err}
        >
          <ProfileTypeFormGrid
            idPrefix="profile-type"
            typeName={createTypeName}
            onTypeNameChange={setCreateTypeName}
            namePlaceholder="Название типа профиля…"
            cardImageLabel="Изображения для карточки"
            cardTileUrls={createCardTileUrls}
            onAddCardImage={createCardImageHandlers.onAddCardImage}
            onRemoveCardImage={createCardImageHandlers.onRemoveCardImage}
            onReplaceCardImage={createCardImageHandlers.onReplaceCardImage}
            cardFileInputRef={createCardImageHandlers.cardFileInputRef}
            onCardFileInputChange={createCardImageHandlers.onCardFileInputChange}
            onOpenMaterialSearch={() => void openMaterialTreeSearch('create')}
            colorsHit={createColorsHit}
            selectedColors={createColors}
            onToggleColorActive={(id) =>
              setCreateColors((prev) => {
                const cur = prev[id] ?? defaultProfileColorEntry()
                return { ...prev, [id]: { ...cur, is_active: !isAttachedEntryActive(cur) } }
              })
            }
            onRemoveColor={(id) => {
              setCreateColorsHit((prev) => prev.filter((m) => m.id !== id))
              setCreateColors((prev) => {
                const next = { ...prev }
                delete next[id]
                return next
              })
            }}
            onToggleColorFlag={(id, flag) =>
              setCreateColors((prev) => {
                const flags = prev[id] ?? defaultProfileColorEntry()
                return { ...prev, [id]: { ...flags, [flag]: !flags[flag] } }
              })
            }
            texByMaterialId={texByMaterialId}
          />
        </CalculatorTypeFormModal>
      )}

      {!readOnly && editTypeId != null && editingType && (
        <CalculatorTypeFormModal
          open
          title="Редактирование типа профиля"
          titleId="profile-type-edit-title"
          onClose={closeEditType}
          onSubmit={() => void submitEditType()}
          submitLabel="Сохранить"
          error={err}
        >
          <ProfileTypeFormGrid
            idPrefix="profile-type-edit"
            typeName={editTypeName}
            onTypeNameChange={setEditTypeName}
            namePlaceholder="Название типа профиля…"
            cardImageLabel="Карточка: до 6 фото"
            cardTileUrls={editCardTileUrls}
            onAddCardImage={editCardImageHandlers.onAddCardImage}
            onRemoveCardImage={editCardImageHandlers.onRemoveCardImage}
            onReplaceCardImage={editCardImageHandlers.onReplaceCardImage}
            cardFileInputRef={editCardImageHandlers.cardFileInputRef}
            onCardFileInputChange={editCardImageHandlers.onCardFileInputChange}
            onOpenMaterialSearch={() => void openMaterialTreeSearch('edit')}
            colorsHit={editColorsHit}
            selectedColors={editColors}
            onToggleColorActive={(id) =>
              setEditColors((prev) => {
                const cur = prev[id] ?? defaultProfileColorEntry()
                return { ...prev, [id]: { ...cur, is_active: !isAttachedEntryActive(cur) } }
              })
            }
            onRemoveColor={(id) => {
              setEditColorsHit((prev) => prev.filter((m) => m.id !== id))
              setEditColors((prev) => {
                const next = { ...prev }
                delete next[id]
                return next
              })
            }}
            onToggleColorFlag={(id, flag) =>
              setEditColors((prev) => {
                const flags = prev[id] ?? defaultProfileColorEntry()
                return { ...prev, [id]: { ...flags, [flag]: !flags[flag] } }
              })
            }
            texByMaterialId={texByMaterialId}
          />
        </CalculatorTypeFormModal>
      )}

      {texturePickerTarget && (
        <TexturePickerModal
          onClose={() => setTexturePickerTarget(null)}
          onPick={(item) => {
            const { mode, slot } = texturePickerTarget
            const applyIds = mode === 'create' ? setCreateCardTextures : setEditCardTextures
            const applyUrls = mode === 'create' ? setCreateCardTextureUrls : setEditCardTextureUrls
            const applyFiles = mode === 'create' ? setCreateCardFiles : setEditCardFiles
            applyIds((prev) => {
              const next = [...prev]
              next[slot] = item.id
              return next
            })
            applyUrls((prev) => {
              const next = [...prev]
              next[slot] = item.image ?? ''
              return next
            })
            applyFiles((prev) => {
              const next = [...prev]
              next[slot] = null
              return next
            })
            setTexturePickerTarget(null)
          }}
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
            <div className="admin-row mat-form-actions">
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
              <div className="admin-row mat-form-actions">
                <button type="button" className="admin-secondary" onClick={cancelDeleteProfileType}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="admin-primary"
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
