import { normalizeDecimalOnBlur } from '../floatInput'
import type { Material, MaterialRelatedItemDto, RelatedQuantityScale, UnitOfMeasure } from '../types'

export function parseMoney(s: string | undefined | null): number {
  if (s == null || s === '') return 0
  return parseFloat(normalizeDecimalOnBlur(String(s)).replace(',', '.')) || 0
}

/** Код ед. изм. для расчёта: m2 | m | pc. Если в БД пустой `code`, угадываем по подписи (как у старых записей). */
export function resolvePricingUomCode(u: UnitOfMeasure | undefined | null): string {
  if (!u) return 'm2'

  const raw = (u.code ?? '').trim().toLowerCase()
  if (raw === 'mp') return 'm'
  if (raw === 'm2' || raw === 'm' || raw === 'pc') return raw
  // Единицы без геометрии фасада в формуле — как «шт» (1× цена за единицу на фасад).
  const pieceLike = new Set(['m3', 'kg', 'l', 'sheet', 'mm', 'roll', 'pack', 'tg', 'pair'])
  if (pieceLike.has(raw)) return 'pc'

  const short = (u.short_name ?? '').trim().toLowerCase()
  const name = (u.name ?? '').trim().toLowerCase()
  const hay = `${short} ${name}`

  if (
    hay.includes('м²') ||
    hay.includes('m²') ||
    hay.includes('м2') ||
    hay.includes('кв.м') ||
    hay.includes('кв м') ||
    hay.includes('квадрат')
  ) {
    return 'm2'
  }
  if (hay.includes('куб') || hay.includes('м³') || hay.includes('m³')) {
    return 'pc'
  }
  if (
    hay.includes('погон') ||
    hay.includes('м.п') ||
    hay.includes('м. п') ||
    hay.includes('п.п') ||
    hay.includes('п.м') ||
    (short === 'м' &&
      !hay.includes('кв') &&
      !hay.includes('куб') &&
      !hay.includes('м²') &&
      !hay.includes('м2'))
  ) {
    return 'm'
  }
  if (
    hay.includes('шт') ||
    hay.includes('штук') ||
    hay.includes('кг') ||
    hay.includes('литр') ||
    hay.includes('лист') ||
    hay.includes('рулон') ||
    hay.includes('упак') ||
    hay.includes('пара') ||
    hay.includes('тенге') ||
    hay.includes('миллиметр') ||
    short === 'мм' ||
    short === 'тг'
  ) {
    return 'pc'
  }

  // Нет ни code, ни узнаваемой подписи — для фасада считаем по площади, иначе шаг 3 не влияет на цену.
  return 'm2'
}

function uomCode(u: UnitOfMeasure | undefined | null): string {
  return resolvePricingUomCode(u)
}

function effectivePricingUomCode(material: Pick<Material, 'uom'> | null | undefined): string {
  if (!material) return 'm2'
  return uomCode(material.uom)
}

/**
 * Нормируем количество единиц цены для одного фасада по ед. изм. материала:
 * - м² — площадь по габаритам; м.п. — периметр в метрах; шт / иное — 1 на фасад.
 */
export function unitsPerFacade(heightMm: number, widthMm: number, code: string): number {
  const h = Math.max(0, heightMm)
  const w = Math.max(0, widthMm)
  if (code === 'm2') return (h * w) / 1_000_000
  if (code === 'm') return (2 * (h + w)) / 1000
  return 1
}

export function pricedUnitsForMaterial(
  material: Pick<Material, 'uom'> | null | undefined,
  heightMm: number,
  widthMm: number,
  facadeCount: number
): number {
  if (!material || facadeCount <= 0) return 0
  const code = effectivePricingUomCode(material)
  return unitsPerFacade(heightMm, widthMm, code) * facadeCount
}

export function materialLineCost(
  material: Material | null | undefined,
  heightMm: number,
  widthMm: number,
  facadeCount: number
): number {
  if (!material) return 0
  const units = pricedUnitsForMaterial(material, heightMm, widthMm, facadeCount)
  return units * parseMoney(material.base_price)
}

function normalizeRelatedScale(s: RelatedQuantityScale | undefined | null): RelatedQuantityScale {
  if (s === 'per_facade' || s === 'use_related_uom') return s
  return 'follow_parent'
}

/**
 * Сумма по сопутствующим в калькуляторе: каждая строка по своему quantity_scale.
 * @param parentGeomUnits — уже посчитанные единицы цены родителя (м²/м.п./шт × фасады), как pricedUnitsForMaterial(parent).
 */
export function relatedItemsCalculatorCost(
  items: MaterialRelatedItemDto[] | undefined | null,
  parentGeomUnits: number,
  heightMm: number,
  widthMm: number,
  facadeCount: number
): number {
  if (!items?.length) return 0
  const fc = Math.max(0, facadeCount)
  let sum = 0
  for (const r of items) {
    const unit = parseMoney(r.quantity) * parseMoney(r.related_material.base_price)
    const scale = normalizeRelatedScale(r.quantity_scale)
    if (scale === 'per_facade') {
      sum += unit * fc
    } else if (scale === 'use_related_uom') {
      const g = pricedUnitsForMaterial(r.related_material, heightMm, widthMm, fc)
      sum += unit * g
    } else {
      sum += unit * parentGeomUnits
    }
  }
  return sum
}

export type FramePriceBreakdown = {
  profile: number
  related: number
  filling: number
  total: number
}

/**
 * Профиль: цена за ед. изм. × геометрический объём (м² / п.м. периметра / шт).
 * Сопутствующие: режим на строке (как у родителя / на фасад / по ед. изм. сопутствующего).
 * Наполнение: основной материал × geomFill; его сопутствующие — та же поштучная логика.
 */
export function computeFramePriceBreakdown(
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number
): FramePriceBreakdown {
  const fc = Math.max(0, facadeCount)
  const geomColor =
    colorMaterial && fc > 0 ? pricedUnitsForMaterial(colorMaterial, heightMm, widthMm, fc) : 0
  const mainUnit = colorMaterial ? parseMoney(colorMaterial.base_price) : 0
  const profile = mainUnit * geomColor
  const related = relatedItemsCalculatorCost(
    colorMaterial?.related_items,
    geomColor,
    heightMm,
    widthMm,
    fc
  )

  const geomFill =
    fillingMaterial && fc > 0 ? pricedUnitsForMaterial(fillingMaterial, heightMm, widthMm, fc) : 0
  const fillMain = fillingMaterial ? parseMoney(fillingMaterial.base_price) : 0
  const fillingMain = fillMain * geomFill
  const fillingRelated = relatedItemsCalculatorCost(
    fillingMaterial?.related_items,
    geomFill,
    heightMm,
    widthMm,
    fc
  )
  const filling = fillingMain + fillingRelated

  return {
    profile,
    related,
    filling,
    total: profile + related + filling,
  }
}

export function collectCurrencies(
  colorMaterial: Material | null,
  fillingMaterial: Material | null
): string[] {
  const s = new Set<string>()
  if (colorMaterial?.base_currency) s.add(colorMaterial.base_currency)
  if (fillingMaterial?.base_currency) s.add(fillingMaterial.base_currency)
  for (const r of colorMaterial?.related_items ?? []) {
    if (r.related_material?.base_currency) s.add(r.related_material.base_currency)
  }
  for (const r of fillingMaterial?.related_items ?? []) {
    if (r.related_material?.base_currency) s.add(r.related_material.base_currency)
  }
  return [...s]
}
