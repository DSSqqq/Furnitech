import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCalculatorProfileTypes, fetchMaterial } from '../api'
import type { CalculatorProfileType, Material } from '../types'
import { useCalcPaths } from './calcPathsContext'
import { CalcStepPriceTotals } from './CalcPriceTotals'
import {
  clampFrameDimDigits,
  effectiveFrameDimMax,
  formatFrameMaterialDimLimitDisplay,
  FRAME_FACADE_COUNT_MAX,
  frameDimDefaultsFromMaterial,
  parsePositiveMaterialDim,
  frameSketchDisplayDims,
  isFrameStep2Ready,
  notifyFrameCalcSession,
  readFrameDimsMm,
  seedFrameDimsFromMaterial,
} from './frameCalcSession'
import { materialTextureLabel, textureLabelDisplayWrap } from './materialTextureLabel'
import { facadeSketchBoxStyle, profileFrameTextureLayerStyle } from './sketchFrame'
import { useFrameColorMaterial } from './useFrameColorMaterial'
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
  const { frameColorMaterial: colorMaterial } = useFrameColorMaterial()

  const [heightMm, setHeightMm] = useState(() => {
    const h = lsGet('calc_frame_height_mm')
    return h != null && h !== '' ? h : ''
  })
  const [widthMm, setWidthMm] = useState(() => {
    const w = lsGet('calc_frame_width_mm')
    return w != null && w !== '' ? w : ''
  })
  const [qty, setQty] = useState(() => {
    const q = lsGet('calc_frame_qty')
    return q != null && q !== '' ? q : '1'
  })

  useEffect(() => {
    try {
      const t = localStorage.getItem('calc_frame_type_id')
      setTypeId(t ? Number(t) : null)
    } catch {
      setTypeId(null)
    }
  }, [])

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    const h = heightMm.trim()
    const w = widthMm.trim()
    if (!h || !w) return
    try {
      localStorage.setItem('calc_frame_height_mm', h)
      localStorage.setItem('calc_frame_width_mm', w)
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
    const colorId = (() => {
      try {
        const c = localStorage.getItem('calc_frame_color_id')
        if (!c) return null
        const n = Number(c)
        return Number.isFinite(n) && n > 0 ? n : null
      } catch {
        return null
      }
    })()
    if (!colorId) return
    fetchMaterial(colorId)
      .then((m) => {
        seedFrameDimsFromMaterial(m)
        const saved = readFrameDimsMm()
        if (saved.h != null && saved.w != null) {
          setHeightMm(String(saved.h))
          setWidthMm(String(saved.w))
          return
        }
        const defaults = frameDimDefaultsFromMaterial(m)
        setHeightMm(String(defaults.heightMm))
        setWidthMm(String(defaults.widthMm))
      })
      .catch((e) => setErr(String(e)))
  }, [colorMaterial])

  const selectedType = useMemo(
    () => profileTypes.find((t) => t.id === typeId) ?? null,
    [profileTypes, typeId]
  )

  const limits = useMemo(() => {
    const m = colorMaterial as Material | null
    const minH = parsePositiveMaterialDim(m?.min_length)
    const maxH = parsePositiveMaterialDim(m?.max_length)
    const minW = parsePositiveMaterialDim(m?.min_width)
    const maxW = parsePositiveMaterialDim(m?.max_width)
    return {
      minH,
      maxH,
      minW,
      maxW,
      effectiveMaxH: effectiveFrameDimMax(maxH),
      effectiveMaxW: effectiveFrameDimMax(maxW),
    }
  }, [colorMaterial])

  useEffect(() => {
    const n = asIntOrNull(heightMm)
    if (n == null) return
    const max = limits.effectiveMaxH
    if (n > max) setHeightMm(String(max))
  }, [limits.effectiveMaxH, heightMm])

  useEffect(() => {
    const n = asIntOrNull(widthMm)
    if (n == null) return
    const max = limits.effectiveMaxW
    if (n > max) setWidthMm(String(max))
  }, [limits.effectiveMaxW, widthMm])

  useEffect(() => {
    const n = asIntOrNull(qty)
    if (n == null) return
    if (n > FRAME_FACADE_COUNT_MAX) setQty(String(FRAME_FACADE_COUNT_MAX))
  }, [qty])

  const heightN = asNum(heightMm)
  const widthN = asNum(widthMm)
  const { heightMm: sketchHeightN, widthMm: sketchWidthN } = useMemo(
    () => frameSketchDisplayDims(heightN, widthN),
    [heightN, widthN],
  )

  const sketchBoxStyle = useMemo(() => {
    if (sketchHeightN <= 0 || sketchWidthN <= 0) return undefined
    return facadeSketchBoxStyle(sketchHeightN, sketchWidthN)
  }, [sketchHeightN, sketchWidthN])

  const heightOk =
    heightN != null &&
    heightN <= limits.effectiveMaxH &&
    (limits.minH <= 0 || heightN >= limits.minH)
  const widthOk =
    widthN != null &&
    widthN <= limits.effectiveMaxW &&
    (limits.minW <= 0 || widthN >= limits.minW)

  const sketchFrameStyle = useMemo(() => profileFrameTextureLayerStyle(colorMaterial), [colorMaterial])

  return (
    <div className="frame3">
      <section className="frame3-left calc-side-panel">
        <div className="frame3-title" role="heading" aria-level={3}>
          Укажите габаритные размеры
        </div>

        {err && <div className="admin-error" style={{ margin: '0.75rem 0 0' }}>{err}</div>}
        {loading && <p className="admin-muted" style={{ margin: '0.75rem 0 0' }}>Загрузка…</p>}

        <div className="calc-side-panel-scroll">
        <div className="frame3-grid">
          <label className="frame3-field">
            <div className="frame3-label">Высота фасада (мм)</div>
            <input
              className={heightOk ? 'admin-input' : 'admin-input frame3-input--bad'}
              value={heightMm}
              inputMode="numeric"
              maxLength={String(limits.effectiveMaxH).length}
              onChange={(e) => setHeightMm(clampFrameDimDigits(e.target.value, limits.maxH))}
              onBlur={() => {
                const n = asIntOrNull(heightMm)
                if (n == null) return
                const min = limits.minH > 0 ? Math.ceil(limits.minH) : 0
                const next = clamp(n, min, limits.effectiveMaxH)
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
              maxLength={String(limits.effectiveMaxW).length}
              onChange={(e) => setWidthMm(clampFrameDimDigits(e.target.value, limits.maxW))}
              onBlur={() => {
                const n = asIntOrNull(widthMm)
                if (n == null) return
                const min = limits.minW > 0 ? Math.ceil(limits.minW) : 0
                const next = clamp(n, min, limits.effectiveMaxW)
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
            maxLength={String(FRAME_FACADE_COUNT_MAX).length}
            onChange={(e) => setQty(clampFrameDimDigits(e.target.value, FRAME_FACADE_COUNT_MAX))}
            onBlur={() => {
              const n = asIntOrNull(qty)
              const next = clamp(n ?? 1, 1, FRAME_FACADE_COUNT_MAX)
              if (String(next) !== qty) setQty(String(next))
            }}
          />
        </label>

        <div className="frame3-limits">
          <div className="frame3-limits-title">
            Ограничение по размерам для фасадного профиля {selectedType?.name ? `"${selectedType.name}"` : ''}
          </div>
          <div className="frame3-limits-row">
            Минимальные размеры: {formatFrameMaterialDimLimitDisplay(limits.minH)}×
            {formatFrameMaterialDimLimitDisplay(limits.minW)} мм.
          </div>
          <div className="frame3-limits-row">
            Максимальные размеры: {formatFrameMaterialDimLimitDisplay(limits.maxH)}×
            {formatFrameMaterialDimLimitDisplay(limits.maxW)} мм.
          </div>
        </div>
        <CalcStepPriceTotals />
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
            aria-label={`Чертёж фасада: высота ${sketchHeightN} мм, ширина ${sketchWidthN} мм`}
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
                    <div className="sketch-val sketch-val--texture-wrap">
                      {textureLabelDisplayWrap(materialTextureLabel(colorMaterial))}
                    </div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Размеры</div>
                    <div className="sketch-val">
                      {sketchHeightN}×{sketchWidthN} мм
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Размеры в стиле чертежа: выносные линии + размерная линия со стрелками */}
            <div className="frame3-dim-drawing frame3-dim-drawing--top">
              <div className="frame3-dim-drawing__value">{sketchWidthN} мм</div>
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
                <div className="frame3-dim-drawing__value frame3-dim-drawing__value--side">{sketchHeightN} мм</div>
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

