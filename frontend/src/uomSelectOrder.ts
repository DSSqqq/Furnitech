import type { UnitOfMeasure } from './types'

/** Порядок единиц в выпадающих списках (код из API). */
export const UOM_SELECT_ORDER = [
  'pc',
  'm2',
  'm',
  'mp',
  'm3',
  'kg',
  'sheet',
  'mm',
  'l',
  'roll',
  'pack',
  'tg',
  'pair',
] as const

const ORDER_MAP = new Map<string, number>(UOM_SELECT_ORDER.map((code, i) => [code, i]))

export function sortUomForSelect(list: UnitOfMeasure[]): UnitOfMeasure[] {
  return [...list].sort((a, b) => {
    const ca = (a.code ?? '').trim().toLowerCase()
    const cb = (b.code ?? '').trim().toLowerCase()
    const ia = ORDER_MAP.has(ca) ? ORDER_MAP.get(ca)! : 1000
    const ib = ORDER_MAP.has(cb) ? ORDER_MAP.get(cb)! : 1000
    if (ia !== ib) return ia - ib
    return (a.short_name || a.name || '').localeCompare(b.short_name || b.name || '', 'ru')
  })
}
