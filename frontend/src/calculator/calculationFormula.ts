import type { CalculationFormula, CalculationFormulaToken, Material } from '../types'
import {
  materialLineCost,
  parseMoney,
  pricedUnitsForMaterial,
  relatedItemCalculatorCost,
} from './framePriceEstimate'

type ClassValue = {
  classId: number
  value: number
}

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
}

function applyOp(op: string, b: number, a: number): number | null {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '*') return a * b
  if (op === '/') return b === 0 ? null : a / b
  return null
}

export function formulaDisplayExpression(tokens: CalculationFormulaToken[]): string {
  return tokens
    .map((t) => {
      if (t.type === 'class') return t.label || `Класс #${t.class_id}`
      if (t.type === 'number') return String(t.value)
      return t.value
    })
    .join(' ')
}

type ClassIdsWalk = {
  material_class_ids?: number[]
  related_items?: ReadonlyArray<{ related_material?: ClassIdsWalk | null | undefined }>
}

function addMaterialClassIdsToSet(material: ClassIdsWalk | null | undefined, into: Set<number>): void {
  if (!material) return
  for (const id of material.material_class_ids ?? []) into.add(Number(id))
  for (const r of material.related_items ?? []) {
    addMaterialClassIdsToSet(r.related_material, into)
  }
}

/** Все классы на цвете профиля/наполнении и связанных материалах (для сопоставления с формулой). */
export function collectMaterialTreeClassIds(
  colorMaterial: Material | null,
  fillingMaterial: Material | null
): Set<number> {
  const ids = new Set<number>()
  addMaterialClassIdsToSet(colorMaterial, ids)
  addMaterialClassIdsToSet(fillingMaterial, ids)
  return ids
}

export function formulaReferencedClassIds(formula: CalculationFormula | null | undefined): number[] {
  if (!formula?.tokens?.length) return []
  const raw = formula.tokens.filter((t) => t.type === 'class').map((t) => Number(t.class_id))
  return [...new Set(raw.filter((n) => Number.isFinite(n) && n > 0))]
}

/** Все классы из токенов формулы есть у выбранных материалов (или сопутствующих к ним). */
export function formulaAppliesToSelection(
  formula: CalculationFormula | null | undefined,
  colorMaterial: Material | null,
  fillingMaterial: Material | null
): boolean {
  const refs = formulaReferencedClassIds(formula)
  if (!refs.length) return false
  const available = collectMaterialTreeClassIds(colorMaterial, fillingMaterial)
  return refs.every((id) => available.has(id))
}

export function selectedClassValues(
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number
): ClassValue[] {
  const out: ClassValue[] = []
  const fc = Math.max(0, facadeCount)

  const addMaterial = (material: Material | null, value: number) => {
    for (const classId of material?.material_class_ids ?? []) {
      out.push({ classId: Number(classId), value })
    }
  }

  const colorGeom = colorMaterial && fc > 0 ? pricedUnitsForMaterial(colorMaterial, heightMm, widthMm, fc) : 0
  const fillingGeom = fillingMaterial && fc > 0 ? pricedUnitsForMaterial(fillingMaterial, heightMm, widthMm, fc) : 0

  addMaterial(colorMaterial, materialLineCost(colorMaterial, heightMm, widthMm, fc))
  addMaterial(fillingMaterial, materialLineCost(fillingMaterial, heightMm, widthMm, fc))

  for (const r of colorMaterial?.related_items ?? []) {
    for (const classId of r.related_material.material_class_ids ?? []) {
      out.push({
        classId: Number(classId),
        value: relatedItemCalculatorCost(r, colorGeom, heightMm, widthMm, fc),
      })
    }
  }

  for (const r of fillingMaterial?.related_items ?? []) {
    for (const classId of r.related_material.material_class_ids ?? []) {
      out.push({
        classId: Number(classId),
        value: relatedItemCalculatorCost(r, fillingGeom, heightMm, widthMm, fc),
      })
    }
  }

  return out
}

export function evaluateCalculationFormula(
  formula: CalculationFormula | null | undefined,
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number
): number | null {
  if (!formula?.tokens?.length) return null
  const classValues = selectedClassValues(colorMaterial, fillingMaterial, heightMm, widthMm, facadeCount)
  const values: number[] = []
  const ops: string[] = []

  const valueForClass = (classId: number) =>
    classValues.reduce((sum, row) => (row.classId === classId ? sum + row.value : sum), 0)

  const reduceTop = (): boolean => {
    const op = ops.pop()
    if (!op || values.length < 2) return false
    const b = values.pop() ?? 0
    const a = values.pop() ?? 0
    const next = applyOp(op, b, a)
    if (next == null || !Number.isFinite(next)) return false
    values.push(next)
    return true
  }

  for (const token of formula.tokens) {
    if (token.type === 'class') {
      values.push(valueForClass(Number(token.class_id)))
      continue
    }
    if (token.type === 'number') {
      values.push(parseMoney(token.value))
      continue
    }
    const op = token.value
    if (op === '(') {
      ops.push(op)
      continue
    }
    if (op === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        if (!reduceTop()) return null
      }
      if (ops.pop() !== '(') return null
      continue
    }
    while (
      ops.length &&
      ops[ops.length - 1] !== '(' &&
      PRECEDENCE[ops[ops.length - 1] ?? ''] >= PRECEDENCE[op]
    ) {
      if (!reduceTop()) return null
    }
    ops.push(op)
  }

  while (ops.length) {
    if (ops[ops.length - 1] === '(') return null
    if (!reduceTop()) return null
  }
  return values.length === 1 && Number.isFinite(values[0]) ? values[0] : null
}

/** Первая подходящая формула и её значение по выбранным материалам. */
export function matchFormulaTotalForFrame(
  formulas: CalculationFormula[],
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number
): { formula: CalculationFormula; total: number } | null {
  const sorted = [...formulas].sort((a, b) => {
    const ao = Number(a.sort_order ?? 0)
    const bo = Number(b.sort_order ?? 0)
    if (ao !== bo) return ao - bo
    return (a.name || '').localeCompare(b.name || '', 'ru')
  })
  for (const f of sorted) {
    if (!formulaAppliesToSelection(f, colorMaterial, fillingMaterial)) continue
    const total = evaluateCalculationFormula(f, colorMaterial, fillingMaterial, heightMm, widthMm, facadeCount)
    if (total != null) return { formula: f, total }
  }
  return null
}
