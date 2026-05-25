import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCalculatorProfileTypes, fetchMaterial } from '../api'
import type { Material } from '../types'
import { useCalcPaths } from './calcPathsContext'
import { CalcStepPriceTotals } from './CalcPriceTotals'
import type { HingeLayoutPersisted } from './frameCalcSession'
import {
  defaultHingeAbsPositionsMm,
  hingeAbsoluteToUserInputStrings,
  hingeEdgeLengthMm,
  hingeMeasuresFromEdgeStart,
  hingeUserInputsToAbsoluteMm,
  HingeMountSide,
  isFrameMortiseHingeSelected,
  isFrameStep2Ready,
  isFrameStep4Ready,
  HINGE_LAYOUT_COUNT_MAX,
  HINGE_LAYOUT_COUNT_MIN,
  readCalculatorPriceConfigKey,
  readFrameDimsMm,
  readHingeLayout,
  subscribeFrameCalcSession,
  validateHingePositions,
  writeHingeLayout,
} from './frameCalcSession'
import { materialTextureLabel, sketchFillingLine, textureLabelDisplayWrap } from './materialTextureLabel'
import { materialTextureLayerStyle, materialFillingTextureLayerStyle, facadeSketchScaleY } from './sketchFrame'
import { useFillingTypeName } from './useFillingTypeName'
import './Step2FrameFacade.css'
import './Step3FrameSizes.css'

