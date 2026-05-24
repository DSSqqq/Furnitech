/** Событие после обновления calc_frame_* в localStorage (тот же таб + другие вкладки через storage). */
export const FRAME_CALC_SESSION_EVENT = 'calc-frame-session'

/** Присадка: `none` | `hinge` (присадки под петли). */
export const CALC_LS_FRAME_MORTISE = 'calc_frame_mortise'
/** Источник петель: `customer` | `production` (имеет смысл при mortise=hinge). */
export const CALC_LS_HINGE_SOURCE = 'calc_hinge_source'
export const CALC_LS_HINGE_TYPE_ID = 'calc_hinge_type_id'
export const CALC_LS_HINGE_MATERIAL_ID = 'calc_hinge_material_id'

/** Раскладка петель (шаг 6): JSON `{ side, count, positionsMm }`. */
export const CALC_LS_HINGE_LAYOUT = 'calc_hinge_layout'
/** Минимальное число отверстий под петли (шаг 6). */
export const HINGE_LAYOUT_COUNT_MIN = 2
/** Максимальное число отверстий под петли (шаг 6). */
export const HINGE_LAYOUT_COUNT_MAX = 10

/** Отверстия под ручку (шаг 7): JSON см. `HandleHolesPersisted`. */
export const CALC_LS_HANDLE_HOLES = 'calc_handle_holes'

/** Дефолтные габариты шага 3 (мм), если в localStorage пусто (после сброса или первый визит). */
export const FRAME_DEFAULT_HEIGHT_MM = 500
export const FRAME_DEFAULT_WIDTH_MM = 200
/** Верхняя граница габарита (мм), если у материала max_length / max_width не заданы. */
export const FRAME_DIM_FALLBACK_MAX_MM = 99999
/** Максимальное количество фасадов в одном расчёте (шаг 3). */
export const FRAME_FACADE_COUNT_MAX = 99999

export type FrameDimMaterialLimits = {
  min_length?: string | number | null
  min_width?: string | number | null
}

