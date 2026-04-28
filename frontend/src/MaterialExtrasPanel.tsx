import { useCallback, useEffect, useMemo, useState } from 'react'
import { searchMaterials, updateMaterial } from './api'
import { BASE_CURRENCY } from './currencies'
import {
  capDecimalString,
  DECIMAL_FRACTION_DIGITS,
  filterDecimalInput,
  normalizeDecimalOnBlur,
} from './floatInput'
import type {
  Material,
  MaterialOperationLineDto,
  MaterialRelatedItemDto,
  RelatedQuantityScale,
  UnitOfMeasure,
} from './types'
import './MaterialExtrasPanel.css'

export type RelatedItemState = {
  id?: number
  related_material_id: number
  quantity: string
  quantity_scale: RelatedQuantityScale
  related_material: MaterialRelatedItemDto['related_material']
}

export type OpLineState = {
  id?: number
  name: string
  model_parameter: string
  quantity: string
  uom_id: number
  price: string
  price_per_facade: boolean
}

function toRelatedState(items: MaterialRelatedItemDto[] | undefined): RelatedItemState[] {
  if (!items?.length) return []
  return items.map((x) => ({
    id: x.id,
    related_material_id: x.related_material_id,
    quantity: capDecimalString(String(x.quantity), DECIMAL_FRACTION_DIGITS),
    quantity_scale: x.quantity_scale ?? 'follow_parent',
    related_material: { ...x.related_material, id: x.related_material.id },
  }))
}

function toOpState(items: MaterialOperationLineDto[] | undefined): OpLineState[] {
  if (!items?.length) return []
  return items.map((x) => ({
    id: x.id,
    name: x.name,
    model_parameter: x.model_parameter,
    quantity: capDecimalString(String(x.quantity), DECIMAL_FRACTION_DIGITS),
    uom_id: x.uom_id ?? 0,
    price: capDecimalString(String(x.price), DECIMAL_FRACTION_DIGITS),
    price_per_facade: Boolean(x.price_per_facade),
  }))
}

type Props = {
  uomList: UnitOfMeasure[]
  mainMaterialId: number | null
  relatedItems: RelatedItemState[]
  onRelatedChange: (rows: RelatedItemState[]) => void
  opLines: OpLineState[]
  onOpLinesChange: (rows: OpLineState[]) => void
  basePrice: string
}

function lineTotalRelated(q: string, basePrice: string) {
  const a = parseFloat(normalizeDecimalOnBlur(q).replace(',', '.')) || 0
  const b = parseFloat(normalizeDecimalOnBlur(basePrice).replace(',', '.')) || 0
  return (a * b).toFixed(3)
}

export function materialExtrasInitRelated(m: Material | null): RelatedItemState[] {
  return toRelatedState(m?.related_items)
}

export function materialExtrasInitOps(m: Material | null): OpLineState[] {
  return toOpState(m?.operation_lines)
}

