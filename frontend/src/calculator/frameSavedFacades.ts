import type { Material } from '../types'
import type { FormulaEvaluationResult } from './calculationFormula'
import type { FrameClientPdfInput } from './frameClientPdf'
import type {
  FrameHingeSource,
  HandleHolesPersisted,
  HingeLayoutPersisted,
} from './frameCalcSession'
import {
  applyFacadeSnapshotToSession,
  notifyFrameCalcSession,
  tabIndexToSavedIndex,
  writeCurrentFacadeIndex,
} from './frameCalcSession'
import type { FramePriceBreakdown } from './framePriceEstimate'

export const CALC_LS_SAVED_FACADES = 'calc_frame_saved_facades'

export type FrameFacadeSnapshot = {
  id: string
  /** ID типа профиля (шаг 2); для восстановления сессии при редактировании. */
  frameTypeId?: number | null
  /** ID типа наполнения (шаг 4). */
  fillingTypeId?: number | null
  /** ID типа петель (шаг 5–6), если mortise=hinge и production. */
  hingeTypeId?: number | null
  hingeSource?: FrameHingeSource
  frameTypeName: string
  fillingTypeName: string
  colorMaterial: Material | null
  fillingMaterial: Material | null
  hingeMaterial: Material | null
  heightMm: number
  widthMm: number
  facadeCount: number
  mortiseLine: string
  hingeLayoutLine: string
  handleLine: string
  breakdown: FramePriceBreakdown
  priceBreakdown: Record<string, unknown>
  formulaName?: string
  formulaExpression?: string
  formulaMatch?: {
    formulaName: string
    formulaExpression?: string
    evaluation: FormulaEvaluationResult
  } | null
  currency: string
  currencyMismatch: boolean
  hingeLayout: HingeLayoutPersisted | null
  includeHingeLayoutRow: boolean
  handleHoles: HandleHolesPersisted | null
  hingesPerFacade: number | null
  mortiseMode: 'none' | 'hinge'
}

export function readSavedFacadesRaw(): string {
  try {
    return localStorage.getItem(CALC_LS_SAVED_FACADES) ?? '[]'
  } catch {
    return '[]'
  }
}

export function readSavedFacades(): FrameFacadeSnapshot[] {
  try {
    const raw = readSavedFacadesRaw()
    if (!raw || raw === '[]') return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is FrameFacadeSnapshot => x != null && typeof x === 'object' && typeof (x as FrameFacadeSnapshot).id === 'string')
  } catch {
    return []
  }
}

export function writeSavedFacades(facades: FrameFacadeSnapshot[]): void {
  try {
    localStorage.setItem(CALC_LS_SAVED_FACADES, JSON.stringify(facades))
    notifyFrameCalcSession()
  } catch {
    /* ignore */
  }
}

export function appendSavedFacade(snapshot: Omit<FrameFacadeSnapshot, 'id'>): void {
  const list = readSavedFacades()
  list.push({ ...snapshot, id: crypto.randomUUID() })
  writeSavedFacades(list)
}

export function replaceSavedFacadeAt(index: number, snapshot: Omit<FrameFacadeSnapshot, 'id'> & { id?: string }): void {
  const list = readSavedFacades()
  if (index < 0 || index >= list.length) return
  const id = snapshot.id ?? list[index]!.id
  list[index] = { ...snapshot, id }
  writeSavedFacades(list)
}

export function removeSavedFacadeAt(index: number): void {
  const list = readSavedFacades()
  if (index < 0 || index >= list.length) return
  list.splice(index, 1)
  writeSavedFacades(list)
}

/**
 * Сделать вкладку `targetTabIndex` текущей: снимок сессии уходит в сохранённые,
 * выбранный сохранённый фасад загружается в сессию.
 */
export function swapFacadeTabIntoSession(
  targetTabIndex: number,
  currentTabIndex: number,
  currentSnapshot: Omit<FrameFacadeSnapshot, 'id'>,
): void {
  const savedIdx = tabIndexToSavedIndex(targetTabIndex, currentTabIndex)
  if (savedIdx == null) return
  const list = readSavedFacades()
  if (savedIdx < 0 || savedIdx >= list.length) return
  const selected = list[savedIdx]!
  list[savedIdx] = { ...currentSnapshot, id: selected.id }
  writeSavedFacades(list)
  applyFacadeSnapshotToSession(selected)
  writeCurrentFacadeIndex(targetTabIndex)
}

