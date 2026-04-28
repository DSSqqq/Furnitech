/** Событие после обновления calc_frame_* в localStorage (тот же таб + другие вкладки через storage). */
export const FRAME_CALC_SESSION_EVENT = 'calc-frame-session'

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
    ].join('|')
  } catch {
    return ''
  }
}