export function MaterialExtrasPanel({
  uomList,
  mainMaterialId,
  relatedItems,
  onRelatedChange,
  opLines,
  onOpLinesChange,
  basePrice,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchHit, setSearchHit] = useState<Material[]>([])
  const [searching, setSearching] = useState(false)
  const [savingUomByMaterialId, setSavingUomByMaterialId] = useState<Record<number, true>>({})
  const [uomSaveErr, setUomSaveErr] = useState<string | null>(null)

  const uomById = useMemo(() => {
    const m = new Map<number, UnitOfMeasure>()
    for (const u of uomList) m.set(u.id, u)
    return m
  }, [uomList])

  const preferredUom = useMemo(() => {
    const codeOf = (u: UnitOfMeasure) => (u.code ?? '').trim().toLowerCase()
    const byCode: Record<string, UnitOfMeasure | undefined> = {}
    for (const u of uomList) {
      const c = codeOf(u)
      if (c) byCode[c] = u
    }
    return {
      m2: byCode.m2,
      m: byCode.m,
      pc: byCode.pc,
      l: byCode.l,
      kg: byCode.kg,
    }
  }, [uomList])

  const excludedIds = useMemo(() => {
    const s = new Set<number>(relatedItems.map((r) => r.related_material_id))
    if (mainMaterialId) s.add(mainMaterialId)
    return s
  }, [relatedItems, mainMaterialId])

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setSearchHit([])
      return
    }
    setSearching(true)
    searchMaterials(q)
      .then((r) => {
        setSearchHit(r.results.filter((m) => !excludedIds.has(m.id)))
      })
      .catch(() => setSearchHit([]))
      .finally(() => setSearching(false))
  }, [excludedIds])

  useEffect(() => {
    if (!searchOpen) return
    const t = window.setTimeout(() => doSearch(searchQ), 250)
    return () => clearTimeout(t)
  }, [searchQ, searchOpen, doSearch])

  const addRelated = (m: Material) => {
    if (excludedIds.has(m.id)) return
    onRelatedChange([
      ...relatedItems,
      {
        related_material_id: m.id,
        quantity: capDecimalString('1', DECIMAL_FRACTION_DIGITS),
        quantity_scale: 'follow_parent',
        related_material: {
          id: m.id,
          name: m.name,
          article: m.article,
          uom: m.uom,
          base_price: String(m.base_price),
          base_currency: m.base_currency,
        },
      },
    ])
    setSearchOpen(false)
    setSearchQ('')
  }

  const updateQty = (idx: number, v: string) => {
    const next = relatedItems.map((r, i) =>
      i === idx ? { ...r, quantity: filterDecimalInput(v, DECIMAL_FRACTION_DIGITS) } : r
    )
    onRelatedChange(next)
  }

  const removeRelated = (idx: number) => {
    onRelatedChange(relatedItems.filter((_, i) => i !== idx))
  }

  const addOp = () => {
    onOpLinesChange([
      ...opLines,
      {
        name: '',
        model_parameter: '',
        quantity: capDecimalString('1', DECIMAL_FRACTION_DIGITS),
        uom_id: uomList[0]?.id ?? 0,
        price: capDecimalString('0', DECIMAL_FRACTION_DIGITS),
        price_per_facade: false,
      },
    ])
  }

  const updateOp = (idx: number, patch: Partial<OpLineState>) => {
    onOpLinesChange(
      opLines.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    )
  }

  const removeOp = (idx: number) => {
    onOpLinesChange(opLines.filter((_, i) => i !== idx))
  }

  const sumRelated = relatedItems.reduce(
    (acc, r) =>
      acc + (parseFloat(lineTotalRelated(r.quantity, r.related_material.base_price)) || 0),
    0
  )
  const sumOps = opLines.reduce(
    (acc, o) => acc + (parseFloat(normalizeDecimalOnBlur(o.price)) || 0),
    0
  )
  const mainP = parseFloat(normalizeDecimalOnBlur(basePrice)) || 0
  const grand = mainP + sumRelated + sumOps

  return (
    <div className="mat-extras">
      <div className="mat-extras-stack">
        <section className="mat-extras-block mat-extras-block-related" aria-labelledby="mat-extras-related-heading">
          <div className="mat-extras-head">
            <h3 id="mat-extras-related-heading" className="mat-extras-title">
              Сопутствующие материалы
            </h3>
            <button
              type="button"
              className="mat-extras-plus"
              onClick={() => setSearchOpen((o) => !o)}
              title="Добавить из базы"
            >
              +
            </button>
          </div>
          {searchOpen && (
            <div className="mat-extras-search">
              <input
                className="admin-input"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Поиск по названию, артикулу, ФНП…"
                aria-label="Поиск материала"
              />
              {searching && <p className="admin-muted">Поиск…</p>}
              {searchHit.length > 0 && (
                <ul className="mat-extras-picklist">
                  {searchHit.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => addRelated(m)}>
                        <span className="mat-extras-pick-article">
                          {m.article || '—'}
                        </span>
                        <span className="mat-extras-pick-name">{m.name}</span>
                        <span className="mat-extras-pick-price">
                          {m.base_price} {m.base_currency}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div
            className="mat-extras-legend"
            role="row"
            aria-label="Колонки: артикул, материал, кол-во, ед., масштаб, сумма строки"
          >
            <span>Артикул</span>
            <span>Сопутствующий материал</span>
            <span>Кол-во</span>
            <span>Ед. изм.</span>
            <span>Масштаб</span>
            <span>Кол×цена</span>
            <span />
          </div>
          <ul className="mat-extras-list">
            {relatedItems.length === 0 && (
              <li className="admin-muted mat-extras-empty">Нет строк — нажмите + и выберите из базы.</li>
            )}
            {relatedItems.map((r, i) => (
              <li key={r.id ?? `r-${r.related_material_id}-${i}`} className="mat-extras-row">
                <span title="Артикул">
                  {r.related_material.article || '—'}
                </span>
                <span className="mat-extras-clip" title={r.related_material.name}>
                  {r.related_material.name}
                </span>
                <input
                  className="admin-input"
                  value={r.quantity}
                  onChange={(e) => updateQty(i, e.target.value)}
                  onBlur={() =>
                    onRelatedChange(
                      relatedItems.map((row, j) =>
                        j === i
                          ? { ...row, quantity: normalizeDecimalOnBlur(row.quantity) }
                          : row
                      )
                    )
                  }
                />
                <select
                  className="admin-input mat-extras-uom-select"
                  value={r.related_material.uom?.id ?? ''}
                  disabled={savingUomByMaterialId[r.related_material_id] === true}
                  title="Ед. изм. сопутствующего материала (сохраняется в базе материалов)"
                  onChange={async (e) => {
                    const nextUomId = Number(e.target.value)
                    if (!nextUomId) return
                    const u = uomById.get(nextUomId)
                    if (!u) return
                    const matId = r.related_material_id
                    setUomSaveErr(null)
                    setSavingUomByMaterialId((prev) => ({ ...prev, [matId]: true }))
                    try {
                      const updated = await updateMaterial(matId, { uom_id: nextUomId })
                      const nextUom = updated.uom ?? u
                      onRelatedChange(
                        relatedItems.map((row, j) =>
                          j === i ? { ...row, related_material: { ...row.related_material, uom: nextUom } } : row
                        )
                      )
                    } catch (err) {
                      setUomSaveErr(err instanceof Error ? err.message : String(err))
                      // откатываем select визуально через state (останется прежний uom)
                      onRelatedChange([...relatedItems])
                    } finally {
                      setSavingUomByMaterialId((prev) => {
                        const next = { ...prev }
                        delete next[matId]
                        return next
                      })
                    }
                  }}
                >
                  <option value="">—</option>
                  <option value={preferredUom.m2?.id ?? ''} disabled={!preferredUom.m2}>
                    м²
                  </option>
                  <option value={preferredUom.m?.id ?? ''} disabled={!preferredUom.m}>
                    м.п.
                  </option>
                  <option value={preferredUom.pc?.id ?? ''} disabled={!preferredUom.pc}>
                    шт
                  </option>
                  <option value={preferredUom.l?.id ?? ''} disabled={!preferredUom.l}>
                    л
                  </option>
                  <option value={preferredUom.kg?.id ?? ''} disabled={!preferredUom.kg}>
                    кг
                  </option>
                </select>
                <select
                  className="admin-input mat-extras-scale-select"
                  value={r.quantity_scale}
                  title="Как умножать строку в калькуляторе (см. подсказку под таблицей)"
                  onChange={(e) =>
                    onRelatedChange(
                      relatedItems.map((row, j) =>
                        j === i
                          ? { ...row, quantity_scale: e.target.value as RelatedQuantityScale }
                          : row
                      )
                    )
                  }
                >
                  <option value="follow_parent">Как у основного</option>
                  <option value="per_facade">На фасад</option>
                  <option value="use_related_uom">По ед. изм. строки</option>
                </select>
                <span>
                  {lineTotalRelated(r.quantity, r.related_material.base_price)} {BASE_CURRENCY}
                </span>
                <button
                  type="button"
                  className="mat-extras-rm"
                  onClick={() => removeRelated(i)}
                  title="Убрать строку"
                  aria-label="Удалить строку сопутствующего"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {uomSaveErr && <p className="mat-extras-warn">{uomSaveErr}</p>}
        </section>

        <section className="mat-extras-block mat-extras-block-ops" aria-labelledby="mat-extras-ops-heading">
          <div className="mat-extras-head">
            <h3 id="mat-extras-ops-heading" className="mat-extras-title">
              Операции
            </h3>
            <button
              type="button"
              className="mat-extras-plus"
              onClick={addOp}
              title="Добавить операцию"
            >
              +
            </button>
          </div>
          <div className="mat-extras-legend mat-extras-legend-ops" role="row">
            <span>Операция</span>
            <span>Параметр с модели</span>
            <span>Кол-во</span>
            <span>Ед. изм.</span>
            <span>Цена ({BASE_CURRENCY})</span>
            <span title="Умножать цену строки на число фасадов в калькуляторе">× фасад</span>
            <span />
          </div>
          <ul className="mat-extras-list mat-extras-list-ops">
            {opLines.length === 0 && (
              <li className="admin-muted mat-extras-empty">Нет операций — нажмите + и заполните строку.</li>
            )}
            {opLines.map((o, i) => (
              <li key={o.id ?? `o-${i}`} className="mat-extras-row-ops">
                <input
                  className="admin-input"
                  value={o.name}
                  onChange={(e) => updateOp(i, { name: e.target.value })}
                  placeholder="Название"
                />
                <input
                  className="admin-input"
                  value={o.model_parameter}
                  onChange={(e) => updateOp(i, { model_parameter: e.target.value })}
                  placeholder="Параметр"
                />
                <input
                  className="admin-input"
                  value={o.quantity}
                  onChange={(e) =>
                    updateOp(i, {
                      quantity: filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS),
                    })
                  }
                  onBlur={() => {
                    const v = opLines[i]?.quantity
                    if (v !== undefined) {
                      updateOp(i, { quantity: normalizeDecimalOnBlur(v) })
                    }
                  }}
                />
                <select
                  className="admin-input"
                  value={o.uom_id || ''}
                  onChange={(e) => updateOp(i, { uom_id: Number(e.target.value) })}
                >
                  <option value="">—</option>
                  {uomList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.short_name || u.name}
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  value={o.price}
                  onChange={(e) =>
                    updateOp(i, {
                      price: filterDecimalInput(e.target.value, DECIMAL_FRACTION_DIGITS),
                    })
                  }
                  onBlur={() => {
                    const v = opLines[i]?.price
                    if (v !== undefined) updateOp(i, { price: normalizeDecimalOnBlur(v) })
                  }}
                />
                <label className="mat-extras-op-facade" title="Умножать цену строки на число фасадов в калькуляторе">
                  <input
                    type="checkbox"
                    checked={o.price_per_facade}
                    onChange={(e) => updateOp(i, { price_per_facade: e.target.checked })}
                  />
                </label>
                <button
                  type="button"
                  className="mat-extras-rm"
                  onClick={() => removeOp(i)}
                  title="Удалить строку"
                  aria-label="Удалить строку операции"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="mat-extras-total" aria-live="polite">
        Предв. оценка (карточка, без габаритов): основной {mainP.toFixed(3)} + сопутствующие{' '}
        {sumRelated.toFixed(3)} + операции {sumOps.toFixed(3)} ={' '}
        <strong>
          {grand.toFixed(3)} {BASE_CURRENCY}
        </strong>
        . В калькуляторе сумма считается по масштабу строк и габаритам; операции с «× фасад» умножаются на число
        фасадов.
      </p>
    </div>
  )
}
