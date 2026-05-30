import type { Material, MaterialRelatedItemDto, PricingCalcMode, RelatedQuantityScale, RoundingMode } from '../types'
import {
  parseExcessCoefficient,
  parseMoney,
  pricedUnitsForMaterial,
  relatedItemCalculatorCost,
  resolveMaterialPricingUomCode,
  unitsPerFacade,
  type PricingUomCode,
} from './framePriceEstimate'

export type MaterialLineSource = 'profile' | 'filling' | 'related' | 'hinge'

export type MaterialLineBreakdown = {
  materialId: number
  name: string
  classIds: number[]
  pricingMode: PricingCalcMode | 'fallback'
  uomCode: PricingUomCode
  uomLabel: string
  geomPerFacade: number
  facadeCount: number
  excessCoefficient: number
  /** geomPerFacade × facadeCount (до запаса) */
  quantityRaw: number
  /** Количество после запаса, до округления */
  quantityWithExcess: number
  /** Количество для × цены (после округления, если задано в карточке) */
  quantityBilled: number
  /** Если округление изменило quantityWithExcess — исходное значение */
  quantityBeforeRounding: number | null
  /** Цена за ед. изм. материала */
  unitPrice: number
  /** Количество из строки сопутствующего (1 для основного материала) */
  lineQuantity: number
  subtotal: number
  source: MaterialLineSource
  quantityScale?: RelatedQuantityScale
  parentSource?: 'profile' | 'filling' | 'hinge'
}

export type ClassBreakdownStep = {
  classId: number
  subtotal: number
  lines: MaterialLineBreakdown[]
}

/** Округление количества вверх по правилам карточки материала. */
export function applyQuantityRounding(
  quantity: number,
  material: Pick<Material, 'rounding_mode' | 'rounding_multiple'> | null | undefined,
): { quantityBilled: number; quantityBeforeRounding: number | null } {
  if (!material || !Number.isFinite(quantity)) {
    return { quantityBilled: quantity, quantityBeforeRounding: null }
  }
  const mode: RoundingMode = material.rounding_mode ?? 'none'
  if (mode === 'none') {
    return { quantityBilled: quantity, quantityBeforeRounding: null }
  }
  if (mode === 'ceil_unit') {
    const billed = Math.ceil(quantity)
    return {
      quantityBilled: billed,
      quantityBeforeRounding: billed !== quantity ? quantity : null,
    }
  }
  if (mode === 'ceil_multiple') {
    const mult = parseMoney(material.rounding_multiple)
    if (!Number.isFinite(mult) || mult <= 0) {
      const billed = Math.ceil(quantity)
      return {
        quantityBilled: billed,
        quantityBeforeRounding: billed !== quantity ? quantity : null,
      }
    }
    const billed = Math.ceil(quantity / mult) * mult
    return {
      quantityBilled: billed,
      quantityBeforeRounding: billed !== quantity ? quantity : null,
    }
  }
  return { quantityBilled: quantity, quantityBeforeRounding: null }
}

function normalizeRelatedScale(s: RelatedQuantityScale | undefined | null): RelatedQuantityScale {
  if (s === 'per_facade' || s === 'use_related_uom') return s
  return 'follow_parent'
}

/** Подпись ед. изм. для UI (как в CalcPriceTotals). */
export function pricingUomLabel(
  material: Pick<Material, 'uom' | 'pricing_calc_mode'> | null | undefined,
  code: PricingUomCode,
): string {
  if (code === 'm2') return 'м²'
  if (code === 'm') {
    if (material?.pricing_calc_mode === 'linear') return 'м.п.'
    const raw = (material?.uom?.code ?? '').trim().toLowerCase()
    return raw === 'mp' ? 'м.п.' : 'м'
  }
  if (code === 'pc') return 'шт'
  return material?.uom?.short_name || material?.uom?.name || 'шт'
}

export function buildMaterialLine(
  material: Material,
  heightMm: number,
  widthMm: number,
  facadeCount: number,
  source: 'profile' | 'filling',
): MaterialLineBreakdown | null {
  const fc = Math.max(0, facadeCount)
  if (fc <= 0) return null
  const code = resolveMaterialPricingUomCode(material)
  const geomPerFacade = unitsPerFacade(heightMm, widthMm, code)
  const excessCoefficient = parseExcessCoefficient(material)
  const quantityRaw = geomPerFacade * fc
  const quantityWithExcess = quantityRaw * excessCoefficient
  const { quantityBilled, quantityBeforeRounding } = applyQuantityRounding(quantityWithExcess, material)
  const unitPrice = parseMoney(material.base_price)
  return {
    materialId: material.id,
    name: material.name,
    classIds: [...(material.material_class_ids ?? [])].map(Number),
    pricingMode: material.pricing_calc_mode || 'fallback',
    uomCode: code,
    uomLabel: pricingUomLabel(material, code),
    geomPerFacade,
    facadeCount: fc,
    excessCoefficient,
    quantityRaw,
    quantityWithExcess,
    quantityBilled,
    quantityBeforeRounding,
    unitPrice,
    lineQuantity: 1,
    subtotal: quantityBilled * unitPrice,
    source,
  }
}