function parsePositiveMaterialDim(v: unknown): number {
  if (v == null || v === '') return 0
  const n = Number(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Дефолтные габариты эскиза: min материала или 500×200. */
export function frameDimDefaultsFromMaterial(material: FrameDimMaterialLimits | null | undefined): {
  heightMm: number
  widthMm: number
} {
  const minH = parsePositiveMaterialDim(material?.min_length)
  const minW = parsePositiveMaterialDim(material?.min_width)
  return {
    heightMm: minH > 0 ? Math.ceil(minH) : FRAME_DEFAULT_HEIGHT_MM,
    widthMm: minW > 0 ? Math.ceil(minW) : FRAME_DEFAULT_WIDTH_MM,
  }
}

export function hasSavedFrameDims(): boolean {
  const { h, w } = readFrameDimsMm()
  return h != null && w != null
}

/** Записать дефолтные габариты из материала, если пользователь ещё не задавал размеры. */
export function seedFrameDimsFromMaterial(material: FrameDimMaterialLimits | null | undefined): boolean {
  if (hasSavedFrameDims() || !material) return false
  const { heightMm, widthMm } = frameDimDefaultsFromMaterial(material)
  try {
    localStorage.setItem('calc_frame_height_mm', String(heightMm))
    localStorage.setItem('calc_frame_width_mm', String(widthMm))
    notifyFrameCalcSession()
    return true
  } catch {
    return false
  }
}

export function effectiveFrameDimMax(materialMax: number): number {
  return materialMax > 0 ? Math.floor(materialMax) : FRAME_DIM_FALLBACK_MAX_MM
}

/** Цифры в поле габарита: длина и значение не выше effectiveFrameDimMax. */
export function clampFrameDimDigits(raw: string, materialMax: number): string {
  const max = effectiveFrameDimMax(materialMax)
  const maxLen = String(max).length
  const digits = String(raw ?? '').replace(/[^\d]/g, '').slice(0, maxLen)
  if (!digits) return digits
  const n = Number(digits)
  if (!Number.isFinite(n)) return digits
  return n > max ? String(max) : digits
}

export type HingeMountSide = 'left' | 'right' | 'top' | 'bottom'

export type HandleOrientation = 'vertical' | 'horizontal'

/** Ручка: вертикаль — линия отверстий вдоль левого/правого края; горизонталь — вдоль верхнего/нижнего. */
export type HandleHolesPersisted = {
  count: number
  diameterMm: number
  bushings: boolean
  orientation: HandleOrientation
  /** Сторона фасада, на которой линия отверстий под ручку. */
  side: HingeMountSide
  /** мм от начала стороны до центра первого отверстия (как у петель: верх/низ — от левого; лево/право — от верхнего). */
  offsetStartMm: number
  /** Межосевые мм между соседними отверстиями (длина count − 1). */
  spanMm: number[]
}

export type HingeLayoutPersisted = {
  side: HingeMountSide
  count: number
  /**
   * мм от **начала** стороны вдоль края (для чертежа): верх/низ — от левого; лево/право — от верхнего.
   * Ввод на шаге 6: пары «с начала / с конца» (№1 и №n, №2 и №n−1, …) конвертируются в эти абсолютные координаты.
   */
  positionsMm: number[]
}

const HINGE_POS_MIN_GAP_MM = 1

export function hingeEdgeLengthMm(side: HingeMountSide, widthMm: number, heightMm: number): number {
  if (side === 'top' || side === 'bottom') return widthMm
  return heightMm
}

/** Сегменты цепочки размеров вдоль кромки (как шаги 6–7): `t0`/`t1` в долях 0…100 от начала стороны. */
export type EdgeChainSegmentMm = {
  key: string
  t0: number
  t1: number
  valueMm: number
}

/**
 * Цепочка размеров по отсортированным координатам вдоль длины L (мм):
 * от края до первой точки, между точками, от последней до края.
 */
export function edgeChainSegmentsMm(L: number, sortedPositionsMm: number[]): EdgeChainSegmentMm[] {
  if (!Number.isFinite(L) || L <= 0) return []
  const nums = sortedPositionsMm
  const out: EdgeChainSegmentMm[] = []
  let prev = 0
  for (let k = 0; k < nums.length; k++) {
    const t0 = (prev / L) * 100
    const t1 = (nums[k] / L) * 100
    const valueMm = nums[k] - prev
    if (valueMm > 0.001) {
      out.push({ key: `edge-seg-${k}`, t0, t1, valueMm })
    }
    prev = nums[k]
  }
  const tail = L - prev
  if (tail > 0.001) {
    out.push({
      key: 'edge-seg-end',
      t0: (prev / L) * 100,
      t1: 100,
      valueMm: tail,
    })
  }
  return out
}

/** Индекс «парной» петли: №1 ↔ №n, №2 ↔ №n−1, … */
export function hingePairPartnerIndex(i: number, count: number): number {
  return count - 1 - i
}

/**
 * true — ввод «от начала» стороны (лево/право: сверху; верх/низ: слева).
 * false — ввод «от конца» (лево/право: снизу; верх/низ: справа).
 */
export function hingeMeasuresFromEdgeStart(i: number, count: number): boolean {
  return i <= hingePairPartnerIndex(i, count)
}

/** Сырые числа из полей → абсолютные мм от начала стороны (строго по индексу петли). */
export function hingeUserInputsToAbsoluteMm(L: number, count: number, parsed: number[]): number[] | null {
  if (parsed.length !== count) return null
  if (parsed.some((x) => !Number.isFinite(x))) return null
  const abs: number[] = new Array(count)
  for (let i = 0; i < count; i++) {
    const v = parsed[i]
    if (hingeMeasuresFromEdgeStart(i, count)) {
      abs[i] = v
    } else {
      abs[i] = L - v
    }
  }
  return abs
}

/** Абсолютные координаты → строки для полей ввода (от начала / от конца по правилу пар). Округление вверх до целого мм. */
export function hingeAbsoluteToUserInputStrings(L: number, abs: number[], count: number): string[] {
  return abs.map((a, i) => {
    const v = hingeMeasuresFromEdgeStart(i, count) ? a : L - a
    if (!Number.isFinite(v)) return ''
    return String(Math.ceil(Math.max(0, v) - 1e-9))
  })
}

/**
 * Дефолтные абсолютные позиции петель (мм от начала кромки) для длины стороны L.
 * Равномерно вдоль кромки: **n+1** равных промежутков (от края до первой петли, между петлями, от последней до края).
 * Координата петли i (0-based): **(i+1)·L/(n+1)**.
 */
export function defaultHingeAbsPositionsMm(L: number, count: number): number[] {
  if (!Number.isFinite(L) || L <= 0 || count < 1) return []
  const n = count
  const step = L / (n + 1)
  return Array.from({ length: n }, (_, i) => (i + 1) * step)
}

/** Прочитать габариты фасада из localStorage (шаг 3). */
export function readFrameDimsMm(): { w: number | null; h: number | null } {
  try {
    const hs = localStorage.getItem('calc_frame_height_mm')?.trim() ?? ''
    const ws = localStorage.getItem('calc_frame_width_mm')?.trim() ?? ''
    const h = hs ? Number(hs.replace(',', '.')) : NaN
    const w = ws ? Number(ws.replace(',', '.')) : NaN
    return {
      h: Number.isFinite(h) && h > 0 ? h : null,
      w: Number.isFinite(w) && w > 0 ? w : null,
    }
  } catch {
    return { w: null, h: null }
  }
}

export function readHingeLayout(): HingeLayoutPersisted | null {
  try {
    const raw = localStorage.getItem(CALC_LS_HINGE_LAYOUT)
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<HingeLayoutPersisted>
    const side = j.side
    if (side !== 'left' && side !== 'right' && side !== 'top' && side !== 'bottom') return null
    const count = Number(j.count)
    if (!Number.isFinite(count) || count < HINGE_LAYOUT_COUNT_MIN || count > HINGE_LAYOUT_COUNT_MAX) return null
    const arr = Array.isArray(j.positionsMm) ? j.positionsMm.map((x) => Number(x)) : []
    if (arr.length !== count) return null
    if (arr.some((x) => !Number.isFinite(x))) return null
    return { side, count, positionsMm: arr }
  } catch {
    return null
  }
}

/**
 * Нельзя ставить ручку на ту же сторону, где уже петли:
 * при вертикальной ручке — только лево/право; при горизонтальной — только верх/низ.
 */
export function isHandleSideBlockedByHinges(
  hingeSide: HingeMountSide | null | undefined,
  orientation: HandleOrientation,
  handleSide: HingeMountSide,
): boolean {
  if (!hingeSide) return false
  if (orientation === 'vertical') {
    if (handleSide !== 'left' && handleSide !== 'right') return true
    return hingeSide === handleSide
  }
  if (handleSide !== 'top' && handleSide !== 'bottom') return true
  return hingeSide === handleSide
}

export function readHandleHoles(): HandleHolesPersisted | null {
  try {
    const raw = localStorage.getItem(CALC_LS_HANDLE_HOLES)
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<HandleHolesPersisted>
    const orientation = j.orientation
    if (orientation !== 'vertical' && orientation !== 'horizontal') return null
    const side = j.side
    if (side !== 'left' && side !== 'right' && side !== 'top' && side !== 'bottom') return null
    const count = Number(j.count)
    if (!Number.isFinite(count) || count < 1 || count > 10) return null
    const diameterMm = Number(j.diameterMm)
    if (!Number.isFinite(diameterMm) || diameterMm <= 0) return null
    const bushings = Boolean(j.bushings)
    const offsetStartMm = Number(j.offsetStartMm)
    if (!Number.isFinite(offsetStartMm)) return null
    const spanArr = Array.isArray(j.spanMm) ? j.spanMm.map((x) => Number(x)) : []
    if (spanArr.length !== count - 1) return null
    if (spanArr.some((x) => !Number.isFinite(x))) return null
    return {
      count,
      diameterMm,
      bushings,
      orientation,
      side,
      offsetStartMm,
      spanMm: spanArr,
    }
  } catch {
    return null
  }
}

export function writeHandleHoles(data: HandleHolesPersisted | null) {
  try {
    if (data == null) {
      localStorage.removeItem(CALC_LS_HANDLE_HOLES)
    } else {
      const normalized: HandleHolesPersisted = {
        ...data,
        offsetStartMm: Math.round(data.offsetStartMm * 1000) / 1000,
        spanMm: data.spanMm.map((x) => Math.round(x * 1000) / 1000),
        diameterMm: Math.round(data.diameterMm * 1000) / 1000,
      }
      localStorage.setItem(CALC_LS_HANDLE_HOLES, JSON.stringify(normalized))
    }
  } catch {
    /* ignore */
  }
  notifyFrameCalcSession()
}

/** Абсолютные мм центров отверстий вдоль стороны (от начала кромки). */
export function handleHoleCentersMm(persisted: HandleHolesPersisted): number[] {
  const { offsetStartMm, spanMm, count } = persisted
  const out: number[] = [offsetStartMm]
  for (let i = 0; i < spanMm.length; i++) {
    out.push(out[i] + spanMm[i])
  }
  if (out.length !== count) return []
  return out
}

export function validateHandleHoles(
  persisted: HandleHolesPersisted,
  hingeLayout: HingeLayoutPersisted | null,
): string | null {
  const { w, h } = readFrameDimsMm()
  if (w == null || h == null) return 'Укажите высоту и ширину фасада на шаге 3.'
  const L = hingeEdgeLengthMm(persisted.side, w, h)
  if (isHandleSideBlockedByHinges(hingeLayout?.side, persisted.orientation, persisted.side)) {
    return 'Эта сторона занята отверстиями под петли. Выберите другую сторону или ориентацию ручки.'
  }
  if (persisted.orientation === 'vertical' && persisted.side !== 'left' && persisted.side !== 'right') {
    return 'При вертикальной ручке выберите сторону «слева» или «справа».'
  }
  if (persisted.orientation === 'horizontal' && persisted.side !== 'top' && persisted.side !== 'bottom') {
    return 'При горизонтальной ручке выберите сторону «сверху» или «снизу».'
  }
  const centers = handleHoleCentersMm(persisted)
  if (centers.length !== persisted.count) return 'Проверьте межосевые расстояния.'
  for (let i = 0; i < centers.length; i++) {
    const p = centers[i]
    if (!Number.isFinite(p)) return `Отверстие ${i + 1}: введите число.`
    if (p <= 0) return `Отверстие ${i + 1}: положение должно быть больше 0.`
    if (p >= L) {
      return `Отверстие ${i + 1}: ${Math.round(p)} мм не может быть ≥ ${Math.round(L)} мм (длина стороны).`
    }
  }
  for (let i = 0; i < centers.length - 1; i++) {
    if (centers[i + 1] <= centers[i]) {
      return 'Центры отверстий должны идти вдоль стороны по возрастанию.'
    }
    if (centers[i + 1] - centers[i] < HINGE_POS_MIN_GAP_MM) {
      return `Между отверстиями ${i + 1} и ${i + 2} слишком мало места (минимум ${HINGE_POS_MIN_GAP_MM} мм).`
    }
  }
  return null
}

export function writeHingeLayout(data: HingeLayoutPersisted | null) {
  try {
    if (data == null) {
      localStorage.removeItem(CALC_LS_HINGE_LAYOUT)
    } else {
      const normalized: HingeLayoutPersisted = {
        ...data,
        positionsMm: data.positionsMm.map((x) => Math.round(x * 1000) / 1000),
      }
      localStorage.setItem(CALC_LS_HINGE_LAYOUT, JSON.stringify(normalized))
    }
  } catch {
    /* ignore */
  }
  notifyFrameCalcSession()
}

/** Проверка абсолютных позиций вдоль стороны: в (0, L), строго по возрастанию, минимальный зазор. */
export function validateHingePositions(side: HingeMountSide, positionsMm: number[]): string | null {
  const { w, h } = readFrameDimsMm()
  if (w == null || h == null) return 'Укажите высоту и ширину фасада на шаге 3.'
  const L = hingeEdgeLengthMm(side, w, h)
  if (positionsMm.length === 0) return null
  for (let i = 0; i < positionsMm.length; i++) {
    const p = positionsMm[i]
    if (!Number.isFinite(p)) return `Петля ${i + 1}: введите число.`
    if (p <= 0) return `Петля ${i + 1}: расстояние должно быть больше 0.`
    if (p >= L) {
      return `Петля ${i + 1}: ${Math.round(p)} мм не может быть ≥ ${Math.round(L)} мм (длина стороны под петли).`
    }
  }
  for (let i = 0; i < positionsMm.length - 1; i++) {
    if (positionsMm[i + 1] <= positionsMm[i]) {
      return 'Расстояния должны идти вдоль стороны по возрастанию (каждая следующая петля дальше от начала стороны).'
    }
    if (positionsMm[i + 1] - positionsMm[i] < HINGE_POS_MIN_GAP_MM) {
      return `Между петлями ${i + 1} и ${i + 2} слишком мало места (минимум ${HINGE_POS_MIN_GAP_MM} мм).`
    }
  }
  return null
}

export function isFrameStep2Ready(): boolean {
  try {
    const t = localStorage.getItem('calc_frame_type_id')
    const c = localStorage.getItem('calc_frame_color_id')
    if (!t || !c) return false
    const tid = Number(t)
    const cid = Number(c)
    return Number.isFinite(tid) && tid > 0 && Number.isFinite(cid) && cid > 0
  } catch {
    return false
  }
}

/** Шаг 4 готов, если выбрано наполнение (конкретный материал). */
export function isFrameStep4Ready(): boolean {
  try {
    if (!isFrameStep2Ready()) return false
    const m = localStorage.getItem('calc_filling_material_id')
    if (!m) return false
    const mid = Number(m)
    return Number.isFinite(mid) && mid > 0
  } catch {
    return false
  }
}

/** На шаге 5 выбраны «Присадки под петли» — нужны шаг 6 и раскладка на эскизах/в PDF. */
export function isFrameMortiseHingeSelected(): boolean {
  try {
    return localStorage.getItem(CALC_LS_FRAME_MORTISE) === 'hinge'
  } catch {
    return false
  }
}

export function notifyFrameCalcSession() {
  window.dispatchEvent(new Event(FRAME_CALC_SESSION_EVENT))
}

/** Сброс выбора рамочного калькулятора (новый расчёт с шага 1). */
export function clearFrameCalculatorStorage() {
  try {
    localStorage.removeItem('calc_frame_type_id')
    localStorage.removeItem('calc_frame_color_id')
    localStorage.removeItem('calc_frame_height_mm')
    localStorage.removeItem('calc_frame_width_mm')
    localStorage.removeItem('calc_frame_qty')
    localStorage.removeItem('calc_filling_type_id')
    localStorage.removeItem('calc_filling_material_id')
    localStorage.removeItem(CALC_LS_FRAME_MORTISE)
    localStorage.removeItem(CALC_LS_HINGE_SOURCE)
    localStorage.removeItem(CALC_LS_HINGE_TYPE_ID)
    localStorage.removeItem(CALC_LS_HINGE_MATERIAL_ID)
    localStorage.removeItem(CALC_LS_HINGE_LAYOUT)
    localStorage.removeItem(CALC_LS_HANDLE_HOLES)
  } catch {
    /* ignore */
  }
}

export function subscribeFrameCalcSession(onChange: () => void) {
  const handler = () => onChange()
  window.addEventListener('storage', handler)
  window.addEventListener(FRAME_CALC_SESSION_EVENT, handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(FRAME_CALC_SESSION_EVENT, handler)
  }
}

/** Снимок ключей localStorage, влияющих на расчёт цены (для useSyncExternalStore). */
export function readCalculatorPriceConfigKey(): string {
  try {
    return [
      localStorage.getItem('calc_frame_color_id') ?? '',
      localStorage.getItem('calc_frame_height_mm') ?? '',
      localStorage.getItem('calc_frame_width_mm') ?? '',
      localStorage.getItem('calc_frame_qty') ?? '',
      localStorage.getItem('calc_filling_material_id') ?? '',
      localStorage.getItem(CALC_LS_FRAME_MORTISE) ?? '',
      localStorage.getItem(CALC_LS_HINGE_SOURCE) ?? '',
      localStorage.getItem(CALC_LS_HINGE_TYPE_ID) ?? '',
      localStorage.getItem(CALC_LS_HINGE_MATERIAL_ID) ?? '',
      localStorage.getItem(CALC_LS_HINGE_LAYOUT) ?? '',
      localStorage.getItem(CALC_LS_HANDLE_HOLES) ?? '',
      localStorage.getItem('calc_filling_type_id') ?? '',
    ].join('|')
  } catch {
    return ''
  }
}
