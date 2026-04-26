import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createCalculatorProfileType,
  deleteCalculatorProfileType,
  fetchCalculatorProfileTypes,
  fetchMaterial,
  searchMaterials,
} from '../api'
import type { CalculatorProfileType, Material } from '../types'
import { notifyFrameCalcSession } from './frameCalcSession'
import { resolveMediaUrl, sketchFrameInlineStyle } from './sketchFrame'
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
  const [profileTypes, setProfileTypes] = useState<CalculatorProfileType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [modalTypeId, setModalTypeId] = useState<number | null>(null)
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
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

  const createTypeImagePreview = useMemo(() => {
    if (!createTypeImageFile) return ''
    return URL.createObjectURL(createTypeImageFile)
  }, [createTypeImageFile])

  useEffect(() => {
    return () => {
      if (createTypeImagePreview) URL.revokeObjectURL(createTypeImagePreview)
    }
  }, [createTypeImagePreview])

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
      })
      .catch((e) => setErr(String(e)))
  }

  // (пока не используем) Редактирование цветов у существующего типа можно будет добавить отдельной формой.

  const selectedType = useMemo(
    () => profileTypes.find((p) => p.id === selectedTypeId) ?? null,
    [profileTypes, selectedTypeId]
  )

  const modalType = useMemo(
    () => profileTypes.find((p) => p.id === modalTypeId) ?? null,
    [profileTypes, modalTypeId]
  )

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
  }, [selectedColorId, selectedType])

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
            <div className="frame2-actions">
              <button
                type="button"
                className="admin-primary"
                onClick={() => {
                  setCreateOpen((o) => !o)
                  setErr(null)
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
          </div>

          {createOpen && (
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
                    <label className="frame2-file-label" htmlFor="profile-type-card-image">
                      Изображение для карточки
                    </label>
                    <input
                      id="profile-type-card-image"
                      ref={cardImageInputRef}
                      className="frame2-file-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        setCreateTypeImageFile(f)
                      }}
                    />
                    {createTypeImagePreview && (
                      <div className="frame2-file-preview frame2-file-preview--cover">
                        <img src={createTypeImagePreview} alt="" />
                      </div>
                    )}
                    <p className="admin-muted frame2-file-hint">
                      Файл с вашего компьютера (в диалоге можно открыть «Рабочий стол»). Формат — изображение.
                    </p>
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
                            <div className="frame2-checkrow" title={matLabel(m)}>
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
                              <span className="frame2-check-name">{m.name}</span>
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

          <ul className="frame2-list" aria-label="Список типов профилей">
            {profileTypes.length === 0 && <li className="admin-muted">Типов профилей пока нет.</li>}
          </ul>

          <div className="tiles" aria-label="Типы профилей плитками">
            {profileTypes.map((t) => {
              const title = t.name || `Тип #${t.id}`
              const active = t.id === selectedTypeId
              return (
                <button
                  key={t.id}
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
              )
            })}
          </div>

          <div className="frame2-card-nav">
            <button type="button" className="admin-secondary" onClick={() => nav('/calculator')}>
              ← Предыдущий шаг
            </button>
            <button
              type="button"
              className="admin-primary"
              disabled={!selectedTypeId || !selectedColorId}
              title={!selectedTypeId || !selectedColorId ? 'Сначала выберите тип профиля и цвет' : undefined}
              onClick={() => nav('/calculator/frame/size')}
            >
              Следующий шаг →
            </button>
          </div>
        </section>

        <section className="frame2-sketch" aria-label="Эскиз фасада">
          <div className="frame2-sketch-inner">
            <div className="sketch">
              <div className="sketch-frame" style={sketchFrameInlineStyle(selectedColorMaterial)} />
              <div className="sketch-paper" />
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
                  <button
                    key={c.id}
                    type="button"
                    className={active ? 'tile tile--active' : 'tile'}
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
                )
              })}
            </div>

            {(modalType.colors ?? []).length === 0 && (
              <div className="admin-muted">Цвета для типа профиля не заданы.</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Step2FrameFacade