export function buildRelatedLine(
  item: MaterialRelatedItemDto,
  parentGeomUnits: number,
  heightMm: number,
  widthMm: number,
  facadeCount: number,
  parentSource: 'profile' | 'filling' | 'hinge',
): MaterialLineBreakdown | null {
  const rm = item.related_material
  const fc = Math.max(0, facadeCount)
  if (!rm || fc <= 0) return null
  const scale = normalizeRelatedScale(item.quantity_scale)
  const material = rm as unknown as Material
  const code = resolveMaterialPricingUomCode(material)
  const lineQuantity = parseMoney(item.quantity)
  const unitPrice = parseMoney(rm.base_price)
  const subtotal = relatedItemCalculatorCost(item, parentGeomUnits, heightMm, widthMm, fc)

  let geomPerFacade = 0
  let quantityRaw = 0
  let quantityWithExcess = 0
  let excessCoefficient = 1

  if (scale === 'per_facade') {
    geomPerFacade = 1
    quantityRaw = fc
    quantityWithExcess = fc
    excessCoefficient = 1
  } else if (scale === 'use_related_uom') {
    geomPerFacade = unitsPerFacade(heightMm, widthMm, code)
    quantityRaw = geomPerFacade * fc
    excessCoefficient = parseExcessCoefficient(material)
    quantityWithExcess = pricedUnitsForMaterial(material, heightMm, widthMm, fc)
  } else {
    geomPerFacade = fc > 0 ? parentGeomUnits / fc : 0
    quantityRaw = parentGeomUnits
    quantityWithExcess = parentGeomUnits
    excessCoefficient = 1
  }

  const quantityBilled = quantityWithExcess
  const quantityBeforeRounding: number | null = null

  return {
    materialId: rm.id,
    name: rm.name,
    classIds: [...(rm.material_class_ids ?? [])].map(Number),
    pricingMode: rm.pricing_calc_mode || 'fallback',
    uomCode: code,
    uomLabel: pricingUomLabel(material, code),
    geomPerFacade,
    facadeCount: fc,
    excessCoefficient,
    quantityRaw,
    quantityWithExcess,
    quantityBilled,
    quantityBeforeRounding,
    unitPrice,
    lineQuantity,
    subtotal,
    source: 'related',
    quantityScale: scale,
    parentSource,
  }
}

/** Петли производства: шт (или иной режим) × число на фасад × число фасадов. */
export function buildHingeMaterialLine(
  material: Material,
  heightMm: number,
  widthMm: number,
  facadeCount: number,
  hingesPerFacade: number,
): MaterialLineBreakdown | null {
  const hpf = Math.max(1, Math.floor(hingesPerFacade))
  const fc = Math.max(0, facadeCount)
  if (fc <= 0) return null
  const code = resolveMaterialPricingUomCode(material)
  const excessCoefficient = parseExcessCoefficient(material)
  const geomPerFacade =
    code === 'pc' ? hpf : unitsPerFacade(heightMm, widthMm, code) * hpf
  const quantityRaw = geomPerFacade * fc
  const quantityWithExcess = quantityRaw * excessCoefficient
  const { quantityBilled, quantityBeforeRounding } = applyQuantityRounding(quantityWithExcess, material)
  const unitPrice = parseMoney(material.base_price)
  return {
    materialId: material.id,
    name: material.name,
    classIds: [...(material.material_class_ids ?? [])].map(Number),
    pricingMode: material.pricing_calc_mode || 'fallback',
    uomCode: code,
    uomLabel: pricingUomLabel(material, code),
    geomPerFacade,
    facadeCount: fc,
    excessCoefficient,
    quantityRaw,
    quantityWithExcess,
    quantityBilled,
    quantityBeforeRounding,
    unitPrice,
    lineQuantity: hpf,
    subtotal: quantityBilled * unitPrice,
    source: 'hinge',
  }
}

