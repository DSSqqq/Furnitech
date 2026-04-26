import { useCallback, useEffect, useMemo, useState } from 'react'
import { searchMaterials } from './api'
import { BASE_CURRENCY } from './currencies'
import {
  capDecimalString,
  DECIMAL_FRACTION_DIGITS,
  filterDecimalInput,
  normalizeDecimalOnBlur,
} from './floatInput'
import type { Material, MaterialOperationLineDto, MaterialRelatedItemDto, UnitOfMeasure } from './types'
import './MaterialExtrasPanel.css'

export type RelatedItemState = {
  id?: number
  related_material_id: number
  quantity: string
  related_material: MaterialRelatedItemDto['related_material']
}

export type OpLineState = {
  id?: number
  name: string
  model_parameter: string
  quantity: string
  uom_id: number
  price: string
}

function toRelatedState(items: MaterialRelatedItemDto[] | undefined): RelatedItemState[] {
  if (!items?.length) return []
  return items.map((x) => ({
    id: x.id,
    related_material_id: x.related_material_id,
    quantity: capDecimalString(String(x.quantity), DECIMAL_FRACTION_DIGITS),
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
      <div className="mat-extras-cols">
        <section className="mat-extras-block">
          <div className="mat-extras-head">
            <h3 className="mat-extras-title">Сопутствующие материалы</h3>
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
            aria-label="Колонки: артикул, материал, кол-во, ед., цена"
          >
            <span>Артикул</span>
            <span>Сопутствующий материал</span>
            <span>Кол-во</span>
            <span>Ед. изм.</span>
            <span>Цена</span>
            <span />
          </div>
          <ul className="mat-extras-list">
            {relatedItems.length === 0 && (
              <li className="admin-muted">Нет строк — нажмите + и выберите из базы.</li>
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
                <span>{r.related_material.uom?.short_name || r.related_material.uom?.name || '—'}</span>
                <span>
                  {lineTotalRelated(r.quantity, r.related_material.base_price)} {BASE_CURRENCY}
                </span>
                <button
                  type="button"
                  className="mat-extras-rm"
                  onClick={() => removeRelated(i)}
                  title="Убрать строку"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mat-extras-block">
          <div className="mat-extras-head">
            <h3 className="mat-extras-title">Операции</h3>
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
            <span />
          </div>
          <ul className="mat-extras-list mat-extras-list-ops">
            {opLines.length === 0 && (
              <li className="admin-muted">Нет операций — нажмите + и заполните строку.</li>
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
                <button
                  type="button"
                  className="mat-extras-rm"
                  onClick={() => removeOp(i)}
                  title="Удалить строку"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="mat-extras-total" aria-live="polite">
        Предв. оценка: основной материал {mainP.toFixed(3)} + сопутствующие {sumRelated.toFixed(3)} + операции{' '}
        {sumOps.toFixed(3)} = <strong>{grand.toFixed(3)} {BASE_CURRENCY}</strong>
      </p>
    </div>
  )
}