function asNum(s: string) {
  const t = s.trim().replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function blendAspect(defaultAspect: number, targetAspect: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultAspect + (targetAspect - defaultAspect) * k
}

function fillingPaperStyle(_m: Material | null | undefined): CSSProperties {
  return {}
}

const SIDES: { id: HingeMountSide; label: string }[] = [
  { id: 'left', label: 'Слева' },
  { id: 'right', label: 'Справа' },
  { id: 'top', label: 'Сверху' },
  { id: 'bottom', label: 'Снизу' },
]

/** Строки полей по умолчанию; при известной L — равномерная раскладка `defaultHingeAbsPositionsMm`. */
function defaultHingeDistStrRow(L: number | null, count: number): string[] {
  if (L != null && Number.isFinite(L) && L > 0) {
    const abs = defaultHingeAbsPositionsMm(L, count)
    return hingeAbsoluteToUserInputStrings(L, abs, count)
  }
  return Array.from({ length: count }, () => '')
}

/** Зазор «размерная линия — эскиз» задаётся в CSS (`--hinge-chain-sketch-gap` на `.frame3-hinge-dim-layer`), как у верхнего габарита. */

/** Участок короче этого % длины стороны — чаще даёт наложение подписей. */
const HINGE_DIM_THIN_SPAN_PCT = 10

const HINGE_DIM_NUDGE_STEP_PX = 12

/** Узкий участок: стрелки не помещаются — вертикаль на всю высоту от выноски до выноски. */
const HINGE_DIM_NARROW_SPAN_PCT = 6

function parsePositions(distStr: string[]): number[] {
  return distStr.map((s) => Number(String(s).trim().replace(',', '.')))
}

function initDistStrFromStorage(initialSide: HingeMountSide): string[] {
  const saved = readHingeLayout()
  const c = clamp(saved?.count ?? HINGE_LAYOUT_COUNT_MIN, HINGE_LAYOUT_COUNT_MIN, HINGE_LAYOUT_COUNT_MAX)
  const side = saved?.side ?? initialSide
  if (!saved || saved.positionsMm.length !== saved.count) {
    const { w, h } = readFrameDimsMm()
    const L =
      w != null && h != null && w > 0 && h > 0 ? hingeEdgeLengthMm(side, w, h) : null
    return defaultHingeDistStrRow(L, c)
  }
  const { w, h } = readFrameDimsMm()
  if (w != null && h != null && w > 0 && h > 0) {
    const L = hingeEdgeLengthMm(saved.side, w, h)
    if (L > 0) return hingeAbsoluteToUserInputStrings(L, saved.positionsMm, saved.count)
  }
  return saved.positionsMm.map((n) =>
    Number.isFinite(n) ? String(Math.ceil(Math.max(0, n) - 1e-9)) : '',
  )
}

function hingeDistanceFieldLabel(side: HingeMountSide, idx: number, count: number): string {
  const n = idx + 1
  const fromStart = hingeMeasuresFromEdgeStart(idx, count)
  if (side === 'top' || side === 'bottom') {
    return fromStart
      ? `Расстояние от левого края до петли №${n} (мм)`
      : `Расстояние от правого края до петли №${n} (мм)`
  }
  return fromStart
    ? `Расстояние от верхнего края до петли №${n} (мм)`
    : `Расстояние от нижнего края до петли №${n} (мм)`
}

export function Step6FrameHingeLayout() {
  const nav = useNavigate()
  const { step } = useCalcPaths()
  const cfgKey = useSyncExternalStore(subscribeFrameCalcSession, readCalculatorPriceConfigKey, () => '')
  const fillingTypeName = useFillingTypeName(cfgKey)

  const savedOnce = useMemo(() => readHingeLayout(), [])
  const initialSide = savedOnce?.side ?? 'top'
  const [side, setSide] = useState<HingeMountSide>(initialSide)
  const [count, setCount] = useState(() =>
    clamp(savedOnce?.count ?? HINGE_LAYOUT_COUNT_MIN, HINGE_LAYOUT_COUNT_MIN, HINGE_LAYOUT_COUNT_MAX),
  )
  const [countStr, setCountStr] = useState(() =>
    String(clamp(savedOnce?.count ?? HINGE_LAYOUT_COUNT_MIN, HINGE_LAYOUT_COUNT_MIN, HINGE_LAYOUT_COUNT_MAX)),
  )
  const [distStr, setDistStr] = useState<string[]>(() => initDistStrFromStorage(initialSide))
  const prevSideRef = useRef(side)

  const dims = useMemo(() => readFrameDimsMm(), [cfgKey])
  const { w: widthMm, h: heightMm } = dims
  const edgeL = useMemo(() => {
    if (widthMm == null || heightMm == null) return null
    return hingeEdgeLengthMm(side, widthMm, heightMm)
  }, [side, widthMm, heightMm])

  const parsed = useMemo(() => {
    const parts = cfgKey.split('|')
    const h = parts[1] || '—'
    const w = parts[2] || '—'
    const fillIdRaw = parts[4]?.trim() ?? ''
    const fillMatId = fillIdRaw ? Number(fillIdRaw) : null
    return {
      height: h,
      width: w,
      heightN: h === '—' ? null : asNum(h),
      widthN: w === '—' ? null : asNum(w),
      fillMatId: fillMatId && Number.isFinite(fillMatId) && fillMatId > 0 ? fillMatId : null,
    }
  }, [cfgKey])

  const sketchAspect = useMemo(() => {
    if (parsed.heightN == null || parsed.widthN == null || parsed.heightN <= 0 || parsed.widthN <= 0) return undefined
    const target = parsed.widthN / parsed.heightN
    const softened = blendAspect(3 / 4.2, target, 0.28)
    return clamp(softened, 0.56, 0.92)
  }, [parsed.heightN, parsed.widthN])

  const sketchScaleY = useMemo(() => {
    if (parsed.heightN == null || parsed.heightN <= 0) return undefined
    return facadeSketchScaleY(parsed.heightN)
  }, [parsed.heightN])

  const [frameTypeName, setFrameTypeName] = useState('—')
  const [frameColorMaterial, setFrameColorMaterial] = useState<Material | null>(null)
  const [fillingMaterial, setFillingMaterial] = useState<Material | null>(null)

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    if (!isFrameStep4Ready()) nav(step('frame/filling'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    if (!isFrameMortiseHingeSelected()) nav(step('frame/handle-holes'), { replace: true })
  }, [cfgKey, nav, step])

  /** Другая сторона — другая ось; старые числа в полях теряют смысл. */
  useEffect(() => {
    if (prevSideRef.current === side) return
    prevSideRef.current = side
    setDistStr((p) => defaultHingeDistStrRow(edgeL, p.length))
    writeHingeLayout(null)
  }, [side, edgeL])

  /** Появилась длина кромки (была неизвестна при инициализации) — добить дефолты, в т.ч. центр при нечётном n. */
  useEffect(() => {
    if (edgeL == null) return
    setDistStr((prev) => {
      if (!prev.some((s) => String(s).trim() === '')) return prev
      return defaultHingeDistStrRow(edgeL, prev.length)
    })
  }, [edgeL])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const tid = localStorage.getItem('calc_frame_type_id')
      const cid = localStorage.getItem('calc_frame_color_id')
      if (cid) {
        try {
          const m = await fetchMaterial(Number(cid))
          if (!cancel) setFrameColorMaterial(m)
        } catch {
          /* ignore */
        }
      }
      if (tid) {
        try {
          const r = await fetchCalculatorProfileTypes()
          const t = (r.results ?? []).find((x) => x.id === Number(tid))
          if (!cancel && t) setFrameTypeName(t.name)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!parsed.fillMatId) {
        setFillingMaterial(null)
        return
      }
      try {
        const m = await fetchMaterial(parsed.fillMatId)
        if (!cancel) setFillingMaterial(m)
      } catch {
        if (!cancel) setFillingMaterial(null)
      }
    })()
    return () => {
      cancel = true
    }
  }, [parsed.fillMatId])

  const positionsAbs = useMemo(() => {
    if (edgeL == null) return null
    const parsed = parsePositions(distStr)
    if (parsed.length !== count) return null
    if (parsed.some((x) => !Number.isFinite(x))) return null
    return hingeUserInputsToAbsoluteMm(edgeL, count, parsed)
  }, [distStr, count, edgeL])

  const layoutError = useMemo(() => {
    if (positionsAbs == null) return null
    return validateHingePositions(side, positionsAbs)
  }, [positionsAbs, side])

  useEffect(() => {
    if (positionsAbs == null) return
    if (positionsAbs.length !== count) return
    const err = validateHingePositions(side, positionsAbs)
    if (err) return
    const next: HingeLayoutPersisted = { side, count, positionsMm: positionsAbs }
    const prev = readHingeLayout()
    if (prev && JSON.stringify(prev) === JSON.stringify(next)) return
    writeHingeLayout(next)
  }, [count, positionsAbs, side])

  const setCountSafe = useCallback(
    (n: number) => {
      const c = clamp(Math.trunc(n), HINGE_LAYOUT_COUNT_MIN, HINGE_LAYOUT_COUNT_MAX)
      setCount(c)
      setCountStr(String(c))
      setDistStr((prev) => {
        if (c === prev.length) return prev
        return defaultHingeDistStrRow(edgeL, c)
      })
    },
    [edgeL],
  )

  const edgeHint =
    side === 'top' || side === 'bottom'
      ? 'Петля №1 считается от левого края, остальные петли — от правого края. По умолчанию позиции равномерно вдоль кромки (по длине стороны из шага 3).'
      : 'Петля №1 считается от верхнего края, остальные петли — от нижнего края. По умолчанию позиции равномерно вдоль кромки (по длине стороны из шага 3).'

  /** Чтобы не наслаивать общие габариты на цепочки петель: основной размер с противоположной стороны. */
  const mainDimPlacement = useMemo(() => {
    const widthPos: 'top' | 'bottom' =
      side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : 'top'
    const heightPos: 'left' | 'right' =
      side === 'left' ? 'right' : side === 'right' ? 'left' : 'left'
    return { widthPos, heightPos }
  }, [side])

  const pinCoords = useMemo(() => {
    if (widthMm == null || heightMm == null || edgeL == null || positionsAbs == null) return []
    const nums = positionsAbs
    if (validateHingePositions(side, nums)) return []
    return nums.map((pos, i) => {
      if (side === 'top' || side === 'bottom') {
        const pct = (pos / widthMm) * 100
        return { i, pct, variant: side === 'top' ? ('top' as const) : ('bottom' as const) }
      }
      const pct = (pos / heightMm) * 100
      return { i, pct, variant: side === 'left' ? ('left' as const) : ('right' as const) }
    })
  }, [edgeL, heightMm, positionsAbs, side, widthMm])

  /** Размеры петель: №1 от начального края, остальные — от противоположного края. */
  const hingeChainDims = useMemo(() => {
    if (edgeL == null || positionsAbs == null) return []
    const nums = positionsAbs
    if (validateHingePositions(side, nums)) return []
    const L = edgeL
    const out: {
      key: string
      hingeIndex: number
      fromStart: boolean
      /** Доля 0…100: верх трека (уровень петли для №2+; 0 для №1). */
      trackTopPct: number
      /** Доля 0…100: высота трека до противоположного края фасада. */
      trackSpanPct: number
      valueMm: number
      trackOffsetPx: number
    }[] = []
    const trackStepPx = 26
    const endHingeIndices: number[] = []
    for (let k = 0; k < nums.length; k++) {
      if (!hingeMeasuresFromEdgeStart(k, nums.length)) endHingeIndices.push(k)
    }
    const endCount = endHingeIndices.length
    // Последняя петля (№n) — дорожка 0, как у №1; №2…№n−1 — ступеньки дальше от эскиза.
    endHingeIndices.sort((a, b) => nums[a] - nums[b])
    const endTrackRank = new Map(endHingeIndices.map((k, i) => [k, endCount - 1 - i]))
    for (let k = 0; k < nums.length; k++) {
      const fromStart = hingeMeasuresFromEdgeStart(k, nums.length)
      const pos = nums[k]
      const valueMm = fromStart ? pos : L - pos
      if (valueMm > 0.001) {
        const hingePct = (pos / L) * 100
        const endTrackIndex = fromStart ? 0 : (endTrackRank.get(k) ?? 0)
        const trackTopPct = fromStart ? 0 : hingePct
        const trackSpanPct = fromStart ? hingePct : 100 - hingePct
        out.push({
          key: `hinge-dim-${k}`,
          hingeIndex: k,
          fromStart,
          trackTopPct,
          trackSpanPct,
          valueMm,
          trackOffsetPx: endTrackIndex * trackStepPx,
        })
      }
    }
    return out
  }, [edgeL, positionsAbs, side])

  /** Сдвиг только подписи: линии/выноски остаются на месте. Вертикаль: вверх + чуть в сторону от фасада. */
  const hingeChainDimsLayout = useMemo(() => {
    const vertical = side === 'left' || side === 'right'
    let run = 0
    return hingeChainDims.map((seg) => {
      const span = seg.trackSpanPct
      let nudgeX = 0
      let nudgeY = 0
      if (span < HINGE_DIM_THIN_SPAN_PCT) {
        const off = run * HINGE_DIM_NUDGE_STEP_PX
        if (vertical) {
          nudgeY = -off
          nudgeX = side === 'left' ? -off * 0.85 : off * 0.85
        } else if (side === 'top') {
          nudgeX = -off
          nudgeY = -off * 0.65
        } else {
          nudgeX = off
          nudgeY = off * 0.65
        }
        run += 1
      } else {
        run = 0
      }
      return { ...seg, nudgeX, nudgeY }
    })
  }, [hingeChainDims, side])

  const formatDimMm = (v: number) => `${Math.round(v)} мм`

  function hingeLabelNudgeStyle(nudgeX: number, nudgeY: number): CSSProperties {
    return {
      ['--hinge-label-nudge-x' as string]: `${nudgeX}px`,
      ['--hinge-label-nudge-y' as string]: `${nudgeY}px`,
    }
  }

  return (
    <div className="frame2">
      <section className="frame3-left calc-side-panel">
        <div className="frame3-title" role="heading" aria-level={3}>
          Расстояния
        </div>

        {widthMm == null || heightMm == null ? (
          <p className="admin-error" style={{ marginTop: '0.75rem' }}>
            Задайте высоту и ширину фасада на шаге 3.
          </p>
        ) : null}

        <div className="calc-side-panel-scroll">
        <div className="frame3-field frame3-field--wide" style={{ marginTop: '1rem' }}>
          <div className="frame3-label">Количество отверстий под петли (шт.)</div>
          <input
            className="admin-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-valuemin={HINGE_LAYOUT_COUNT_MIN}
            aria-valuemax={HINGE_LAYOUT_COUNT_MAX}
            value={countStr}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                setCountStr('')
                return
              }
              const digits = raw.replace(/\D/g, '')
              if (digits === '') return
              setCountStr(digits)
              const n = parseInt(digits, 10)
              if (
                Number.isFinite(n) &&
                n >= HINGE_LAYOUT_COUNT_MIN &&
                n <= HINGE_LAYOUT_COUNT_MAX
              ) {
                setCountSafe(n)
              }
            }}
            onBlur={() => {
              const t = countStr.trim()
              if (t === '') {
                setCountSafe(HINGE_LAYOUT_COUNT_MIN)
                return
              }
              const n = parseInt(t, 10)
              setCountSafe(Number.isFinite(n) ? n : HINGE_LAYOUT_COUNT_MIN)
            }}
          />
        </div>

        <div className="frame3-field frame3-field--wide">
          <div className="frame3-label">Сторона фасада под петли</div>
          <div className="calc-facade-grid" style={{ marginTop: '0.5rem' }} role="radiogroup" aria-label="Сторона петель">
            {SIDES.map((s) => (
              <label key={s.id} className="calc-facade" style={{ minHeight: 'auto', padding: '0.5rem 0.65rem' }}>
                <input
                  className="calc-facade-radio"
                  type="radio"
                  name="hinge-side"
                  checked={side === s.id}
                  onChange={() => setSide(s.id)}
                />
                <span className="calc-facade-title" style={{ fontSize: '0.9rem' }}>
                  {s.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <p className="admin-muted" style={{ marginTop: '0.65rem', fontSize: '0.86rem' }}>
          {edgeHint}
        </p>

        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
          {Array.from({ length: count }, (_, idx) => (
            <div key={idx} className="frame3-field">
              <label className="frame3-label" htmlFor={`hinge-dist-${idx}`}>
                {hingeDistanceFieldLabel(side, idx, count)}
              </label>
              <input
                id={`hinge-dist-${idx}`}
                className={['admin-input', layoutError ? 'frame3-input--bad' : ''].filter(Boolean).join(' ')}
                inputMode="decimal"
                value={distStr[idx] ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setDistStr((prev) => {
                    const next = [...prev]
                    next[idx] = v
                    return next
                  })
                }}
                placeholder="мм"
              />
            </div>
          ))}
        </div>

        {layoutError && distStr.every((s) => String(s).trim() !== '') && positionsAbs != null ? (
          <div className="admin-error" style={{ marginTop: '0.85rem' }}>
            {layoutError}
          </div>
        ) : null}
        <CalcStepPriceTotals />
        </div>

        <div className="frame2-card-nav" style={{ marginTop: '1.25rem', paddingTop: '1rem' }}>
          <button type="button" className="admin-secondary" onClick={() => nav(step('frame/summary'))}>
            ← Предыдущий шаг
          </button>
          <button type="button" className="admin-primary" onClick={() => nav(step('frame/handle-holes'))}>
            Следующий шаг →
          </button>
        </div>
      </section>

      <section className="frame2-sketch frame3-right" aria-label="Эскиз фасада с петлями">
        <div className="frame2-sketch-inner frame3-sketch">
          <div className="frame3-drawing" aria-label="Чертёж фасада">
            <div className="frame3-drawing-core">
              <div
                className={['sketch', pinCoords.length > 0 ? 'sketch--hinge-markers' : ''].filter(Boolean).join(' ')}
                style={
                  sketchAspect || sketchScaleY
                    ? ({
                        aspectRatio: sketchAspect,
                        ['--sketch-scale-y' as any]: sketchScaleY,
                      } as any)
                    : undefined
                }
              >
                <div className="sketch-frame">
                  <div className="sketch-frame-texture" style={materialTextureLayerStyle(frameColorMaterial)} />
                </div>
                <div className="sketch-paper" style={fillingPaperStyle(fillingMaterial)}>
                  <div className="sketch-paper-texture" style={materialFillingTextureLayerStyle(fillingMaterial as any)} />
                </div>
                <div className="sketch-sheet">
                  <div className="sketch-title">ЛИЦЕВАЯ СТОРОНА ФАСАДА</div>
                  <div className="sketch-sub">Визуализация примерная</div>
                  <div className="sketch-table">
                    <div className="sketch-row">
                      <div className="sketch-key">Профиль</div>
                      <div className="sketch-val">{frameTypeName}</div>
                    </div>
                    <div className="sketch-row">
                      <div className="sketch-key">Цвет</div>
                      <div className="sketch-val sketch-val--texture-wrap">
                        {textureLabelDisplayWrap(materialTextureLabel(frameColorMaterial))}
                      </div>
                    </div>
                    <div className="sketch-row">
                      <div className="sketch-key">В × Ш (мм)</div>
                      <div className="sketch-val">
                        {parsed.height} × {parsed.width}
                      </div>
                    </div>
                    <div className="sketch-row">
                      <div className="sketch-key">Наполнение</div>
                      <div className="sketch-val sketch-val--texture-wrap">
                        {textureLabelDisplayWrap(sketchFillingLine(fillingTypeName, fillingMaterial))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sketch-hinge-layer" aria-hidden={pinCoords.length === 0}>
                  {pinCoords.map((p) => {
                    const style: CSSProperties =
                      p.variant === 'top'
                        ? { top: 0, left: `${p.pct}%`, transform: 'translateX(-50%)' }
                        : p.variant === 'bottom'
                          ? { bottom: 0, left: `${p.pct}%`, transform: 'translateX(-50%)' }
                          : p.variant === 'left'
                            ? { left: 0, top: `${p.pct}%`, transform: 'translateY(-50%)' }
                            : { right: 0, top: `${p.pct}%`, transform: 'translateY(-50%)' }
                    return (
                      <div key={p.i} className={`sketch-hinge-pin sketch-hinge-pin--${p.variant}`} style={style}>
                        <div className="sketch-hinge-pin-stack">
                          <span className="sketch-hinge-pin-body" aria-hidden />
                          <span className="sketch-hinge-pin-label">№{p.i + 1}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {hingeChainDimsLayout.length > 0 ? (
                <div className="frame3-hinge-dim-layer" aria-hidden>
                  {hingeChainDimsLayout.map((seg) => {
                    const vLabel = formatDimMm(seg.valueMm)
                    if (side === 'left' || side === 'right') {
                      const spanPct = seg.trackSpanPct
                      const narrow = spanPct < HINGE_DIM_NARROW_SPAN_PCT
                      const labelStyle = hingeLabelNudgeStyle(seg.nudgeX, seg.nudgeY)
                      const spanHeightPct = Math.max(spanPct, 0.8)
                      const trackShift =
                        side === 'left'
                          ? `translateX(calc(-100% - var(--hinge-chain-sketch-gap, 30px) - ${seg.trackOffsetPx}px))`
                          : `translateX(calc(100% + var(--hinge-chain-sketch-gap, 30px) + ${seg.trackOffsetPx}px))`
                      const outer: CSSProperties =
                        side === 'left'
                          ? {
                              left: 0,
                              top: `${seg.trackTopPct}%`,
                              height: `${spanHeightPct}%`,
                              width: '1.35rem',
                              ['--hinge-chain-track-offset' as any]: `${seg.trackOffsetPx}px`,
                              transform: trackShift,
                            }
                          : {
                              right: 0,
                              top: `${seg.trackTopPct}%`,
                              height: `${spanHeightPct}%`,
                              width: '1.35rem',
                              ['--hinge-chain-track-offset' as any]: `${seg.trackOffsetPx}px`,
                              transform: trackShift,
                            }
                      return (
                        <div
                          key={seg.key}
                          className={[
                            'hinge-chain-dim hinge-chain-dim--v',
                            `hinge-chain-dim--${side}`,
                            seg.trackOffsetPx > 0 ? 'hinge-chain-dim--tracked' : '',
                            narrow ? 'hinge-chain-dim--narrow' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={outer}
                        >
                          <span className="hinge-chain-dim__wit hinge-chain-dim__wit--start" />
                          <span className="hinge-chain-dim__wit hinge-chain-dim__wit--end" />
                          <div className="hinge-chain-dim__body">
                            <div className="hinge-chain-dim__val" style={labelStyle}>
                              {vLabel}
                            </div>
                            <div className="hinge-chain-dim__v">
                              <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--n" />
                              <span className="hinge-chain-dim__v-line" />
                              <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--s" />
                            </div>
                          </div>
                        </div>
                      )
                    }
                    const hLabelStyle = hingeLabelNudgeStyle(seg.nudgeX, seg.nudgeY)
                    const hSpanPct = Math.max(seg.trackSpanPct, 0.8)
                    const outer: CSSProperties =
                      side === 'top'
                        ? {
                            top: 0,
                            left: `${seg.trackTopPct}%`,
                            width: `${hSpanPct}%`,
                            height: '1.65rem',
                            ['--hinge-chain-track-offset' as any]: `${seg.trackOffsetPx}px`,
                            transform: `translateY(calc(-100% - var(--hinge-chain-sketch-gap, 30px) - ${seg.trackOffsetPx}px))`,
                          }
                        : {
                            bottom: 0,
                            left: `${seg.trackTopPct}%`,
                            width: `${hSpanPct}%`,
                            height: '1.65rem',
                            ['--hinge-chain-track-offset' as any]: `${seg.trackOffsetPx}px`,
                            transform: `translateY(calc(100% + var(--hinge-chain-sketch-gap, 30px) + ${seg.trackOffsetPx}px))`,
                          }
                    return (
                      <div key={seg.key} className={`hinge-chain-dim hinge-chain-dim--h hinge-chain-dim--${side}`} style={outer}>
                        <span className="hinge-chain-dim__wit hinge-chain-dim__wit--start" />
                        <span className="hinge-chain-dim__wit hinge-chain-dim__wit--end" />
                        <div className="hinge-chain-dim__body hinge-chain-dim__body--h">
                          <div className="hinge-chain-dim__val hinge-chain-dim__val--h" style={hLabelStyle}>
                            {vLabel}
                          </div>
                          <div className="hinge-chain-dim__h">
                            <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--w" />
                            <span className="hinge-chain-dim__h-line" />
                            <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--e" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div
              className={`frame3-dim-drawing frame3-dim-drawing--${mainDimPlacement.widthPos}`}
            >
              <div className="frame3-dim-drawing__value">{parsed.widthN ?? '—'} мм</div>
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

            <div
              className={`frame3-dim-drawing frame3-dim-drawing--${mainDimPlacement.heightPos}`}
            >
              <div className="frame3-dim-drawing__left-col">
                <div className="frame3-dim-drawing__value frame3-dim-drawing__value--side">
                  {parsed.heightN ?? '—'} мм
                </div>
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

export default Step6FrameHingeLayout
