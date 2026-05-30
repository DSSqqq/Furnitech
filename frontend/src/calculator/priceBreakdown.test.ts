import { describe, expect, it } from 'vitest'
import type { Material, MaterialRelatedItemDto } from '../types'
import { pricedUnitsForMaterial, relatedItemCalculatorCost } from './framePriceEstimate'
import { buildHingeMaterialLine, buildMaterialLine, collectFrameMaterialLines } from './priceBreakdown'

function mockMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 1,
    category: 1,
    name: 'Профиль тест',
    material_class_ids: [10],
    uom: { id: 1, name: 'Метр', short_name: 'м', code: 'm' },
    uom_id: 1,
    base_currency: 'KZT',
    base_price: '1000',
    note: '',
    rounding_mode: 'none',
    rounding_multiple: null,
    is_active: true,
    external_id: null,
    pricing_calc_mode: 'linear',
    excess_coefficient: '1',
    ...overrides,
  }
}

describe('priceBreakdown', () => {
  it('linear excess 1.1: 500×2000 мм → 5 м.п. × 1.1 = 5.5', () => {
    const m = mockMaterial({ excess_coefficient: '1.1' })
    const line = buildMaterialLine(m, 500, 2000, 1, 'profile')
    expect(line).not.toBeNull()
    expect(line!.geomPerFacade).toBeCloseTo(5, 4)
    expect(line!.quantityRaw).toBeCloseTo(5, 4)
    expect(line!.quantityWithExcess).toBeCloseTo(5.5, 4)
    expect(line!.quantityBilled).toBeCloseTo(5.5, 4)
    expect(line!.subtotal).toBeCloseTo(5500, 2)
    expect(pricedUnitsForMaterial(m, 500, 2000, 1)).toBeCloseTo(5.5, 4)
  })

  it('sheet mode: area × 3 facades', () => {
    const m = mockMaterial({
      pricing_calc_mode: 'sheet',
      excess_coefficient: '1',
      base_price: '100',
    })
    const line = buildMaterialLine(m, 500, 2000, 3, 'filling')
    expect(line!.geomPerFacade).toBeCloseTo(1, 4)
    expect(line!.quantityBilled).toBeCloseTo(3, 4)
    expect(line!.subtotal).toBeCloseTo(300, 2)
  })

  it('piece mode with excess 1.2', () => {
    const m = mockMaterial({
      pricing_calc_mode: 'piece',
      excess_coefficient: '1.2',
      base_price: '50',
    })
    const line = buildMaterialLine(m, 500, 2000, 2, 'profile')
    expect(line!.quantityBilled).toBeCloseTo(2.4, 4)
    expect(line!.subtotal).toBeCloseTo(120, 2)
  })

  it('related follow_parent uses parent billed units', () => {
    const parent = mockMaterial({ excess_coefficient: '1.1', base_price: '1000' })
    const parentLine = buildMaterialLine(parent, 500, 2000, 1, 'profile')!
    const related: MaterialRelatedItemDto = {
      id: 1,
      related_material_id: 2,
      related_material: {
        id: 2,
        name: 'Уголок',
        uom: { id: 1, name: 'шт', short_name: 'шт', code: 'pc' },
        base_price: '200',
        base_currency: 'KZT',
        material_class_ids: [20],
      },
      quantity: '2',
      quantity_scale: 'follow_parent',
      line_total: '0',
    }
    const sub = relatedItemCalculatorCost(related, parentLine.quantityBilled, 500, 2000, 1)
    expect(sub).toBeCloseTo(2 * 200 * parentLine.quantityBilled, 2)
  })

  it('hinge piece: 3 per facade × 2 facades', () => {
    const hinge = mockMaterial({
      id: 5,
      name: 'Петля',
      pricing_calc_mode: 'piece',
      base_price: '100',
      excess_coefficient: '1',
    })
    const line = buildHingeMaterialLine(hinge, 500, 2000, 2, 3)
    expect(line!.geomPerFacade).toBe(3)
    expect(line!.quantityBilled).toBe(6)
    expect(line!.subtotal).toBe(600)
  })

  it('collectFrameMaterialLines sums match profile+filling buckets', () => {
    const color = mockMaterial({ material_class_ids: [1] })
    const fill = mockMaterial({
      id: 2,
      name: 'Стекло',
      material_class_ids: [2],
      pricing_calc_mode: 'sheet',
      base_price: '500',
    })
    const lines = collectFrameMaterialLines(color, fill, 500, 2000, 1)
    const total = lines.reduce((s, l) => s + l.subtotal, 0)
    expect(total).toBeGreaterThan(0)
    expect(lines.some((l) => l.source === 'profile')).toBe(true)
    expect(lines.some((l) => l.source === 'filling')).toBe(true)
  })
})
