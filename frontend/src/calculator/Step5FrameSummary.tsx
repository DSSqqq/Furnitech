import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCalculatorHingeTypes, fetchCalculatorProfileTypes, fetchMaterial } from '../api'
import type { Material } from '../types'
import { useCalcPaths } from './calcPathsContext'
import { CalcStepPriceTotals } from './CalcPriceTotals'
import {
  isFrameStep2Ready,
  isFrameStep4Ready,
  readCalculatorPriceConfigKey,
  subscribeFrameCalcSession,
} from './frameCalcSession'
import { FrameHingeMortisePanel } from './FrameHingeMortisePanel'
import { materialTextureLabel, sketchFillingLine, textureLabelDisplayWrap } from './materialTextureLabel'
import { materialTextureLayerStyle, facadeSketchScaleY } from './sketchFrame'
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

function fillingPaperStyle(m: Material | null | undefined): CSSProperties {
  if (!m) return {}
  const c = (m.texture_color ?? '').trim()
  if (c) return { backgroundColor: c }
  return {}
}

export function Step5FrameSummary() {
  const nav = useNavigate()
  const { step } = useCalcPaths()

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    if (!isFrameStep4Ready()) nav(step('frame/filling'), { replace: true })
  }, [nav, step])

  const cfgKey = useSyncExternalStore(subscribeFrameCalcSession, readCalculatorPriceConfigKey, () => '')
  const fillingTypeName = useFillingTypeName(cfgKey)

  const parsed = useMemo(() => {
    const parts = cfgKey.split('|')
    const colorIdRaw = parts[0]?.trim() ?? ''
    const colorId = colorIdRaw ? Number(colorIdRaw) : null
    const h = parts[1] || '—'
    const w = parts[2] || '—'
    const fillIdRaw = parts[4]?.trim() ?? ''
    const fillMatId = fillIdRaw ? Number(fillIdRaw) : null
    const mortiseRaw = parts[5]?.trim() ?? ''
    const mortiseMode = mortiseRaw === 'hinge' ? 'hinge' : 'none'
    const hingeSrcRaw = parts[6]?.trim() ?? ''
    const hingeSource =
      hingeSrcRaw === 'customer' || hingeSrcRaw === 'production' ? hingeSrcRaw : ('' as const)
    const htRaw = parts[7]?.trim() ?? ''
    const hmRaw = parts[8]?.trim() ?? ''
    const hingeTypeId = htRaw ? Number(htRaw) : null
    const hingeMatId = hmRaw ? Number(hmRaw) : null
    return {
      colorId: colorId && Number.isFinite(colorId) && colorId > 0 ? colorId : null,
      height: h,
      width: w,
      heightN: h === '—' ? null : asNum(h),
      widthN: w === '—' ? null : asNum(w),
      fillMatId: fillMatId && Number.isFinite(fillMatId) && fillMatId > 0 ? fillMatId : null,
      mortiseMode,
      hingeSource,
      hingeTypeId:
        hingeTypeId != null && Number.isFinite(hingeTypeId) && hingeTypeId > 0 ? hingeTypeId : null,
      hingeMatId:
        hingeMatId != null && Number.isFinite(hingeMatId) && hingeMatId > 0 ? hingeMatId : null,
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
  const [mortiseSketchLine, setMortiseSketchLine] = useState('—')

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

  useEffect(() => {
    if (parsed.mortiseMode !== 'hinge') {
      setMortiseSketchLine('Не требуется')
      return
    }
    if (parsed.hingeSource === 'customer') {
      setMortiseSketchLine('Петли заказчика (уточнить детали и стоимость у сотрудника)')
      return
    }
    if (parsed.hingeSource !== 'production') {
      setMortiseSketchLine('—')
      return
    }
    if (parsed.hingeTypeId == null || parsed.hingeMatId == null) {
      setMortiseSketchLine('Петли производства — выберите тип и модель')
      return
    }
    let cancel = false
    ;(async () => {
      try {
        const r = await fetchCalculatorHingeTypes()
        const t = (r.results ?? []).find((x) => x.id === parsed.hingeTypeId)
        const row = t?.materials?.find((c) => c.material_id === parsed.hingeMatId)
        const mat = row?.material
        const tex = mat ? materialTextureLabel(mat as Material) : ''
        if (!cancel) {
          setMortiseSketchLine(
            tex && tex !== '—'
              ? `${t?.name ?? '—'} — ${tex}`
              : 'Петли производства — выберите тип и модель'
          )
        }
      } catch {
        if (!cancel) setMortiseSketchLine('—')
      }
    })()
    return () => {
      cancel = true
    }
  }, [cfgKey, parsed.hingeMatId, parsed.hingeSource, parsed.hingeTypeId, parsed.mortiseMode])

  return (
    <div className="frame2">
      <section className="frame2-card calc-side-panel">
        <div className="calc-side-panel-scroll">
          <FrameHingeMortisePanel />
          <CalcStepPriceTotals />
        </div>
        <div className="frame2-card-nav">
          <button type="button" className="admin-secondary" onClick={() => nav(step('frame/filling'))}>
            ← Предыдущий шаг
          </button>
          <button
            type="button"
            className="admin-primary"
            onClick={() =>
              nav(step(parsed.mortiseMode === 'hinge' ? 'frame/hinge-layout' : 'frame/handle-holes'))
            }
          >
            Следующий шаг →
          </button>
        </div>
      </section>

      <section className="frame2-sketch" aria-label="Эскиз фасада">
        <div className="frame2-sketch-inner">
          <div className="frame3-drawing" aria-label="Чертёж фасада с размерами">
            <div
              className="sketch"
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
                <div className="sketch-paper-texture" style={materialTextureLayerStyle(fillingMaterial as any)} />
              </div>
              <div className="sketch-sheet">
                <div className="sketch-title">ЛИЦЕВАЯ СТОРОНА ФАСАДА</div>
                <div className="sketch-sub">Визуализация примерная</div>
                <div className="sketch-table">
                  <div className="sketch-row">
                    <div className="sketch-key">Тип профиля</div>
                    <div className="sketch-val">{frameTypeName}</div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Цвет</div>
                    <div className="sketch-val sketch-val--texture-wrap">
                      {textureLabelDisplayWrap(materialTextureLabel(frameColorMaterial))}
                    </div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Наполнение</div>
                    <div className="sketch-val sketch-val--texture-wrap">
                      {textureLabelDisplayWrap(sketchFillingLine(fillingTypeName, fillingMaterial))}
                    </div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Размеры</div>
                    <div className="sketch-val">
                      {parsed.height}×{parsed.width} мм
                    </div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Присадка</div>
                    <div className="sketch-val sketch-val--texture-wrap">
                      {textureLabelDisplayWrap(mortiseSketchLine)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Размеры в стиле чертежа (как на шаге 3/4) */}
            <div className="frame3-dim-drawing frame3-dim-drawing--top">
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

            <div className="frame3-dim-drawing frame3-dim-drawing--left">
              <div className="frame3-dim-drawing__left-col">
                <div className="frame3-dim-drawing__value frame3-dim-drawing__value--side">{parsed.heightN ?? '—'} мм</div>
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

export default Step5FrameSummary