/** Загрузить сохранённый фасад в сессию (когда текущей конфигурации ещё нет). */
export function promoteSavedFacadeToSession(savedIndex: number, tabIndex: number): void {
  const list = readSavedFacades()
  if (savedIndex < 0 || savedIndex >= list.length) return
  const selected = list[savedIndex]!
  list.splice(savedIndex, 1)
  writeSavedFacades(list)
  applyFacadeSnapshotToSession(selected)
  writeCurrentFacadeIndex(tabIndex)
}

export function clearSavedFacades(): void {
  try {
    localStorage.removeItem(CALC_LS_SAVED_FACADES)
    notifyFrameCalcSession()
  } catch {
    /* ignore */
  }
}

/** Число разных конфигураций фасадов (сохранённые + текущая на шаге 8). */
export function totalFacadeVariantCount(savedCount: number, includeCurrent = true): number {
  return savedCount + (includeCurrent ? 1 : 0)
}

export function formatFacadeVariantCount(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return `${n} фасадов`
  if (mod10 === 1) return `${n} фасад`
  if (mod10 >= 2 && mod10 <= 4) return `${n} фасада`
  return `${n} фасадов`
}

export function facadeSnapshotToPdfPartial(
  snapshot: Pick<
    FrameFacadeSnapshot,
    | 'frameTypeName'
    | 'fillingTypeName'
    | 'colorMaterial'
    | 'fillingMaterial'
    | 'heightMm'
    | 'widthMm'
    | 'facadeCount'
    | 'mortiseLine'
    | 'hingeLayoutLine'
    | 'handleLine'
    | 'breakdown'
    | 'priceBreakdown'
    | 'formulaName'
    | 'currency'
    | 'currencyMismatch'
    | 'hingeLayout'
    | 'includeHingeLayoutRow'
    | 'handleHoles'
  >,
): Omit<FrameClientPdfInput, 'contact'> {
  return {
    frameTypeName: snapshot.frameTypeName,
    fillingTypeName: snapshot.fillingTypeName,
    colorMaterial: snapshot.colorMaterial,
    fillingMaterial: snapshot.fillingMaterial,
    heightMm: snapshot.heightMm,
    widthMm: snapshot.widthMm,
    facadeCount: snapshot.facadeCount,
    mortiseLine: snapshot.mortiseLine,
    hingeLayoutLine: snapshot.hingeLayoutLine,
    handleLine: snapshot.handleLine,
    breakdown: {
      profile: snapshot.breakdown.profile,
      filling: snapshot.breakdown.filling,
      related: snapshot.breakdown.related,
      hinges: snapshot.breakdown.hinges > 0 ? snapshot.breakdown.hinges : undefined,
      total: snapshot.breakdown.total,
    },
    priceBreakdownDetail: snapshot.priceBreakdown,
    formulaName: snapshot.formulaName,
    currency: snapshot.currency,
    currencyMismatch: snapshot.currencyMismatch,
    hingeLayout: snapshot.hingeLayout,
    includeHingeLayoutRow: snapshot.includeHingeLayoutRow,
    handleHoles: snapshot.handleHoles,
  }
}

export function facadeSnapshotToOrderJson(snapshot: FrameFacadeSnapshot): Record<string, unknown> {
  return {
    id: snapshot.id,
    frameTypeName: snapshot.frameTypeName,
    fillingTypeName: snapshot.fillingTypeName,
    colorMaterial: snapshot.colorMaterial
      ? {
          id: snapshot.colorMaterial.id,
          name: snapshot.colorMaterial.name,
          texture_label: snapshot.colorMaterial.name,
          article: snapshot.colorMaterial.article,
        }
      : null,
    fillingMaterial: snapshot.fillingMaterial
      ? {
          id: snapshot.fillingMaterial.id,
          name: snapshot.fillingMaterial.name,
          texture_label: snapshot.fillingMaterial.name,
          article: snapshot.fillingMaterial.article,
        }
      : null,
    heightMm: snapshot.heightMm,
    widthMm: snapshot.widthMm,
    facadeCount: snapshot.facadeCount,
    mortiseLine: snapshot.mortiseLine,
    hingeLayoutLine: snapshot.hingeLayoutLine,
    handleLine: snapshot.handleLine,
    breakdown: {
      profile: snapshot.breakdown.profile,
      filling: snapshot.breakdown.filling,
      related: snapshot.breakdown.related,
      hinges: snapshot.breakdown.hinges,
      total: snapshot.breakdown.total,
    },
    formulaName: snapshot.formulaName,
    formulaExpression: snapshot.formulaExpression,
    priceBreakdown: snapshot.priceBreakdown,
    currency: snapshot.currency,
    currencyMismatch: snapshot.currencyMismatch,
    hingeLayout: snapshot.hingeLayout,
    includeHingeLayoutRow: snapshot.includeHingeLayoutRow,
    handleHoles: snapshot.handleHoles,
  }
}
