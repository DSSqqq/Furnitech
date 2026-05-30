import type { CalculationFormula, CalculationFormulaToken, Material } from '../types'
import { parseMoney } from './framePriceEstimate'
import {
  buildClassBreakdown,
  classSubtotalFromLines,
  collectFrameMaterialLines,
  type ClassBreakdownStep,
  type MaterialLineBreakdown,
} from './priceBreakdown'

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

const CLASS_TOKEN_LEGACY_PREFIX = /^Класс:\s*/u

/** Подпись токена класса в поле формулы — только код (или имя, если кода нет). */
export function materialClassFormulaTokenLabel(c: {
  id: number
  code: string
  name: string
}): string {
  const code = (c.code ?? '').trim()
  if (code) return code
  const name = (c.name ?? '').trim()
  if (name) return name
  return `#${c.id}`
}

export function syncClassTokenLabels(
  tokens: CalculationFormulaToken[],
  classesById: ReadonlyMap<number, { id: number; code: string; name: string }>,
): CalculationFormulaToken[] {
  return tokens.map((t) => {
    if (t.type !== 'class') return t
    const cls = classesById.get(t.class_id)
    if (!cls) return t
    const label = materialClassFormulaTokenLabel(cls)
    return t.label === label ? t : { ...t, label }
  })
}

export function formulaTokenDisplayLabel(t: CalculationFormulaToken): string {
  if (t.type === 'class') {
    const raw = t.label?.trim()
    if (!raw) return `#${t.class_id}`
    return raw.replace(CLASS_TOKEN_LEGACY_PREFIX, '').trim() || `#${t.class_id}`
  }
  if (t.type === 'number') return String(t.value)
  return t.value
}

export function formulaDisplayExpression(tokens: CalculationFormulaToken[]): string {
  return tokens.map(formulaTokenDisplayLabel).join('')
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
  fillingMaterial: Material | null,
  hingeMaterial?: Material | null,
): Set<number> {
  const ids = new Set<number>()
  addMaterialClassIdsToSet(colorMaterial, ids)
  addMaterialClassIdsToSet(fillingMaterial, ids)
  addMaterialClassIdsToSet(hingeMaterial, ids)
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
  fillingMaterial: Material | null,
  hingeMaterial?: Material | null,
): boolean {
  const refs = formulaReferencedClassIds(formula)
  if (!refs.length) return false
  const available = collectMaterialTreeClassIds(colorMaterial, fillingMaterial, hingeMaterial)
  return refs.every((id) => available.has(id))
}

/** Сумма петель, не входящих в токены формулы (чтобы не дублировать класс в формуле). */
export function hingeSubtotalOutsideFormula(
  lines: MaterialLineBreakdown[],
  formula: CalculationFormula | null | undefined,
): number {
  const refs = new Set(formulaReferencedClassIds(formula))
  let sum = 0
  for (const l of lines) {
    if (l.source !== 'hinge' && !(l.source === 'related' && l.parentSource === 'hinge')) continue
    if (l.classIds.some((id) => refs.has(id))) continue
    sum += l.subtotal
  }
  return sum
}

export type FormulaClassStep = ClassBreakdownStep & {
  classCode?: string
  /** Порядок в выражении формулы */
  tokenIndex?: number
}

export type FormulaEvaluationResult = {
  total: number
  expression: string
  classSteps: FormulaClassStep[]
  materialLines: MaterialLineBreakdown[]
}

function evaluateTokensToTotal(
  tokens: CalculationFormulaToken[],
  valueForClass: (classId: number) => number
): number | null {
  const values: number[] = []
  const ops: string[] = []

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

  for (const token of tokens) {
    if (token.type === 'class') {
      values.push(valueForClass(Number(token.class_id)))
      continue
    }
    if (token.type === 'number') {
      values.push(parseMoney(token.value))
      continue
    }
    const op = token.value
    if (op === '=') continue
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

export function evaluateCalculationFormulaWithBreakdown(
  formula: CalculationFormula | null | undefined,
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number,
  classCodesById?: ReadonlyMap<number, string>,
  hingeMaterial?: Material | null,
  hingesPerFacade?: number | null,
): FormulaEvaluationResult | null {
  if (!formula?.tokens?.length) return null

  const materialLines = collectFrameMaterialLines(
    colorMaterial,
    fillingMaterial,
    heightMm,
    widthMm,
    facadeCount,
    hingeMaterial,
    hingesPerFacade,
  )

  const valueForClass = (classId: number) => classSubtotalFromLines(materialLines, classId)

  const total = evaluateTokensToTotal(formula.tokens, valueForClass)
  if (total == null) return null

  const seenClassIds = new Set<number>()
  const classSteps: FormulaClassStep[] = []
  formula.tokens.forEach((token, tokenIndex) => {
    if (token.type !== 'class') return
    const classId = Number(token.class_id)
    if (!Number.isFinite(classId) || classId <= 0 || seenClassIds.has(classId)) return
    seenClassIds.add(classId)
    const step = buildClassBreakdown(materialLines, classId)
    classSteps.push({
      ...step,
      classCode:
        classCodesById?.get(classId) ??
        formulaTokenDisplayLabel(token),
      tokenIndex,
    })
  })

  return {
    total,
    expression: formula.expression || formulaDisplayExpression(formula.tokens),
    classSteps,
    materialLines,
  }
}

/** @deprecated Используйте evaluateCalculationFormulaWithBreakdown; оставлено для совместимости. */
export function evaluateCalculationFormula(
  formula: CalculationFormula | null | undefined,
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number,
  hingeMaterial?: Material | null,
  hingesPerFacade?: number | null,
): number | null {
  return evaluateCalculationFormulaWithBreakdown(
    formula,
    colorMaterial,
    fillingMaterial,
    heightMm,
    widthMm,
    facadeCount,
    undefined,
    hingeMaterial,
    hingesPerFacade,
  )?.total ?? null
}

export type FormulaMatchResult = {
  formula: CalculationFormula
  total: number
  evaluation: FormulaEvaluationResult
}

/** Первая подходящая активная формула и полная расшифровка. */
export function matchFormulaTotalForFrame(
  formulas: CalculationFormula[],
  colorMaterial: Material | null,
  fillingMaterial: Material | null,
  heightMm: number,
  widthMm: number,
  facadeCount: number,
  classCodesById?: ReadonlyMap<number, string>,
  hingeMaterial?: Material | null,
  hingesPerFacade?: number | null,
): FormulaMatchResult | null {
  const sorted = [...formulas].sort((a, b) => {
    const ao = Number(a.sort_order ?? 0)
    const bo = Number(b.sort_order ?? 0)
    if (ao !== bo) return ao - bo
    return (a.name || '').localeCompare(b.name || '', 'ru')
  })
  for (const f of sorted) {
    if (!f.is_active) continue
    if (!formulaAppliesToSelection(f, colorMaterial, fillingMaterial, hingeMaterial)) continue
    const evaluation = evaluateCalculationFormulaWithBreakdown(
      f,
      colorMaterial,
      fillingMaterial,
      heightMm,
      widthMm,
      facadeCount,
      classCodesById,
      hingeMaterial,
      hingesPerFacade,
    )
    if (evaluation != null) {
      const hingeAddon = hingeSubtotalOutsideFormula(evaluation.materialLines, f)
      return { formula: f, total: evaluation.total + hingeAddon, evaluation }
    }
  }
  return null
}
