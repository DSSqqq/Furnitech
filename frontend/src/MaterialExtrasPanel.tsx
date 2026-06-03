import { useMemo, useState } from 'react'
import { updateMaterial } from './api'
import { BASE_CURRENCY } from './currencies'
import {
  DECIMAL_FRACTION_DIGITS,
  filterDecimalInput,
  formatDecimalStringForInput,
  formatNumberForUi,
  normalizeDecimalForInput,
  normalizeDecimalOnBlur,
} from './floatInput'
import { FtSelect } from './FtSelect'
import { sortUomForSelect } from './uomSelectOrder'
import { MaterialRelatedPickModal } from './MaterialRelatedPickModal'
import type {
  Material,
  MaterialCategory,
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

function toRelatedState(items: MaterialRelatedItemDto[] | undefined): RelatedItemState[] {
  if (!items?.length) return []
  return items.map((x) => ({
    id: x.id,
    related_material_id: x.related_material_id,
    quantity: formatDecimalStringForInput(String(x.quantity), DECIMAL_FRACTION_DIGITS),
    quantity_scale: x.quantity_scale ?? 'follow_parent',
    related_material: { ...x.related_material, id: x.related_material.id },
  }))
}

type Props = {
  categoryTree: MaterialCategory[]
  uomList: UnitOfMeasure[]
  mainMaterialId: number | null
  relatedItems: RelatedItemState[]
  onRelatedChange: (rows: RelatedItemState[]) => void
  basePrice: string
}

function lineTotalRelated(q: string, basePrice: string) {
  const a = parseFloat(normalizeDecimalOnBlur(q).replace(',', '.')) || 0
  const b = parseFloat(normalizeDecimalOnBlur(basePrice).replace(',', '.')) || 0
  return formatNumberForUi(a * b, DECIMAL_FRACTION_DIGITS)
}

export function materialExtrasInitRelated(m: Material | null): RelatedItemState[] {
  return toRelatedState(m?.related_items)
}

export function MaterialExtrasPanel({
  categoryTree,
  uomList,
  mainMaterialId,
  relatedItems,
  onRelatedChange,
  basePrice,
}: Props) {
  const [pickModalOpen, setPickModalOpen] = useState(false)
  const [savingUomByMaterialId, setSavingUomByMaterialId] = useState<Record<number, true>>({})
  const [uomSaveErr, setUomSaveErr] = useState<string | null>(null)

  const uomById = useMemo(() => {
    const m = new Map<number, UnitOfMeasure>()
    for (const u of uomList) m.set(u.id, u)
    return m
  }, [uomList])

  const sortedUom = useMemo(() => sortUomForSelect(uomList), [uomList])

  const excludedIds = useMemo(() => {
    const s = new Set<number>(relatedItems.map((r) => r.related_material_id))
    if (mainMaterialId) s.add(mainMaterialId)
    return s
  }, [relatedItems, mainMaterialId])

  const addRelated = (m: Material) => {
    if (excludedIds.has(m.id)) return
    onRelatedChange([
      ...relatedItems,
      {
        related_material_id: m.id,
        quantity: formatDecimalStringForInput('1', DECIMAL_FRACTION_DIGITS),
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
    setPickModalOpen(false)
  }

  const updateQty = (idx: number, v: string) => {
    const next = relatedItems.map((r, i) =>
      i === idx ? { ...r, quantity: filterDecimalInput(v, DECIMAL_FRACTION_DIGITS) } : r,
    )
    onRelatedChange(next)
  }

  const removeRelated = (idx: number) => {
    onRelatedChange(relatedItems.filter((_, i) => i !== idx))
  }

  const sumRelated = relatedItems.reduce(
    (acc, r) =>
      acc + (parseFloat(lineTotalRelated(r.quantity, r.related_material.base_price)) || 0),
    0,
  )
  const mainP = parseFloat(normalizeDecimalOnBlur(basePrice)) || 0
  const grand = mainP + sumRelated

  return (
    <div className="mat-extras">
      <div className="mat-extras-stack">
        <section
          className="mat-extras-block mat-extras-block-related"
          aria-labelledby="mat-extras-related-heading"
        >
          <div className="mat-extras-head">
            <h3 id="mat-extras-related-heading" className="mat-extras-title">
              Сопутствующие материалы
            </h3>
            <button
              type="button"
              className="mat-extras-plus admin-primary"
              onClick={() => setPickModalOpen(true)}
              title="Добавить сопутствующий материал из базы"
            >
              + Сопутствующий материал
            </button>
          </div>
          {pickModalOpen ? (
            <MaterialRelatedPickModal
              tree={categoryTree}
              excludedIds={excludedIds}
              onPick={addRelated}
              onClose={() => setPickModalOpen(false)}
            />
          ) : null}
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
              <li className="admin-muted mat-extras-empty">
                Нет строк — нажмите «+ Сопутствующий материал», в окне выберите папку или введите поиск.
              </li>
            )}
            {relatedItems.map((r, i) => (
              <li key={r.id ?? `r-${r.related_material_id}-${i}`} className="mat-extras-row">
                <span title="Артикул">{r.related_material.article || '—'}</span>
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
                          ? { ...row, quantity: normalizeDecimalForInput(row.quantity, DECIMAL_FRACTION_DIGITS) }
                          : row,
                      ),
                    )
                  }
                />
                <FtSelect
                  className="mat-extras-uom-select"
                  compact
                  value={r.related_material.uom?.id != null ? String(r.related_material.uom.id) : ''}
                  disabled={savingUomByMaterialId[r.related_material_id] === true}
                  title="Ед. изм. сопутствующего материала (сохраняется в базе материалов)"
                  onChange={async (v) => {
                    const nextUomId = Number(v)
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
                          j === i ? { ...row, related_material: { ...row.related_material, uom: nextUom } } : row,
                        ),
                      )
                    } catch (err) {
                      setUomSaveErr(err instanceof Error ? err.message : String(err))
                      onRelatedChange([...relatedItems])
                    } finally {
                      setSavingUomByMaterialId((prev) => {
                        const next = { ...prev }
                        delete next[matId]
                        return next
                      })
                    }
                  }}
                  options={[
                    { value: '', label: '—' },
                    ...sortedUom.map((u) => ({
                      value: String(u.id),
                      label: u.short_name || u.name,
                    })),
                  ]}
                />
                <FtSelect
                  compact
                  value={r.quantity_scale}
                  title="Как умножать строку в калькуляторе (см. текст предпросчёта ниже в этой панели)"
                  onChange={(v) =>
                    onRelatedChange(
                      relatedItems.map((row, j) =>
                        j === i ? { ...row, quantity_scale: v as RelatedQuantityScale } : row,
                      ),
                    )
                  }
                  options={[
                    { value: 'follow_parent', label: 'Как у основного' },
                    { value: 'per_facade', label: 'На фасад' },
                    { value: 'use_related_uom', label: 'По ед. изм. строки' },
                  ]}
                />
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
      </div>
      <p className="mat-extras-total" aria-live="polite">
        Предв. оценка (карточка, без габаритов): основной {formatNumberForUi(mainP, DECIMAL_FRACTION_DIGITS)} +
        сопутствующие материалы {formatNumberForUi(sumRelated, DECIMAL_FRACTION_DIGITS)} ={' '}
        <strong>
          {formatNumberForUi(grand, DECIMAL_FRACTION_DIGITS)} {BASE_CURRENCY}
        </strong>
        .
      </p>
    </div>
  )
}
