import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCalculatorProfileTypes, fetchMaterial } from '../api'
import type { CalculatorProfileType, Material } from '../types'
import { useCalcPaths } from './calcPathsContext'
import {
  FRAME_DEFAULT_HEIGHT_MM,
  FRAME_DEFAULT_WIDTH_MM,
  isFrameStep2Ready,
  notifyFrameCalcSession,
} from './frameCalcSession'
import { facadeSketchBoxStyle, materialTextureLayerStyle } from './sketchFrame'
import './Step2FrameFacade.css'
import './Step3FrameSizes.css'

function asNum(s: string) {
  const t = s.trim().replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function digitsOnly(s: string): string {
  // Разрешаем только 0-9 (и пустое значение), чтобы в поля нельзя было ввести ничего, кроме цифр.
  return String(s ?? '').replace(/[^\d]/g, '')
}

function asIntOrNull(s: string): number | null {
  const t = digitsOnly(s).trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function Step3FrameSizes() {
  const nav = useNavigate()
  const { step } = useCalcPaths()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [profileTypes, setProfileTypes] = useState<CalculatorProfileType[]>([])
  const [typeId, setTypeId] = useState<number | null>(null)
  const [colorId, setColorId] = useState<number | null>(null)
  const [colorMaterial, setColorMaterial] = useState<Material | null>(null)

  const [heightMm, setHeightMm] = useState(() => {
    const h = lsGet('calc_frame_height_mm')
    return h != null && h !== '' ? h : String(FRAME_DEFAULT_HEIGHT_MM)
  })
  const [widthMm, setWidthMm] = useState(() => {
    const w = lsGet('calc_frame_width_mm')
    return w != null && w !== '' ? w : String(FRAME_DEFAULT_WIDTH_MM)
  })
  const [qty, setQty] = useState(() => {
    const q = lsGet('calc_frame_qty')
    return q != null && q !== '' ? q : '1'
  })

  useEffect(() => {
    try {
      const t = localStorage.getItem('calc_frame_type_id')
      const c = localStorage.getItem('calc_frame_color_id')
      setTypeId(t ? Number(t) : null)
      setColorId(c ? Number(c) : null)
    } catch {
      setTypeId(null)
      setColorId(null)
    }
  }, [])

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    try {
      localStorage.setItem('calc_frame_height_mm', heightMm)
      localStorage.setItem('calc_frame_width_mm', widthMm)
      localStorage.setItem('calc_frame_qty', qty)
    } catch {
      /* ignore */
    }
    notifyFrameCalcSession()
  }, [heightMm, widthMm, qty])

  useEffect(() => {
    setErr(null)
    setLoading(true)
    fetchCalculatorProfileTypes()
      .then((r) => setProfileTypes(r.results ?? []))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!colorId) {
      setColorMaterial(null)
      return
    }
    fetchMaterial(colorId)
      .then((m) => setColorMaterial(m))
      .catch((e) => setErr(String(e)))
  }, [colorId])

  const selectedType = useMemo(
    () => profileTypes.find((t) => t.id === typeId) ?? null,
    [profileTypes, typeId]
  )

  const limits = useMemo(() => {
    const minH = asNum(String((colorMaterial as any)?.min_length ?? '0')) ?? 0
    const maxH = asNum(String((colorMaterial as any)?.max_length ?? '0')) ?? 0
    const minW = asNum(String((colorMaterial as any)?.min_width ?? '0')) ?? 0
    const maxW = asNum(String((colorMaterial as any)?.max_width ?? '0')) ?? 0
    return { minH, maxH, minW, maxW }
  }, [colorMaterial])

  const heightN = asNum(heightMm)
  const widthN = asNum(widthMm)

  const sketchBoxStyle = useMemo(() => {
    if (heightN == null || widthN == null || heightN <= 0 || widthN <= 0) return undefined
    return facadeSketchBoxStyle(heightN, widthN)
  }, [heightN, widthN])

  const heightOk =
    heightN != null &&
    (limits.minH <= 0 || heightN >= limits.minH) &&
    (limits.maxH <= 0 || heightN <= limits.maxH)
  const widthOk =
    widthN != null &&
    (limits.minW <= 0 || widthN >= limits.minW) &&
    (limits.maxW <= 0 || widthN <= limits.maxW)

  const sketchFrameStyle = useMemo(() => materialTextureLayerStyle(colorMaterial), [colorMaterial])

  return (
    <div className="frame3">
      <section className="frame3-left calc-side-panel">
        <div className="frame3-title">Задать габаритные размеры</div>
        <div className="frame3-sub">Укажите габаритные размеры фасада</div>

        {err && <div className="admin-error" style={{ margin: '0.75rem 0 0' }}>{err}</div>}
        {loading && <p className="admin-muted" style={{ margin: '0.75rem 0 0' }}>Загрузка…</p>}

        <div className="frame3-grid">
          <label className="frame3-field">
            <div className="frame3-label">Высота фасада (мм)</div>
            <input
              className={heightOk ? 'admin-input' : 'admin-input frame3-input--bad'}
              value={heightMm}
              inputMode="numeric"
              onChange={(e) => setHeightMm(digitsOnly(e.target.value))}
              onBlur={() => {
                const n = asIntOrNull(heightMm)
                if (n == null) return
                const min = limits.minH > 0 ? Math.ceil(limits.minH) : 0
                const max = limits.maxH > 0 ? Math.floor(limits.maxH) : Number.POSITIVE_INFINITY
                const next = clamp(n, min, max === Number.POSITIVE_INFINITY ? n : max)
                if (String(next) !== heightMm) setHeightMm(String(next))
              }}
            />
          </label>
          <label className="frame3-field">
            <div className="frame3-label">Ширина фасада (мм)</div>
            <input
              className={widthOk ? 'admin-input' : 'admin-input frame3-input--bad'}
              value={widthMm}
              inputMode="numeric"
              onChange={(e) => setWidthMm(digitsOnly(e.target.value))}
              onBlur={() => {
                const n = asIntOrNull(widthMm)
                if (n == null) return
                const min = limits.minW > 0 ? Math.ceil(limits.minW) : 0
                const max = limits.maxW > 0 ? Math.floor(limits.maxW) : Number.POSITIVE_INFINITY
                const next = clamp(n, min, max === Number.POSITIVE_INFINITY ? n : max)
                if (String(next) !== widthMm) setWidthMm(String(next))
              }}
            />
          </label>
        </div>

        <label className="frame3-field frame3-field--wide">
          <div className="frame3-label">Количество фасадов (шт)</div>
          <input
            className="admin-input"
            value={qty}
            inputMode="numeric"
            onChange={(e) => setQty(digitsOnly(e.target.value))}
            onBlur={() => {
              const n = asIntOrNull(qty)
              if (n == null) return
              const next = Math.max(1, n)
              if (String(next) !== qty) setQty(String(next))
            }}
          />
        </label>

        <div className="frame3-limits">
          <div className="frame3-limits-title">
            Ограничение по размерам для фасадного профиля {selectedType?.name ? `"${selectedType.name}"` : ''}
          </div>
          <div className="frame3-limits-row">
            Минимальные размеры: {limits.minH || '—'}×{limits.minW || '—'} мм.
          </div>
          <div className="frame3-limits-row">
            Максимальные размеры: {limits.maxH || '—'}×{limits.maxW || '—'} мм.
          </div>
        </div>

        <div className="frame2-card-nav">
          <button type="button" className="admin-secondary" onClick={() => nav(step('frame'))}>
            ← Предыдущий шаг
          </button>
          <button
            type="button"
            className="admin-primary"
            disabled={!heightOk || !widthOk}
            title={!heightOk || !widthOk ? 'Укажите габариты в допустимых пределах' : undefined}
            onClick={() => nav(step('frame/filling'))}
          >
            Следующий шаг →
          </button>
        </div>
      </section>

      <section className="frame3-right frame2-sketch" aria-label="Эскиз с размерами">
        <div className="frame2-sketch-inner frame3-sketch">
          <div
            className="frame3-drawing"
            aria-label={`Чертёж фасада: высота ${heightN ?? '—'} мм, ширина ${widthN ?? '—'} мм`}
          >
            {/* Тот же эскиз, что в шаге 2; цвет/текстура рамки из выбранного материала (localStorage + API). */}
            <div className="sketch" style={sketchBoxStyle}>
              <div className="sketch-frame">
                <div className="sketch-frame-texture" style={sketchFrameStyle} />
              </div>
              <div className="sketch-paper">
                <div className="sketch-paper-texture" />
              </div>
              <div className="sketch-sheet">
                <div className="sketch-title">ЛИЦЕВАЯ СТОРОНА ФАСАДА</div>
                <div className="sketch-sub">Визуализация примерная</div>
                <div className="sketch-table">
                  <div className="sketch-row">
                    <div className="sketch-key">Тип профиля</div>
                    <div className="sketch-val">{selectedType?.name || '—'}</div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Цвет</div>
                    <div className="sketch-val">{colorMaterial?.name || '—'}</div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Размеры</div>
                    <div className="sketch-val">
                      {(heightN ?? '—')}×{(widthN ?? '—')} мм
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Размеры в стиле чертежа: выносные линии + размерная линия со стрелками */}
            <div className="frame3-dim-drawing frame3-dim-drawing--top">
              <div className="frame3-dim-drawing__value">{widthN ?? '—'} мм</div>
              <div className="frame3-dim-drawing__top-row">
                <span className="frame3-dim-drawing__ext-v frame3-dim-drawing__ext-v--l" aria-hidden />
                <div className="frame3-dim-drawing__h">
                  <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--w" />
                  <span className="frame3-dim-drawing__h-line" />
                  <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--e" />
                </div>
                <span className="frame3-dim-drawing__ext-v frame3-dim-drawing__ext-v--r" aria-hidden />
              </div>
            </div>

            <div className="frame3-dim-drawing frame3-dim-drawing--left">
              <div className="frame3-dim-drawing__left-col">
                <div className="frame3-dim-drawing__value frame3-dim-drawing__value--side">{heightN ?? '—'} мм</div>
                <div className="frame3-dim-drawing__v">
                  <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--n" />
                  <span className="frame3-dim-drawing__v-line" />
                  <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--s" />
                </div>
              </div>
              <span className="frame3-dim-drawing__ext-h frame3-dim-drawing__ext-h--t" />
              <span className="frame3-dim-drawing__ext-h frame3-dim-drawing__ext-h--b" />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Step3FrameSizes

