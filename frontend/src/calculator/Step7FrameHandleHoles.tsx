import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCalculatorHandleHoleDiameters,
  fetchCalculatorProfileTypes,
  fetchMaterial,
} from '../api'
import type { CalculatorHandleHoleDiameter, Material } from '../types'
import { FtSelect } from '../FtSelect'
import { HandleHoleDiameterAdminSelect } from './HandleHoleDiameterAdminSelect'
import { useCalcPaths } from './calcPathsContext'
import { CalcStepPriceTotals } from './CalcPriceTotals'
import {
  defaultHingeAbsPositionsMm,
  handleHoleCentersMm,
  hingeEdgeLengthMm,
  type HandleHolesPersisted,
  type HandleOrientation,
  type HingeMountSide,
  isFrameMortiseHingeSelected,
  isFrameStep2Ready,
  isFrameStep4Ready,
  isHandleSideBlockedByHinges,
  readCalculatorPriceConfigKey,
  readFrameDimsMm,
  readHandleHoles,
  readHingeLayout,
  subscribeFrameCalcSession,
  validateHandleHoles,
  validateHingePositions,
  writeHandleHoles,
} from './frameCalcSession'
import { materialTextureLabel, sketchFillingLine, textureLabelDisplayWrap } from './materialTextureLabel'
import { materialTextureLayerStyle, materialFillingTextureLayerStyle, facadeSketchScaleY } from './sketchFrame'
import { useFillingTypeName } from './useFillingTypeName'
import './Step2FrameFacade.css'
import './Step3FrameSizes.css'

const MAX_HANDLE_HOLES = 10

/** Если API недоступен — те же значения, что в миграции БД. */
const FALLBACK_DIAMETERS_MM = [4, 5, 6, 7, 8, 9, 10, 12, 16, 20] as const

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

