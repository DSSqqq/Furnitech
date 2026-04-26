import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createCalculatorProfile,
  deleteCalculatorProfile,
  fetchCalculatorProfiles,
  searchMaterials,
  updateCalculatorProfile,
} from './api'
import { HintButton } from './HintButton'
import type { CalculatorProfile, Material } from './types'
import './CalculatorConfigPage.css'

function matLabel(m: { name: string; article?: string | null }) {
  const a = (m.article ?? '').trim()
  return a ? `${m.name} (${a})` : m.name
}

export function CalculatorConfigPage() {
  const [profiles, setProfiles] = useState<CalculatorProfile[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? null,
    [profiles, selectedId]
  )

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [pickOpen, setPickOpen] = useState(false)
  const [pickQ, setPickQ] = useState('')
  const [pickHit, setPickHit] = useState<Material[]>([])
  const [picking, setPicking] = useState(false)

  const [colorPickOpen, setColorPickOpen] = useState(false)
  const [colorPickQ, setColorPickQ] = useState('')
  const [colorPickHit, setColorPickHit] = useState<Material[]>([])
  const [colorPicking, setColorPicking] = useState(false)

  const reload = useCallback(() => {
    setErr(null)
    setLoading(true)
    fetchCalculatorProfiles()
      .then((r) => {
        const rows = r.results ?? []
        setProfiles(rows)
        if (selectedId != null && !rows.some((x) => x.id === selectedId)) {
          setSelectedId(rows.length ? rows[0].id : null)
        }
        if (selectedId == null && rows.length) setSelectedId(rows[0].id)
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [selectedId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!pickOpen) return
    const q = pickQ.trim()
    const t = window.setTimeout(() => {
      if (!q) {
        setPickHit([])
        return
      }
      setPicking(true)
      searchMaterials(q)
        .then((r) => setPickHit(r.results ?? []))
        .catch(() => setPickHit([]))
        .finally(() => setPicking(false))
    }, 250)
    return () => clearTimeout(t)
  }, [pickQ, pickOpen])

  const profileMaterialIds = useMemo(() => new Set(profiles.map((p) => p.material)), [profiles])

  const addProfileFromMaterial = (m: Material) => {
    if (profileMaterialIds.has(m.id)) {
      setErr('Этот материал уже добавлен как профиль.')
      setPickOpen(false)
      return
    }
    setErr(null)
    createCalculatorProfile({ material: m.id, is_active: true, sort_order: profiles.length })
      .then((p) => {
        setProfiles((prev) => [...prev, p])
        setSelectedId(p.id)
        setPickOpen(false)
        setPickQ('')
        setPickHit([])
      })
      .catch((e) => setErr(String(e)))
  }

  useEffect(() => {
    if (!colorPickOpen) return
    const q = colorPickQ.trim()
    const t = window.setTimeout(() => {
      if (!q) {
        setColorPickHit([])
        return
      }
      setColorPicking(true)
      searchMaterials(q)
        .then((r) => setColorPickHit(r.results ?? []))
        .catch(() => setColorPickHit([]))
        .finally(() => setColorPicking(false))
    }, 250)
    return () => clearTimeout(t)
  }, [colorPickQ, colorPickOpen])

  const selectedColorIds = useMemo(() => {
    const s = new Set<number>()
    for (const c of selected?.colors ?? []) s.add(c.color_material_id)
    return s
  }, [selected])

  const saveColors = (nextColorMaterialIds: number[]) => {
    if (!selected) return
    setErr(null)
    updateCalculatorProfile(selected.id, {
      colors: nextColorMaterialIds.map((id) => ({ color_material_id: id })),
    })
      .then((p) => {
        setProfiles((prev) => prev.map((x) => (x.id === p.id ? p : x)))
      })
      .catch((e) => setErr(String(e)))
  }

  const addColorMaterial = (m: Material) => {
    if (!selected) return
    if (selectedColorIds.has(m.id)) {
      setColorPickOpen(false)
      setColorPickQ('')
      return
    }
    saveColors([...(selected?.colors ?? []).map((x) => x.color_material_id), m.id])
    setColorPickOpen(false)
    setColorPickQ('')
    setColorPickHit([])
  }

  const removeColorMaterial = (materialId: number) => {
    if (!selected) return
    const next = (selected.colors ?? [])
      .map((x) => x.color_material_id)
      .filter((id) => id !== materialId)
    saveColors(next)
  }

  const deleteSelectedProfile = () => {
    if (!selected) return
    if (!window.confirm('Удалить профиль калькулятора?')) return
    setErr(null)
    deleteCalculatorProfile(selected.id)
      .then(() => {
        setProfiles((prev) => prev.filter((p) => p.id !== selected.id))
        setSelectedId((prevSel) => (prevSel === selected.id ? null : prevSel))
      })
      .catch((e) => setErr(String(e)))
  }

  return (
    <div className="calcconf">
      <div className="admin-heading-row">
        <h2 className="admin-h2">Настройка калькулятора</h2>
        <HintButton text="Здесь связываем профиль (материал) и доступные ему цвета (другие материалы). Это нужно, чтобы калькулятор показывал правильные опции." />
      </div>

      {err && <div className="admin-error">{err}</div>}
      {loading && <p className="admin-muted">Загрузка…</p>}

      <div className="calcconf-grid">
        <section className="calcconf-card">
          <div className="calcconf-card-head">
            <h3 className="calcconf-h3">Профили</h3>
            <button type="button" className="admin-primary" onClick={() => setPickOpen((o) => !o)}>
              + Профиль
            </button>
          </div>

          {pickOpen && (
            <div className="calcconf-picker">
              <input
                className="admin-input"
                value={pickQ}
                onChange={(e) => setPickQ(e.target.value)}
                placeholder="Поиск материалов (название/артикул/ФНП)…"
              />
              {picking && <p className="admin-muted">Поиск…</p>}
              {pickHit.length > 0 && (
                <ul className="calcconf-picklist">
                  {pickHit.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => addProfileFromMaterial(m)}>
                        <span className="calcconf-pick-article">{m.article || '—'}</span>
                        <span className="calcconf-pick-name">{m.name}</span>
                        <span className="calcconf-pick-price">
                          {m.base_price} {m.base_currency}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <ul className="calcconf-list" aria-label="Список профилей калькулятора">
            {profiles.length === 0 && (
              <li className="admin-muted">Пока нет профилей. Нажмите “+ Профиль” и выберите материал.</li>
            )}
            {profiles.map((p) => {
              const active = p.id === selectedId
              const ms = p.material_summary
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={active ? 'calcconf-row calcconf-row--active' : 'calcconf-row'}
                    onClick={() => setSelectedId(p.id)}
                    title={ms ? matLabel(ms) : `Материал #${p.material}`}
                  >
                    <span className="calcconf-row-title">{ms ? ms.name : `Материал #${p.material}`}</span>
                    <span className="calcconf-row-sub">
                      {ms?.article ? ms.article : '—'} · {p.colors?.length ?? 0} цветов
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="calcconf-card">
          <div className="calcconf-card-head">
            <h3 className="calcconf-h3">Профиль</h3>
            <button type="button" className="admin-secondary" disabled={!selected} onClick={deleteSelectedProfile}>
              Удалить профиль
            </button>
          </div>

          {!selected ? (
            <p className="admin-muted">Выберите профиль слева.</p>
          ) : (
            <>
              <div className="calcconf-summary">
                <div className="calcconf-summary-title">
                  {selected.material_summary ? matLabel(selected.material_summary) : `Материал #${selected.material}`}
                </div>
                <div className="calcconf-summary-sub">
                  {selected.material_summary
                    ? `${selected.material_summary.base_price} ${selected.material_summary.base_currency} · ${
                        selected.material_summary.uom?.short_name || selected.material_summary.uom?.name || '—'
                      }`
                    : ''}
                </div>
              </div>

              <div className="calcconf-colors-head">
                <div className="admin-heading-row" style={{ margin: 0 }}>
                  <h3 className="calcconf-h3" style={{ margin: 0 }}>
                    Цвета
                  </h3>
                  <HintButton text="Цвета — это материалы из базы, которые доступны для выбранного профиля. Позже можно будет добавить сортировку/дефолтный цвет и т.д." />
                </div>
                <button type="button" className="admin-primary" onClick={() => setColorPickOpen((o) => !o)}>
                  + Добавить
                </button>
              </div>

              {colorPickOpen && (
                <div className="calcconf-picker">
                  <input
                    className="admin-input"
                    value={colorPickQ}
                    onChange={(e) => setColorPickQ(e.target.value)}
                    placeholder="Поиск материалов для цвета…"
                  />
                  {colorPicking && <p className="admin-muted">Поиск…</p>}
                  {colorPickHit.length > 0 && (
                    <ul className="calcconf-picklist">
                      {colorPickHit.map((m) => (
                        <li key={m.id}>
                          <button type="button" onClick={() => addColorMaterial(m)}>
                            <span className="calcconf-pick-article">{m.article || '—'}</span>
                            <span className="calcconf-pick-name">{m.name}</span>
                            <span className="calcconf-pick-price">
                              {m.base_price} {m.base_currency}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <ul className="calcconf-colors" aria-label="Цвета профиля">
                {(selected.colors ?? []).length === 0 && (
                  <li className="admin-muted">Цветов пока нет. Нажмите “+ Добавить”.</li>
                )}
                {(selected.colors ?? []).map((c) => (
                  <li key={c.id} className="calcconf-color-row">
                    <div className="calcconf-color-main">
                      <div className="calcconf-color-title">{matLabel(c.color_material)}</div>
                      <div className="calcconf-color-sub">
                        {c.color_material.base_price} {c.color_material.base_currency} ·{' '}
                        {c.color_material.uom?.short_name || c.color_material.uom?.name || '—'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="calcconf-rm"
                      title="Удалить цвет"
                      onClick={() => removeColorMaterial(c.color_material_id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default CalculatorConfigPage
