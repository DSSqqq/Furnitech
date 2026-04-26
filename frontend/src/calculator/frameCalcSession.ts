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

export function subscribeFrameCalcSession(onChange: () => void) {
  const handler = () => onChange()
  window.addEventListener('storage', handler)
  window.addEventListener(FRAME_CALC_SESSION_EVENT, handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(FRAME_CALC_SESSION_EVENT, handler)
  }
}
