import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCalculatorHingeType,
  deleteCalculatorHingeType,
  fetchCalculatorHingeTypes,
  fetchCategoryTree,
  fetchMaterial,
  fetchMaterialClasses,
  updateCalculatorHingeType,
} from '../api'
import { MaterialSearchModal } from '../MaterialSearchModal'
import { usePanelLoading } from '../AdminPanelLoadingHost'
import { collectCalcCardImageUrls, useCalcImagesPreload } from './calcStepAssetsLoading'
import { TexturePickerModal } from '../TexturePickerModal'
import type { CalculatorHingeType, Material, MaterialCategory, MaterialClass } from '../types'
import {
  CALC_LS_HINGE_MATERIAL_ID,
  CALC_LS_HINGE_TYPE_ID,
  notifyFrameCalcSession,
} from './frameCalcSession'
import {
  CalculatorCardTileStriped,
  appendCalcCardImagesToFormData,
  appendCalcCardTexturesToFormData,
  calcCardImageGridSlots,
  calcCardImageTileUrls,
  calcCardImageUrlsFromEntity,
  emptyCalcCardImageFiles,
  emptyCalcCardTextureIds,
  type CalcCardImageFiles,
  type CalcCardImageUrls,
  type CalcCardTextureIds,
} from './calculatorCardTiles'
import { CalculatorTypeFormModal } from '../CalculatorTypeFormModal'
import { MaterialTypeFormGrid } from './CalculatorTypeFormGrid'
import { materialTextureLabel, type MaterialTextureFields } from './materialTextureLabel'
import { resolveMediaUrl } from './sketchFrame'
import './Step2FrameFacade.css'

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