/** Все строки расчёта для выбранных материалов профиля, наполнения и петель. */
export function collectFrameMaterialLines(
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number,
  hingeMaterial?: Material | null,
  hingesPerFacade?: number | null,
): MaterialLineBreakdown[] {
  const fc = Math.max(0, facadeCount)
  const lines: MaterialLineBreakdown[] = []

  if (colorMaterial && fc > 0) {
    const main = buildMaterialLine(colorMaterial, heightMm, widthMm, fc, 'profile')
    if (main) lines.push(main)
    const colorGeom = main?.quantityBilled ?? 0
    for (const r of colorMaterial.related_items ?? []) {
      const rel = buildRelatedLine(r, colorGeom, heightMm, widthMm, fc, 'profile')
      if (rel) lines.push(rel)
    }
  }

  if (fillingMaterial && fc > 0) {
    const main = buildMaterialLine(fillingMaterial, heightMm, widthMm, fc, 'filling')
    if (main) lines.push(main)
    const fillGeom = main?.quantityBilled ?? 0
    for (const r of fillingMaterial.related_items ?? []) {
      const rel = buildRelatedLine(r, fillGeom, heightMm, widthMm, fc, 'filling')
      if (rel) lines.push(rel)
    }
  }

  const hpf =
    hingeMaterial && hingesPerFacade != null && hingesPerFacade > 0
      ? Math.floor(hingesPerFacade)
      : 0
  if (hingeMaterial && hpf > 0 && fc > 0) {
    const main = buildHingeMaterialLine(hingeMaterial, heightMm, widthMm, fc, hpf)
    if (main) lines.push(main)
    const hingeGeom = main?.quantityBilled ?? 0
    for (const r of hingeMaterial.related_items ?? []) {
      const rel = buildRelatedLine(r, hingeGeom, heightMm, widthMm, fc, 'hinge')
      if (rel) lines.push(rel)
    }
  }

  return lines
}

export function buildClassBreakdown(lines: MaterialLineBreakdown[], classId: number): ClassBreakdownStep {
  const matched = lines.filter((l) => l.classIds.includes(classId))
  return {
    classId,
    subtotal: matched.reduce((s, l) => s + l.subtotal, 0),
    lines: matched,
  }
}

/** Сумма subtotal по классу (как valueForClass в формуле). */
export function classSubtotalFromLines(lines: MaterialLineBreakdown[], classId: number): number {
  return buildClassBreakdown(lines, classId).subtotal
}

export function buildAllClassBreakdowns(
  lines: MaterialLineBreakdown[],
  classIds?: number[],
): ClassBreakdownStep[] {
  const ids =
    classIds && classIds.length > 0
      ? classIds
      : [...new Set(lines.flatMap((l) => l.classIds))]
  return ids.map((id) => buildClassBreakdown(lines, id)).filter((s) => s.lines.length > 0 || s.subtotal > 0)
}

/** Компактный снимок для заказа (optional поле в snapshot). */
export function serializePriceBreakdownForSnapshot(
  formulaMatch: import('./calculationFormula').FormulaMatchResult | null,
  base: { profile: number; related: number; filling: number; hinges: number; total: number },
): Record<string, unknown> {
  if (formulaMatch) {
    return {
      mode: 'formula',
      formulaName: formulaMatch.formula.name,
      expression: formulaMatch.evaluation.expression,
      total: formulaMatch.total,
      classes: formulaMatch.evaluation.classSteps.map((step) => ({
        classId: step.classId,
        code: step.classCode,
        subtotal: step.subtotal,
        lines: step.lines.map((l) => ({
          name: l.name,
          quantityBilled: l.quantityBilled,
          uomLabel: l.uomLabel,
          excessCoefficient: l.excessCoefficient,
          unitPrice: l.unitPrice,
          subtotal: l.subtotal,
        })),
      })),
    }
  }
  return {
    mode: 'standard',
    profile: base.profile,
    related: base.related,
    filling: base.filling,
    hinges: base.hinges,
    total: base.total,
  }
}

export function sumLinesBySource(
  lines: MaterialLineBreakdown[],
): { profile: number; related: number; filling: number; hinges: number } {
  let profile = 0
  let related = 0
  let filling = 0
  let hinges = 0
  for (const l of lines) {
    if (l.source === 'profile') profile += l.subtotal
    else if (l.source === 'filling') filling += l.subtotal
    else if (l.source === 'hinge') hinges += l.subtotal
    else if (l.source === 'related') {
      if (l.parentSource === 'filling') filling += l.subtotal
      else if (l.parentSource === 'hinge') hinges += l.subtotal
      else related += l.subtotal
    }
  }
  return { profile, related, filling, hinges }
}