function asNum(s: string) {
  const t = s.trim().replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function firstFreeHandleSide(
  orientation: HandleOrientation,
  hingeSide: HingeMountSide | undefined,
): HingeMountSide {
  const v: HingeMountSide[] = ['left', 'right']
  const h: HingeMountSide[] = ['top', 'bottom']
  const list = orientation === 'vertical' ? v : h
  return list.find((s) => !isHandleSideBlockedByHinges(hingeSide, orientation, s)) ?? list[0]
}

/** Участок короче этого % длины стороны — чаще даёт наложение подписей. */
const HANDLE_DIM_THIN_SPAN_PCT = 10
const HANDLE_DIM_NUDGE_STEP_PX = 12
const HANDLE_DIM_NARROW_SPAN_PCT = 6

/** Как на шаге 6 — цепочки размеров петель на эскизе. */
const HINGE_DIM_THIN_SPAN_PCT = 10
const HINGE_DIM_NUDGE_STEP_PX = 12
const HINGE_DIM_NARROW_SPAN_PCT = 6

export function Step7FrameHandleHoles() {
  const nav = useNavigate()
  const { step, readOnly } = useCalcPaths()
  const isAdminCalculator = !readOnly
  const cfgKey = useSyncExternalStore(subscribeFrameCalcSession, readCalculatorPriceConfigKey, () => '')
  const fillingTypeName = useFillingTypeName(cfgKey)
  const mortiseHingeStep = useMemo(() => isFrameMortiseHingeSelected(), [cfgKey])

  const hingeLayout = useMemo(() => readHingeLayout(), [cfgKey])
  const hingeSide = hingeLayout?.side

  const dims = useMemo(() => readFrameDimsMm(), [cfgKey])
  const { w: widthMm, h: heightMm } = dims

  /** Сырая строка поля: можно очистить; пустое при blur → «0». */
  const [countStr, setCountStr] = useState('0')
  const holeCount = useMemo(() => {
    const t = countStr.trim()
    if (t === '') return null as number | null
    const n = Math.floor(Number(t.replace(',', '.')))
    if (!Number.isFinite(n)) return null
    return clamp(n, 0, MAX_HANDLE_HOLES)
  }, [countStr])
  const [diameterStr, setDiameterStr] = useState('7')
  /** null — ответ ещё не получен (ошибка сети оставляет null → используем fallback). */
  const [diaList, setDiaList] = useState<CalculatorHandleHoleDiameter[] | null>(null)
  const [diaCatalogScope, setDiaCatalogScope] = useState<'full' | 'client' | null>(null)
  const [diaAdminErr, setDiaAdminErr] = useState<string | null>(null)
  const [bushings, setBushings] = useState(false)
  const [orientation, setOrientation] = useState<HandleOrientation>('vertical')
  const [handleSide, setHandleSide] = useState<HingeMountSide>('left')
  const [offsetStr, setOffsetStr] = useState('')
  const [spanStr, setSpanStr] = useState<string[]>([])

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
    let cancel = false
    fetchCalculatorHandleHoleDiameters()
      .then((r) => {
        if (!cancel) {
          setDiaList(r.results ?? [])
          setDiaCatalogScope(r.catalog_scope === 'full' ? 'full' : 'client')
        }
      })
      .catch(() => {
        if (!cancel) {
          setDiaList(null)
          setDiaCatalogScope(null)
        }
      })
    return () => {
      cancel = true
    }
  }, [])

  const diameterSelectOptions = useMemo(() => {
    if (diaList != null) {
      if (diaList.length === 0) return []
      return diaList.map((row) => ({ value: String(row.diameter_mm), label: `${row.diameter_mm} мм` }))
    }
    return FALLBACK_DIAMETERS_MM.map((n) => ({ value: String(n), label: `${n} мм` }))
  }, [diaList])

  const diameterAllowSet = useMemo(() => {
    if (diaList != null) return new Set(diaList.map((x) => x.diameter_mm))
    return new Set<number>(FALLBACK_DIAMETERS_MM)
  }, [diaList])

  useEffect(() => {
    if (diaList === null || diaList.length === 0) return
    const allowed = new Set(diaList.map((x) => x.diameter_mm))
    setDiameterStr((prev) => {
      const n = Number(String(prev).replace(',', '.'))
      if (Number.isFinite(n) && allowed.has(Math.round(n))) return prev
      return String(diaList[0].diameter_mm)
    })
  }, [diaList])

  const handleEdgeL = useMemo(() => {
    if (widthMm == null || heightMm == null) return null
    return hingeEdgeLengthMm(handleSide, widthMm, heightMm)
  }, [handleSide, widthMm, heightMm])

  const applyUniformDefaults = useCallback((c: number, L: number | null) => {
    if (c <= 0 || L == null || L <= 0) {
      setOffsetStr('')
      setSpanStr([])
      return
    }
    const abs = defaultHingeAbsPositionsMm(L, c)
    setOffsetStr(String(Math.round(abs[0] * 1000) / 1000))
    if (c <= 1) {
      setSpanStr([])
    } else {
      const spans = abs.slice(1).map((a, i) => a - abs[i])
      setSpanStr(spans.map((x) => String(Math.round(x * 1000) / 1000)))
    }
  }, [])

  const didHydrate = useRef(false)
  useLayoutEffect(() => {
    if (didHydrate.current) return
    didHydrate.current = true
    const saved = readHandleHoles()
    const { w, h } = readFrameDimsMm()

    if (saved) {
      setCountStr(String(saved.count))
      setDiameterStr(String(Math.round(saved.diameterMm)))
      setBushings(saved.bushings)
      setOrientation(saved.orientation)
      setHandleSide(saved.side)
      setOffsetStr(String(saved.offsetStartMm))
      setSpanStr(saved.spanMm.map((x) => String(x)))
      return
    }

    if (w != null && h != null && w > 0 && h > 0) {
      const hinge = readHingeLayout()
      const orient: HandleOrientation = 'vertical'
      const side0 = firstFreeHandleSide(orient, hinge?.side)
      const L0 = hingeEdgeLengthMm(side0, w, h)
      setOrientation(orient)
      setHandleSide(side0)
      setCountStr('0')
      setDiameterStr('7')
      setBushings(false)
      applyUniformDefaults(0, L0)
    }
  }, [applyUniformDefaults])

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    if (!isFrameStep4Ready()) nav(step('frame/filling'), { replace: true })
  }, [nav, step])

  /** Сторона: не на стороне петель; при смене ориентации — допустимая сторона. */
  useEffect(() => {
    setHandleSide((prev) => {
      const candidates: HingeMountSide[] =
        orientation === 'vertical' ? ['left', 'right'] : ['top', 'bottom']
      if (!candidates.includes(prev)) return firstFreeHandleSide(orientation, hingeSide)
      if (isHandleSideBlockedByHinges(hingeSide, orientation, prev)) {
        return firstFreeHandleSide(orientation, hingeSide)
      }
      return prev
    })
  }, [orientation, hingeSide])

  const persistedDraft = useMemo((): HandleHolesPersisted | null => {
    if (holeCount == null || holeCount < 1) return null
    const d = asNum(diameterStr)
    if (d == null || d <= 0) return null
    if (diaList !== null && diaList.length === 0) return null
    if (!diameterAllowSet.has(Math.round(d))) return null
    const off = asNum(offsetStr)
    if (off == null) return null
    const spans = spanStr.map((s) => asNum(s))
    if (spans.length !== holeCount - 1) return null
    if (spans.some((x) => x == null || (x ?? 0) <= 0)) return null
    return {
      count: holeCount,
      diameterMm: d,
      bushings,
      orientation,
      side: handleSide,
      offsetStartMm: off,
      spanMm: spans.map((x) => x as number),
    }
  }, [bushings, holeCount, diameterAllowSet, diameterStr, diaList, handleSide, offsetStr, orientation, spanStr])

  const layoutError = useMemo(() => {
    if (holeCount === null) return null
    if (holeCount === 0) {
      const any = offsetStr.trim() !== '' || spanStr.some((s) => s.trim() !== '')
      return any ? 'При нуле отверстий укажите количество > 0 или очистите поля расположения.' : null
    }
    if (persistedDraft == null) {
      const any = offsetStr.trim() !== '' || spanStr.some((s) => s.trim() !== '')
      return any ? 'Проверьте введённые числа.' : null
    }
    return validateHandleHoles(persistedDraft, hingeLayout)
  }, [hingeLayout, holeCount, offsetStr, persistedDraft, spanStr])

  const valid =
    holeCount !== null && (holeCount === 0 ? layoutError == null : persistedDraft != null && layoutError == null)

  useEffect(() => {
    if (holeCount !== 0) return
    writeHandleHoles(null)
  }, [holeCount])

  useEffect(() => {
    if (!valid || persistedDraft == null) return
    const err = validateHandleHoles(persistedDraft, hingeLayout)
    if (err) return
    const prev = readHandleHoles()
    if (prev && JSON.stringify(prev) === JSON.stringify(persistedDraft)) return
    writeHandleHoles(persistedDraft)
  }, [valid, persistedDraft, hingeLayout])

  const hingePositionsOk = useMemo(() => {
    if (!hingeLayout) return null
    return validateHingePositions(hingeLayout.side, hingeLayout.positionsMm) == null
      ? hingeLayout.positionsMm
      : null
  }, [hingeLayout])

  const handleCenters = useMemo(() => {
    if (!valid || persistedDraft == null || holeCount == null || holeCount < 1) return null
    const c = handleHoleCentersMm(persistedDraft)
    if (c.length !== holeCount) return null
    if (validateHandleHoles(persistedDraft, hingeLayout)) return null
    return c
  }, [holeCount, hingeLayout, persistedDraft, valid])

  const hingePinCoords = useMemo(() => {
    if (widthMm == null || heightMm == null || !hingeLayout || hingePositionsOk == null) return []
    const side = hingeLayout.side
    return hingePositionsOk.map((pos, i) => {
      if (side === 'top' || side === 'bottom') {
        const pct = (pos / widthMm) * 100
        return { i, pct, variant: side === 'top' ? ('top' as const) : ('bottom' as const) }
      }
      const pct = (pos / heightMm) * 100
      return { i, pct, variant: side === 'left' ? ('left' as const) : ('right' as const) }
    })
  }, [heightMm, hingeLayout, hingePositionsOk, widthMm])

  const hingeEdgeL = useMemo(() => {
    if (!hingeLayout || widthMm == null || heightMm == null) return null
    return hingeEdgeLengthMm(hingeLayout.side, widthMm, heightMm)
  }, [hingeLayout, widthMm, heightMm])

  /** Цепочки размеров по петлям — те же, что на шаге 6. */
  const hingeChainDims = useMemo(() => {
    if (hingeEdgeL == null || hingePositionsOk == null) return []
    const L = hingeEdgeL
    const nums = hingePositionsOk
    const out: { key: string; t0: number; t1: number; valueMm: number }[] = []
    let prev = 0
    for (let k = 0; k < nums.length; k++) {
      const t0 = (prev / L) * 100
      const t1 = (nums[k] / L) * 100
      const valueMm = nums[k] - prev
      if (valueMm > 0.001) {
        out.push({ key: `step6-hinge-dim-${k}`, t0, t1, valueMm })
      }
      prev = nums[k]
    }
    const tail = L - prev
    if (tail > 0.001) {
      out.push({
        key: 'step6-hinge-dim-end',
        t0: (prev / L) * 100,
        t1: 100,
        valueMm: tail,
      })
    }
    return out
  }, [hingeEdgeL, hingePositionsOk])

  const hingeChainDimsLayout = useMemo(() => {
    if (!hingeLayout) return []
    const side = hingeLayout.side
    const vertical = side === 'left' || side === 'right'
    let run = 0
    return hingeChainDims.map((seg) => {
      const span = seg.t1 - seg.t0
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
  }, [hingeChainDims, hingeLayout])

  const handlePinCoords = useMemo(() => {
    if (widthMm == null || heightMm == null || handleCenters == null) return []
    const side = handleSide
    return handleCenters.map((pos, i) => {
      if (side === 'top' || side === 'bottom') {
        const pct = (pos / widthMm) * 100
        return { i, pct, variant: side === 'top' ? ('top' as const) : ('bottom' as const) }
      }
      const pct = (pos / heightMm) * 100
      return { i, pct, variant: side === 'left' ? ('left' as const) : ('right' as const) }
    })
  }, [handleCenters, handleSide, heightMm, widthMm])

  const mainDimSide = hingeLayout?.side ?? handleSide
  /** Как шаг 5: только общие габариты сверху и слева, без цепочек и маркеров петель/ручки. */
  const noHandleOnSketch = holeCount === 0
  const mainDimPlacement = useMemo(() => {
    if (noHandleOnSketch) {
      return { widthPos: 'top' as const, heightPos: 'left' as const }
    }
    const widthPos: 'top' | 'bottom' =
      mainDimSide === 'top' ? 'bottom' : mainDimSide === 'bottom' ? 'top' : 'top'
    const heightPos: 'left' | 'right' =
      mainDimSide === 'left' ? 'right' : mainDimSide === 'right' ? 'left' : 'left'
    return { widthPos, heightPos }
  }, [mainDimSide, noHandleOnSketch])

  const handleChainDims = useMemo(() => {
    if (handleEdgeL == null || handleCenters == null) return []
    const L = handleEdgeL
    const nums = handleCenters
    const out: { key: string; t0: number; t1: number; valueMm: number }[] = []
    let prev = 0
    for (let k = 0; k < nums.length; k++) {
      const t0 = (prev / L) * 100
      const t1 = (nums[k] / L) * 100
      const valueMm = nums[k] - prev
      if (valueMm > 0.001) {
        out.push({ key: `handle-dim-${k}`, t0, t1, valueMm })
      }
      prev = nums[k]
    }
    const tail = L - prev
    if (tail > 0.001) {
      out.push({
        key: 'handle-dim-end',
        t0: (prev / L) * 100,
        t1: 100,
        valueMm: tail,
      })
    }
    return out
  }, [handleCenters, handleEdgeL])

  const handleChainDimsLayout = useMemo(() => {
    const vertical = handleSide === 'left' || handleSide === 'right'
    let run = 0
    return handleChainDims.map((seg) => {
      const span = seg.t1 - seg.t0
      let nudgeX = 0
      let nudgeY = 0
      if (span < HANDLE_DIM_THIN_SPAN_PCT) {
        const off = run * HANDLE_DIM_NUDGE_STEP_PX
        if (vertical) {
          nudgeY = off
          nudgeX = handleSide === 'left' ? off * 0.5 : -off * 0.5
        } else if (handleSide === 'top') {
          nudgeX = off
          nudgeY = off * 0.5
        } else {
          nudgeX = -off
          nudgeY = -off * 0.5
        }
        run += 1
      } else {
        run = 0
      }
      return { ...seg, nudgeX, nudgeY }
    })
  }, [handleChainDims, handleSide])

  const formatDimMm = (v: number) => `${Math.round(v)} мм`

  function verticalChainLabelStyle(lr: 'left' | 'right', nudgeX: number, nudgeY: number): CSSProperties {
    const rot = lr === 'left' ? -90 : 90
    if (nudgeX === 0 && nudgeY === 0) return { transform: `rotate(${rot}deg)` }
    return { transform: `translate(${nudgeX}px, ${nudgeY}px) rotate(${rot}deg)` }
  }

  function horizontalChainLabelStyle(nudgeX: number, nudgeY: number): CSSProperties | undefined {
    if (nudgeX === 0 && nudgeY === 0) return undefined
    return { transform: `translate(${nudgeX}px, ${nudgeY}px)` }
  }

  const sideOptions: { id: HingeMountSide; label: string }[] =
    orientation === 'vertical'
      ? [
          { id: 'left', label: 'Слева' },
          { id: 'right', label: 'Справа' },
        ]
      : [
          { id: 'top', label: 'Сверху' },
          { id: 'bottom', label: 'Снизу' },
        ]

  const syncLayoutForCount = useCallback(
    (c: number) => {
      if (widthMm != null && heightMm != null) {
        const L = hingeEdgeLengthMm(handleSide, widthMm, heightMm)
        applyUniformDefaults(c, L)
      }
    },
    [applyUniformDefaults, handleSide, widthMm, heightMm],
  )

  return (
    <div className="frame2">
      <section className="frame3-left calc-side-panel">
        <div className="frame3-title" role="heading" aria-level={3}>
          Отверстия под ручку
        </div>

        {widthMm == null || heightMm == null ? (
          <p className="admin-error" style={{ marginTop: '0.75rem' }}>
            Задайте высоту и ширину фасада на шаге 3.
          </p>
        ) : null}

        <div className="calc-side-panel-scroll">
        <div className="frame3-field frame3-field--wide" style={{ marginTop: '1rem' }}>
          <div className="frame3-label">Количество отверстий под ручку (шт.)</div>
          <input
            className="admin-input"
            type="number"
            min={0}
            max={MAX_HANDLE_HOLES}
            value={countStr}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                setCountStr('')
                return
              }
              const n = Math.trunc(Number(raw))
              if (!Number.isFinite(n)) return
              const c = clamp(n, 0, MAX_HANDLE_HOLES)
              setCountStr(String(c))
              syncLayoutForCount(c)
            }}
            onBlur={() => {
              if (countStr.trim() === '') {
                setCountStr('0')
                syncLayoutForCount(0)
              }
            }}
          />
        </div>

        <div className="frame3-field frame3-field--wide">
          <label className="frame3-label" htmlFor="handle-diameter">
            Диаметр (d) отверстий под ручку (мм)
          </label>
          {diaList !== null &&
          diaList.length === 0 &&
          (!isAdminCalculator || diaCatalogScope !== 'full') ? (
            <p className="admin-error" style={{ marginTop: '0.35rem' }}>
              Нет диаметров, отмеченных для клиента. Обратитесь к администратору или откройте настройку калькулятора в админ-панели.
            </p>
          ) : null}
          {isAdminCalculator && diaCatalogScope === 'full' && diaList !== null ? (
            <HandleHoleDiameterAdminSelect
              id="handle-diameter"
              value={diameterStr}
              onChange={(v) => setDiameterStr(v)}
              rows={diaList}
              onRowsChange={(next) => setDiaList(next)}
              adminError={diaAdminErr}
              onAdminError={setDiaAdminErr}
              aria-label="Диаметр отверстия"
            />
          ) : (
            <FtSelect
              id="handle-diameter"
              value={diameterStr}
              onChange={(v) => setDiameterStr(v)}
              options={diameterSelectOptions}
              aria-label="Диаметр отверстия"
              menuStrategy="inline"
            />
          )}
          {isAdminCalculator && diaCatalogScope === 'client' && diaList != null ? (
            <p className="admin-muted" style={{ margin: '0.75rem 0 0', fontSize: '0.86rem' }}>
              Редактирование каталога диаметров доступно под учётной записью редактора (см.{' '}
              <code style={{ fontSize: '0.82em' }}>create_materials_editor</code> в README). На сервере должны быть применены
              миграции и права группы «Редактор материалов» (
              <code style={{ fontSize: '0.82em' }}>0028_editor_perms_handle_hole_diameter</code>
              ). Если вы уже редактор — обновите backend и выполните{' '}
              <code style={{ fontSize: '0.82em' }}>python backend/manage.py migrate</code>.
            </p>
          ) : null}
        </div>

        <label className="frame3-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input type="checkbox" checked={bushings} onChange={(e) => setBushings(e.target.checked)} />
          <span>Комплектация втулками</span>
        </label>

        <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '1rem 0' }} />

        <div className="frame3-label">Задать расположение для ручки:</div>
        <div className="calc-facade-grid" style={{ marginTop: '0.5rem' }} role="radiogroup">
          {(
            [
              { id: 'vertical' as const, label: 'Вертикально' },
              { id: 'horizontal' as const, label: 'Горизонтально' },
            ] as const
          ).map((o) => (
            <label key={o.id} className="calc-facade" style={{ minHeight: 'auto', padding: '0.5rem 0.65rem' }}>
              <input
                className="calc-facade-radio"
                type="radio"
                name="handle-orientation"
                checked={orientation === o.id}
                onChange={() => {
                  setOrientation(o.id)
                  const newSide = firstFreeHandleSide(o.id, hingeSide)
                  setHandleSide(newSide)
                  if (widthMm != null && heightMm != null) {
                    const Ln = hingeEdgeLengthMm(newSide, widthMm, heightMm)
                    applyUniformDefaults(holeCount ?? 0, Ln)
                  }
                }}
              />
              <span className="calc-facade-title" style={{ fontSize: '0.9rem' }}>
                {o.label}
              </span>
            </label>
          ))}
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '1rem 0' }} />

        <div className="frame3-label">Задать сторону:</div>
        <div className="calc-facade-grid" style={{ marginTop: '0.5rem' }} role="radiogroup">
          {sideOptions.map((s) => {
            const blocked = isHandleSideBlockedByHinges(hingeSide, orientation, s.id)
            return (
              <label
                key={s.id}
                className="calc-facade"
                style={{
                  minHeight: 'auto',
                  padding: '0.5rem 0.65rem',
                  opacity: blocked ? 0.45 : 1,
                }}
              >
                <input
                  className="calc-facade-radio"
                  type="radio"
                  name="handle-side"
                  disabled={blocked}
                  checked={handleSide === s.id}
                  onChange={() => {
                    setHandleSide(s.id)
                    if (widthMm != null && heightMm != null) {
                      const Ln = hingeEdgeLengthMm(s.id, widthMm, heightMm)
                      applyUniformDefaults(holeCount ?? 0, Ln)
                    }
                  }}
                />
                <span className="calc-facade-title" style={{ fontSize: '0.9rem' }}>
                  {s.label}
                </span>
              </label>
            )
          })}
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '1rem 0' }} />

        <div className="frame3-label">Задать межосевые расстояния:</div>
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
          <div className="frame3-field">
            <label className="frame3-label" htmlFor="handle-offset">
              От начала стороны до центра отверстия №1 (мм)
            </label>
            <input
              id="handle-offset"
              className="admin-input"
              inputMode="decimal"
              value={offsetStr}
              onChange={(e) => setOffsetStr(e.target.value)}
              placeholder="мм"
            />
          </div>
          {Array.from({ length: Math.max(0, (holeCount ?? 0) - 1) }, (_, idx) => (
            <div key={idx} className="frame3-field">
              <label className="frame3-label" htmlFor={`handle-span-${idx}`}>
                Межосевое A({idx + 1}): между №{idx + 1} и №{idx + 2} (мм)
              </label>
              <input
                id={`handle-span-${idx}`}
                className="admin-input"
                inputMode="decimal"
                value={spanStr[idx] ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setSpanStr((prev) => {
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

        {layoutError ? (
          <div className="admin-error" style={{ marginTop: '0.85rem' }}>
            {layoutError}
          </div>
        ) : null}
        <CalcStepPriceTotals />
        </div>

        <div className="frame2-card-nav" style={{ marginTop: '1.25rem', paddingTop: '1rem' }}>
          <button
            type="button"
            className="admin-secondary"
            onClick={() => nav(step(mortiseHingeStep ? 'frame/hinge-layout' : 'frame/summary'))}
          >
            ← Предыдущий шаг
          </button>
          <button type="button" className="admin-primary" disabled={!valid} onClick={() => nav(step('frame/result'))}>
            Итог →
          </button>
        </div>
      </section>

      <section className="frame2-sketch frame3-right" aria-label="Эскиз фасада">
        <div className="frame2-sketch-inner frame3-sketch">
          <div className="frame3-drawing" aria-label="Чертёж фасада">
            <div className="frame3-drawing-core">
              <div
                className={[
                  'sketch',
                  !noHandleOnSketch && hingePinCoords.length + handlePinCoords.length > 0 ? 'sketch--hinge-markers' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
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

                <div className="sketch-hinge-layer" aria-hidden={noHandleOnSketch || hingePinCoords.length === 0}>
                  {!noHandleOnSketch
                    ? hingePinCoords.map((p) => {
                    const style: CSSProperties =
                      p.variant === 'top'
                        ? { top: 0, left: `${p.pct}%`, transform: 'translateX(-50%)' }
                        : p.variant === 'bottom'
                          ? { bottom: 0, left: `${p.pct}%`, transform: 'translateX(-50%)' }
                          : p.variant === 'left'
                            ? { left: 0, top: `${p.pct}%`, transform: 'translateY(-50%)' }
                            : { right: 0, top: `${p.pct}%`, transform: 'translateY(-50%)' }
                    return (
                      <div key={`h-${p.i}`} className={`sketch-hinge-pin sketch-hinge-pin--${p.variant}`} style={style}>
                        <div className="sketch-hinge-pin-stack">
                          <span className="sketch-hinge-pin-body" aria-hidden />
                          <span className="sketch-hinge-pin-label">№{p.i + 1}</span>
                        </div>
                      </div>
                    )
                  })
                    : null}
                </div>

                <div className="sketch-handle-layer" aria-hidden={noHandleOnSketch || handlePinCoords.length === 0}>
                  {!noHandleOnSketch
                    ? handlePinCoords.map((p) => {
                    const style: CSSProperties =
                      p.variant === 'top'
                        ? { top: 0, left: `${p.pct}%`, transform: 'translateX(-50%)' }
                        : p.variant === 'bottom'
                          ? { bottom: 0, left: `${p.pct}%`, transform: 'translateX(-50%)' }
                          : p.variant === 'left'
                            ? { left: 0, top: `${p.pct}%`, transform: 'translateY(-50%)' }
                            : { right: 0, top: `${p.pct}%`, transform: 'translateY(-50%)' }
                    return (
                      <div
                        key={`ha-${p.i}`}
                        className={`sketch-handle-pin sketch-handle-pin--${p.variant}${p.i === 0 ? ' sketch-handle-pin--first' : ''}`}
                        style={style}
                      >
                        <div className="sketch-handle-pin-stack">
                          <span className="sketch-handle-pin-body" aria-hidden />
                          <span className="sketch-handle-pin-label">№{p.i + 1}</span>
                        </div>
                      </div>
                    )
                  })
                    : null}
                </div>
              </div>

              {!noHandleOnSketch && (hingeChainDimsLayout.length > 0 || handleChainDimsLayout.length > 0) ? (
                <div className="frame3-hinge-dim-layer" aria-hidden>
                  {hingeLayout
                    ? hingeChainDimsLayout.map((seg) => {
                    const vLabel = formatDimMm(seg.valueMm)
                    const hingeDimSide = hingeLayout.side
                    if (hingeDimSide === 'left' || hingeDimSide === 'right') {
                      const spanPct = seg.t1 - seg.t0
                      const narrow = spanPct < HINGE_DIM_NARROW_SPAN_PCT
                      const labelStyle = verticalChainLabelStyle(hingeDimSide, seg.nudgeX, seg.nudgeY)
                      const outer: CSSProperties =
                        hingeDimSide === 'left'
                          ? {
                              left: 0,
                              top: `${seg.t0}%`,
                              height: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                              width: '3.1rem',
                              transform: 'translateX(calc(-100% - var(--hinge-chain-sketch-gap, 30px)))',
                            }
                          : {
                              right: 0,
                              top: `${seg.t0}%`,
                              height: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                              width: '3.1rem',
                              transform: 'translateX(calc(100% + var(--hinge-chain-sketch-gap, 30px)))',
                            }
                      return (
                        <div
                          key={seg.key}
                          className={[
                            'hinge-chain-dim hinge-chain-dim--v',
                            `hinge-chain-dim--${hingeDimSide}`,
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
                    const hLabelStyle = horizontalChainLabelStyle(seg.nudgeX, seg.nudgeY)
                    const outer: CSSProperties =
                      hingeDimSide === 'top'
                        ? {
                            top: 0,
                            left: `${seg.t0}%`,
                            width: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                            height: '2.35rem',
                            transform: 'translateY(calc(-100% - var(--hinge-chain-sketch-gap, 30px)))',
                          }
                        : {
                            bottom: 0,
                            left: `${seg.t0}%`,
                            width: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                            height: '2.35rem',
                            transform: 'translateY(calc(100% + var(--hinge-chain-sketch-gap, 30px)))',
                          }
                    return (
                      <div key={seg.key} className={`hinge-chain-dim hinge-chain-dim--h hinge-chain-dim--${hingeDimSide}`} style={outer}>
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
                  })
                    : null}
                  {handleChainDimsLayout.map((seg) => {
                    const vLabel = formatDimMm(seg.valueMm)
                    if (handleSide === 'left' || handleSide === 'right') {
                      const spanPct = seg.t1 - seg.t0
                      const narrow = spanPct < HANDLE_DIM_NARROW_SPAN_PCT
                      const labelStyle = verticalChainLabelStyle(handleSide, seg.nudgeX, seg.nudgeY)
                      const outer: CSSProperties =
                        handleSide === 'left'
                          ? {
                              left: 0,
                              top: `${seg.t0}%`,
                              height: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                              width: '3.1rem',
                              transform: 'translateX(calc(-100% - var(--hinge-chain-sketch-gap, 30px)))',
                            }
                          : {
                              right: 0,
                              top: `${seg.t0}%`,
                              height: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                              width: '3.1rem',
                              transform: 'translateX(calc(100% + var(--hinge-chain-sketch-gap, 30px)))',
                            }
                      return (
                        <div
                          key={seg.key}
                          className={['hinge-chain-dim hinge-chain-dim--v', `hinge-chain-dim--${handleSide}`, narrow ? 'hinge-chain-dim--narrow' : '']
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
                    const hLabelStyle = horizontalChainLabelStyle(seg.nudgeX, seg.nudgeY)
                    const outer: CSSProperties =
                      handleSide === 'top'
                        ? {
                            top: 0,
                            left: `${seg.t0}%`,
                            width: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                            height: '2.35rem',
                            transform: 'translateY(calc(-100% - var(--hinge-chain-sketch-gap, 30px)))',
                          }
                        : {
                            bottom: 0,
                            left: `${seg.t0}%`,
                            width: `${Math.max(seg.t1 - seg.t0, 0.8)}%`,
                            height: '2.35rem',
                            transform: 'translateY(calc(100% + var(--hinge-chain-sketch-gap, 30px)))',
                          }
                    return (
                      <div key={seg.key} className={`hinge-chain-dim hinge-chain-dim--h hinge-chain-dim--${handleSide}`} style={outer}>
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

            <div className={`frame3-dim-drawing frame3-dim-drawing--${mainDimPlacement.widthPos}`}>
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

            <div className={`frame3-dim-drawing frame3-dim-drawing--${mainDimPlacement.heightPos}`}>
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

      <HydrateMaterials
        onTypes={setFrameTypeName}
        onColor={setFrameColorMaterial}
        fillMatId={parsed.fillMatId}
        onFilling={setFillingMaterial}
      />
    </div>
  )
}

function HydrateMaterials({
  onTypes,
  onColor,
  fillMatId,
  onFilling,
}: {
  onTypes: (name: string) => void
  onColor: (m: Material | null) => void
  fillMatId: number | null
  onFilling: (m: Material | null) => void
}) {
  useEffect(() => {
    let cancel = false
    ;(async () => {
      const tid = localStorage.getItem('calc_frame_type_id')
      const cid = localStorage.getItem('calc_frame_color_id')
      if (cid) {
        try {
          const m = await fetchMaterial(Number(cid))
          if (!cancel) onColor(m)
        } catch {
          if (!cancel) onColor(null)
        }
      }
      if (tid) {
        try {
          const r = await fetchCalculatorProfileTypes()
          const t = (r.results ?? []).find((x) => x.id === Number(tid))
          if (!cancel && t) onTypes(t.name)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [onTypes, onColor])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!fillMatId) {
        onFilling(null)
        return
      }
      try {
        const m = await fetchMaterial(fillMatId)
        if (!cancel) onFilling(m)
      } catch {
        if (!cancel) onFilling(null)
      }
    })()
    return () => {
      cancel = true
    }
  }, [fillMatId, onFilling])

  return null
}

export default Step7FrameHandleHoles