function textureThumb(m: { texture_image?: string | null; texture_color?: string; name: string }) {
  const img = resolveMediaUrl(m.texture_image ?? '')
  const color = (m.texture_color ?? '').trim()
  if (img) {
    return (
      <div className="tile-thumb tile-thumb--color">
        <img className="tile-thumb-img" src={img} alt={m.name} loading="lazy" decoding="async" />
      </div>
    )
  }
  return <div className="tile-thumb" style={color ? { backgroundColor: color } : undefined} />
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
  const [createCardFiles, setCreateCardFiles] = useState<CalcCardImageFiles>(emptyCalcCardImageFiles())
  const [createCardTextures, setCreateCardTextures] = useState<CalcCardTextureIds>(emptyCalcCardTextureIds())
  const [createCardTextureUrls, setCreateCardTextureUrls] = useState<CalcCardImageUrls>(['', '', '', ''])
  const hingeCardInputRef0 = useRef<HTMLInputElement>(null)
  const hingeCardInputRef1 = useRef<HTMLInputElement>(null)
  const hingeCardInputRef2 = useRef<HTMLInputElement>(null)
  const hingeCardInputRef3 = useRef<HTMLInputElement>(null)
  const [createMatHit, setCreateMatHit] = useState<Material[]>([])
  const [createMatIds, setCreateMatIds] = useState<Record<number, true>>({})

  const [editHingeId, setEditHingeId] = useState<number | null>(null)
  const [editHingeName, setEditHingeName] = useState('')
  const [editCardFiles, setEditCardFiles] = useState<CalcCardImageFiles>(emptyCalcCardImageFiles())
  const [editCardTextures, setEditCardTextures] = useState<CalcCardTextureIds>(emptyCalcCardTextureIds())
  const [editCardTextureUrls, setEditCardTextureUrls] = useState<CalcCardImageUrls>(['', '', '', ''])
  const editHingeCardInputRef0 = useRef<HTMLInputElement>(null)
  const editHingeCardInputRef1 = useRef<HTMLInputElement>(null)
  const editHingeCardInputRef2 = useRef<HTMLInputElement>(null)
  const editHingeCardInputRef3 = useRef<HTMLInputElement>(null)
  const [editHingeMatHit, setEditHingeMatHit] = useState<Material[]>([])
  const [editHingeMatIds, setEditHingeMatIds] = useState<Record<number, true>>({})

  const [folderTreeCache, setFolderTreeCache] = useState<MaterialCategory[]>([])
  const [materialClassesCache, setMaterialClassesCache] = useState<MaterialClass[]>([])
  const [materialSearchOverlay, setMaterialSearchOverlay] = useState<null | {
    tree: MaterialCategory[]
    mclasses: MaterialClass[]
  }>(null)
  const materialSearchTargetRef = useRef<'create' | 'edit' | null>(null)
  const [texturePickerTarget, setTexturePickerTarget] = useState<null | { mode: 'create' | 'edit'; slot: number }>(null)

  const [modalSaving, setModalSaving] = useState(false)

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
    [folderTreeCache, materialClassesCache],
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
      setEditHingeMatHit((prev) => {
        let next = prev
        for (let i = materials.length - 1; i >= 0; i--) {
          const m = materials[i]!
          if (!next.some((x) => x.id === m.id)) next = [m, ...next]
        }
        return next
      })
      setEditHingeMatIds((prev) => {
        const next = { ...prev }
        for (const m of materials) next[m.id] = true
        return next
      })
    }
  }, [])

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

  const editingHinge = useMemo(
    () => (editHingeId != null ? hingeTypes.find((p) => p.id === editHingeId) ?? null : null),
    [editHingeId, hingeTypes],
  )

  const editHingeSlotExistingResolved = useMemo(() => {
    if (!editingHinge) return calcCardImageUrlsFromEntity({})
    return calcCardImageUrlsFromEntity(editingHinge)
  }, [editingHinge])

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

  const editHingeCardTileUrls = useMemo(
    () =>
      calcCardImageTileUrls(
        editCardFiles,
        [editBlob0, editBlob1, editBlob2, editBlob3],
        editHingeSlotExistingResolved,
        editCardTextureUrls,
      ),
    [editBlob0, editBlob1, editBlob2, editBlob3, editCardFiles, editCardTextureUrls, editHingeSlotExistingResolved],
  )

  const createCardTileUrls = useMemo(
    () =>
      calcCardImageTileUrls(
        createCardFiles,
        [createPreview0, createPreview1, createPreview2, createPreview3],
        ['', '', '', ''],
        createCardTextureUrls,
      ),
    [createCardFiles, createPreview0, createPreview1, createPreview2, createPreview3, createCardTextureUrls],
  )

  const closeEditHinge = () => {
    closeMaterialSearch()
    setEditHingeId(null)
    setEditHingeName('')
    setEditCardFiles(emptyCalcCardImageFiles())
    setEditCardTextures(emptyCalcCardTextureIds())
    setEditCardTextureUrls(['', '', '', ''])
    for (const r of [editHingeCardInputRef0, editHingeCardInputRef1, editHingeCardInputRef2, editHingeCardInputRef3]) {
      if (r.current) r.current.value = ''
    }
    setEditHingeMatIds({})
    setEditHingeMatHit([])
    setErr(null)
  }

  const closeCreateHinge = () => {
    closeMaterialSearch()
    setCreateOpen(false)
    setCreateName('')
    setCreateCardFiles(emptyCalcCardImageFiles())
    setCreateCardTextures(emptyCalcCardTextureIds())
    setCreateCardTextureUrls(['', '', '', ''])
    for (const r of [hingeCardInputRef0, hingeCardInputRef1, hingeCardInputRef2, hingeCardInputRef3]) {
      if (r.current) r.current.value = ''
    }
    setCreateMatHit([])
    setCreateMatIds({})
    setErr(null)
  }

  const openEditHinge = (t: CalculatorHingeType) => {
    closeMaterialSearch()
    setCreateOpen(false)
    setErr(null)
    setEditHingeId(t.id)
    setEditHingeName(t.name)
    setEditCardFiles(emptyCalcCardImageFiles())
    setEditCardTextures(emptyCalcCardTextureIds())
    setEditCardTextureUrls(['', '', '', ''])
    for (const r of [editHingeCardInputRef0, editHingeCardInputRef1, editHingeCardInputRef2, editHingeCardInputRef3]) {
      if (r.current) r.current.value = ''
    }
    const ids: Record<number, true> = {}
    for (const m of t.materials ?? []) ids[m.material_id] = true
    setEditHingeMatIds(ids)
    setEditHingeMatHit([])
    void Promise.all(
      (t.materials ?? []).map((row) => fetchMaterial(row.material_id).catch(() => null)),
    ).then((rows) => {
      setEditHingeMatHit(rows.filter((x): x is Material => x != null))
    })
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
      const fd = new FormData()
      fd.append('name', name)
      fd.append('is_active', String(t.is_active))
      fd.append('sort_order', String(t.sort_order))
      fd.append('materials', JSON.stringify(materials))
      appendCalcCardImagesToFormData(fd, editCardFiles)
      appendCalcCardTexturesToFormData(fd, editCardTextures)
      const updated = await updateCalculatorHingeType(editHingeId, fd)
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
      appendCalcCardImagesToFormData(fd, createCardFiles)
      appendCalcCardTexturesToFormData(fd, createCardTextures)
      const created = await createCalculatorHingeType(fd)
      setHingeTypes((prev) => [...prev, created])
      setSelectedTypeId(created.id)
      closeCreateHinge()
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
      setEditCardFiles(emptyCalcCardImageFiles())
      setEditCardTextures(emptyCalcCardTextureIds())
      setEditCardTextureUrls(['', '', '', ''])
      for (const r of [editHingeCardInputRef0, editHingeCardInputRef1, editHingeCardInputRef2, editHingeCardInputRef3]) {
        if (r.current) r.current.value = ''
      }
      setEditHingeMatIds({})
      setEditHingeMatHit([])
    }
  }, [editHingeId, hingeTypes])

  const selectedType = useMemo(
    () => hingeTypes.find((p) => p.id === selectedTypeId) ?? null,
    [hingeTypes, selectedTypeId],
  )

  const modalType = useMemo(
    () => hingeTypes.find((p) => p.id === modalTypeId) ?? null,
    [hingeTypes, modalTypeId],
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

  const stepAssetsReady = !loading && hydrated
  const hingeCardImageUrls = useMemo(
    () => collectCalcCardImageUrls(hingeTypes),
    [hingeTypes],
  )
  const cardImagesLoading = useCalcImagesPreload(hingeCardImageUrls, stepAssetsReady)
  usePanelLoading('hinges', loading || !hydrated || cardImagesLoading)

  return (
    <>
      {err && !createOpen && editHingeId == null && <div className="admin-error">{err}</div>}

      <div className="frame2-card-head">
        <h4 className="frame2-h4">Тип петель</h4>
        {!readOnly && (
          <div className="frame2-actions">
            <button
              type="button"
              className="admin-primary"
              onClick={() => {
                setErr(null)
                closeEditHinge()
                setCreateOpen(true)
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

      <div className="tiles" aria-label="Тип петель">
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
                <CalculatorCardTileStriped
                  title={title}
                  versionKey={t.id}
                  {...calcCardImageGridSlots(t)}
                />
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
                        className="tile-action-remove admin-primary admin-modal-head-icon-close"
                        aria-label="Убрать материал из типа"
                        title="Убрать материал из типа"
                        disabled={modalSaving}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!window.confirm('Убрать этот материал из типа петель?')) return
                          void removeModalMaterial(c.material_id)
                        }}
                      >
                        {MODAL_CLOSE_X_SVG}
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

      {!readOnly && createOpen && (
        <CalculatorTypeFormModal
          open
          title="Создание типа петель"
          titleId="hinge-type-create-title"
          onClose={closeCreateHinge}
          onSubmit={() => void submitCreate()}
          submitLabel="Создать"
          error={err}
        >
          <MaterialTypeFormGrid
            idPrefix="hinge-type"
            typeBlockTitle="Тип петель"
            typeName={createName}
            onTypeNameChange={setCreateName}
            namePlaceholder="Например: Петля 110°, накладная…"
            cardImageLabel="Изображения для карточки"
            cardFiles={createCardFiles}
            onCardFileChange={(slot, file) => {
              setCreateCardFiles((prev) => {
                const next: CalcCardImageFiles = [...prev]
                next[slot] = file
                return next
              })
              setCreateCardTextures((prev) => {
                const next: CalcCardTextureIds = [...prev]
                next[slot] = null
                return next
              })
              setCreateCardTextureUrls((prev) => {
                const next: CalcCardImageUrls = [...prev]
                next[slot] = ''
                return next
              })
            }}
            cardTileUrls={createCardTileUrls}
            cardInputRefs={[hingeCardInputRef0, hingeCardInputRef1, hingeCardInputRef2, hingeCardInputRef3]}
            onPickTextureSlot={(slot) => setTexturePickerTarget({ mode: 'create', slot })}
            cardAriaLabel="Фото карточки типа петель, до четырёх"
            materialsBlockTitle="Материалы (петли)"
            materialsListLabel="Материалы для карточки"
            onOpenMaterialSearch={() => void openMaterialTreeSearch('create')}
            materialsHit={createMatHit}
            selectedMaterialIds={createMatIds}
            onToggleMaterial={(id) =>
              setCreateMatIds((prev) => {
                const next = { ...prev }
                if (next[id]) delete next[id]
                else next[id] = true
                return next
              })
            }
            texByMaterialId={texByMaterialId}
          />
        </CalculatorTypeFormModal>
      )}

      {!readOnly && editHingeId != null && editingHinge && (
        <CalculatorTypeFormModal
          open
          title="Редактирование типа петель"
          titleId="hinge-type-edit-title"
          onClose={closeEditHinge}
          onSubmit={() => void submitEditHinge()}
          submitLabel="Сохранить"
          error={err}
        >
          <MaterialTypeFormGrid
            idPrefix="hinge-type-edit"
            typeBlockTitle="Тип петель"
            typeName={editHingeName}
            onTypeNameChange={setEditHingeName}
            namePlaceholder="Название…"
            cardImageLabel="Карточка: до 4 фото"
            cardFiles={editCardFiles}
            onCardFileChange={(slot, file) => {
              setEditCardFiles((prev) => {
                const next: CalcCardImageFiles = [...prev]
                next[slot] = file
                return next
              })
              setEditCardTextures((prev) => {
                const next: CalcCardTextureIds = [...prev]
                next[slot] = null
                return next
              })
              setEditCardTextureUrls((prev) => {
                const next: CalcCardImageUrls = [...prev]
                next[slot] = ''
                return next
              })
            }}
            cardTileUrls={editHingeCardTileUrls}
            cardInputRefs={[editHingeCardInputRef0, editHingeCardInputRef1, editHingeCardInputRef2, editHingeCardInputRef3]}
            onPickTextureSlot={(slot) => setTexturePickerTarget({ mode: 'edit', slot })}
            cardAriaLabel="Фото карточки типа петель, до четырёх"
            materialsBlockTitle="Материалы"
            materialsListLabel="Материалы для карточки"
            onOpenMaterialSearch={() => void openMaterialTreeSearch('edit')}
            materialsHit={editHingeMatHit}
            selectedMaterialIds={editHingeMatIds}
            onToggleMaterial={(id) =>
              setEditHingeMatIds((prev) => {
                const next = { ...prev }
                if (next[id]) delete next[id]
                else next[id] = true
                return next
              })
            }
            texByMaterialId={texByMaterialId}
          />
        </CalculatorTypeFormModal>
      )}

      {materialSearchOverlay && (
        <MaterialSearchModal
          tree={materialSearchOverlay.tree}
          mclasses={materialSearchOverlay.mclasses}
          onClose={closeMaterialSearch}
          onPick={handleMaterialPickedFromTree}
        />
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
              const next: CalcCardTextureIds = [...prev]
              next[slot] = item.id
              return next
            })
            applyUrls((prev) => {
              const next: CalcCardImageUrls = [...prev]
              next[slot] = item.image ?? ''
              return next
            })
            applyFiles((prev) => {
              const next: CalcCardImageFiles = [...prev]
              next[slot] = null
              return next
            })
            setTexturePickerTarget(null)
          }}
        />
      )}
    </>
  )
}
