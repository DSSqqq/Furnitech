import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCalculatorProfileTypes, fetchMaterial } from '../api'
import type { Material } from '../types'
import { useCalcPaths } from './calcPathsContext'
import {
  isFrameStep2Ready,
  isFrameStep4Ready,
  readCalculatorPriceConfigKey,
  subscribeFrameCalcSession,
} from './frameCalcSession'
import { materialTextureLayerStyle } from './sketchFrame'
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

function blendScale(defaultScale: number, targetScale: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultScale + (targetScale - defaultScale) * k
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

  const parsed = useMemo(() => {
    const parts = cfgKey.split('|')
    const colorIdRaw = parts[0]?.trim() ?? ''
    const colorId = colorIdRaw ? Number(colorIdRaw) : null
    const h = parts[1] || '—'
    const w = parts[2] || '—'
    const fillIdRaw = parts[4]?.trim() ?? ''
    const fillMatId = fillIdRaw ? Number(fillIdRaw) : null
    return {
      colorId: colorId && Number.isFinite(colorId) && colorId > 0 ? colorId : null,
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
    const target = parsed.heightN / 2000
    const softened = blendScale(1, target, 0.22)
    return clamp(softened, 0.9, 1.1)
  }, [parsed.heightN])

  const [frameTypeName, setFrameTypeName] = useState('—')
  const [frameColorMaterial, setFrameColorMaterial] = useState<Material | null>(null)
  const [fillingMaterial, setFillingMaterial] = useState<Material | null>(null)

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

  return (
    <div className="frame2">
      <section className="frame2-card calc-side-panel">
        <div className="admin-heading-row calc-card-title-row">
          <h3 className="calc-h3">Итоговый эскиз</h3>
        </div>
        <p className="admin-muted frame2-lead">
          Пока без левого меню: на этом шаге показываем эскиз и используем панель «Расчёт» справа.
        </p>
        <div className="frame2-card-nav">
          <button type="button" className="admin-secondary" onClick={() => nav(step('frame/filling'))}>
            ← Предыдущий шаг
          </button>
          <button type="button" className="admin-primary" disabled title="Следующий шаг пока не реализован">
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
                    <div className="sketch-val">{frameColorMaterial?.name || '—'}</div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Наполнение</div>
                    <div className="sketch-val">{fillingMaterial?.name || '—'}</div>
                  </div>
                  <div className="sketch-row">
                    <div className="sketch-key">Размеры</div>
                    <div className="sketch-val">
                      {parsed.height}×{parsed.width} мм
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

