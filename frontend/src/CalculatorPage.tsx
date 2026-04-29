import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { fetchCalculatorProfiles } from './api'
import {
  CalcPathsProvider,
  facadeFromNormalized,
  normalizedCalcPath,
  useCalcPaths,
} from './calculator/calcPathsContext'
import {
  clearFrameCalculatorStorage,
  isFrameStep2Ready,
  isFrameStep4Ready,
  notifyFrameCalcSession,
  subscribeFrameCalcSession,
} from './calculator/frameCalcSession'
import { Step2FrameFacade } from './calculator/Step2FrameFacade'
import { Step2MdfFacade } from './calculator/Step2MdfFacade'
import { Step2PvcFacade } from './calculator/Step2PvcFacade'
import { Step3FrameSizes } from './calculator/Step3FrameSizes'
import { Step4FrameFilling } from './calculator/Step4FrameFilling'
import { Step5FrameSummary } from './calculator/Step5FrameSummary'
import { CalcPriceTotals } from './calculator/CalcPriceTotals'
import './CalculatorPage.css'

type FacadeType = 'frame' | 'mdf' | 'pvc'

const FACADE_LABEL: Record<FacadeType, string> = {
  frame: 'Рамочный фасад',
  mdf: 'МДФ фасад',
  pvc: 'ПВХ фасад',
}

const CALC_ROUTE_TRANSITION_MS = 280

function CalcRouteFallback() {
  const { home } = useCalcPaths()
  return <Navigate to={home} replace />
}

function CalculatorPageInner({ showProfilesCount }: { showProfilesCount: boolean }) {
  const nav = useNavigate()
  const loc = useLocation()
  const { base, home, readOnly, step } = useCalcPaths()
  const [profilesCount, setProfilesCount] = useState<number | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)
  const routeMountRef = useRef(true)

  const normalized = useMemo(() => normalizedCalcPath(loc.pathname, base), [loc.pathname, base])
  const facade = useMemo(() => facadeFromNormalized(normalized), [normalized])

  const isStep1 = normalized === '/' || normalized === ''
  const isStep3FrameSizes = normalized === '/frame/size'
  const isStep4FrameFilling = normalized === '/frame/filling'
  const isStep5FrameSummary = normalized === '/frame/summary'
  const isStep2 =
    Boolean(facade) && !isStep1 && !isStep3FrameSizes && !isStep4FrameFilling && !isStep5FrameSummary

  const frameStep2Ready = useSyncExternalStore(subscribeFrameCalcSession, isFrameStep2Ready, isFrameStep2Ready)
  const frameStep4Ready = useSyncExternalStore(subscribeFrameCalcSession, isFrameStep4Ready, isFrameStep4Ready)
  const canOpenFrameStep3 = facade === 'frame' && frameStep2Ready
  const canOpenFrameStep4 = facade === 'frame' && frameStep2Ready
  const canOpenFrameStep5 = facade === 'frame' && frameStep4Ready

  useEffect(() => {
    if (!showProfilesCount) return
    fetchCalculatorProfiles()
      .then((r) => setProfilesCount(r.results?.length ?? 0))
      .catch(() => setProfilesCount(null))
  }, [showProfilesCount])

  useEffect(() => {
    if (routeMountRef.current) {
      routeMountRef.current = false
      return
    }
    setRouteBusy(true)
    const id = window.setTimeout(() => setRouteBusy(false), CALC_ROUTE_TRANSITION_MS)
    return () => window.clearTimeout(id)
  }, [loc.pathname])

  return (
    <div className="calc">
      <div className="calc-head">
        <div className="admin-heading-row">
          <h2 className="admin-h2">{readOnly ? 'Подбор фасада' : 'Калькулятор'}</h2>
        </div>
        {showProfilesCount && profilesCount != null && (
          <p className="admin-muted" style={{ margin: '0.25rem 0 0' }}>
            Доступно профилей: {profilesCount}
          </p>
        )}

        <div className="calc-steps-tabs" role="tablist" aria-label="Шаги калькулятора">
          <NavLink
            to={home}
            end
            role="tab"
            className={({ isActive }) => (isActive ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab')}
            aria-selected={isStep1}
          >
            Шаг 1
          </NavLink>
          <button
            type="button"
            role="tab"
            className={isStep2 ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab'}
            aria-selected={isStep2}
            disabled={!facade}
            onClick={() => {
              if (facade) nav(step(facade))
            }}
            title={!facade ? 'Сначала выберите фасад' : undefined}
          >
            Шаг 2
          </button>
          <button
            type="button"
            role="tab"
            className={isStep3FrameSizes ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab'}
            aria-selected={isStep3FrameSizes}
            disabled={!canOpenFrameStep3}
            onClick={() => {
              if (canOpenFrameStep3) nav(step('frame/size'))
            }}
            title={
              !facade
                ? 'Сначала выберите фасад'
                : facade !== 'frame'
                  ? 'Шаг 3 только для рамочного фасада'
                  : !frameStep2Ready
                    ? 'Сначала на шаге 2 выберите тип профиля и цвет'
                    : undefined
            }
          >
            Шаг 3
          </button>
          <button
            type="button"
            role="tab"
            className={isStep4FrameFilling ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab'}
            aria-selected={isStep4FrameFilling}
            disabled={!canOpenFrameStep4}
            onClick={() => {
              if (canOpenFrameStep4) nav(step('frame/filling'))
            }}
            title={
              !facade
                ? 'Сначала выберите фасад'
                : facade !== 'frame'
                  ? 'Шаг 4 только для рамочного фасада'
                  : !frameStep2Ready
                    ? 'Сначала на шаге 2 выберите тип профиля и цвет'
                    : undefined
            }
          >
            Шаг 4
          </button>
          <button
            type="button"
            role="tab"
            className={isStep5FrameSummary ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab'}
            aria-selected={isStep5FrameSummary}
            disabled={!canOpenFrameStep5}
            onClick={() => {
              if (canOpenFrameStep5) nav(step('frame/summary'))
            }}
            title={
              !facade
                ? 'Сначала выберите фасад'
                : facade !== 'frame'
                  ? 'Шаг 5 только для рамочного фасада'
                  : !frameStep2Ready
                    ? 'Сначала на шаге 2 выберите тип профиля и цвет'
                    : !frameStep4Ready
                      ? 'Сначала на шаге 4 выберите наполнение'
                    : undefined
            }
          >
            Шаг 5
          </button>
        </div>
      </div>

      <div className="calc-body-with-totals">
        <div className="calc-main-column">
          <div className="calc-routes-wrap">
            <div className="calc-routes-inner">
              <div key={loc.pathname} className="calc-routes-step">
                <Routes>
                  <Route
                    index
                    element={
                      <div className="calc-grid" id="calc-step-panel-1" role="tabpanel">
                        <section className="calc-card">
                          <div className="admin-heading-row calc-card-title-row">
                            <h3 className="calc-h3">Выбор фасада</h3>
                          </div>
                          <div className="calc-side-panel">
                            <div className="calc-facade-grid" role="radiogroup" aria-label="Выбор фасада">
                              {(['frame', 'mdf', 'pvc'] as const).map((k) => (
                                <label key={k} className="calc-facade">
                                  <input
                                    className="calc-facade-radio"
                                    type="radio"
                                    name="facade"
                                    value={k}
                                    checked={false}
                                    onChange={() => {
                                  clearFrameCalculatorStorage()
                                  notifyFrameCalcSession()
                                  nav(step(k))
                                }}
                                  />
                                  <span className="calc-facade-title">{FACADE_LABEL[k]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </section>
                      </div>
                    }
                  />
                  <Route
                    path="frame/size"
                    element={
                      <div className="calc-grid" id="calc-step-panel-3" role="tabpanel">
                        <section className="calc-card">
                          <div className="admin-heading-row calc-card-title-row">
                            <h3 className="calc-h3">Рамочный фасад</h3>
                          </div>
                          <Step3FrameSizes />
                        </section>
                      </div>
                    }
                  />
                  <Route
                    path="frame/filling"
                    element={
                      <div className="calc-grid" id="calc-step-panel-4" role="tabpanel">
                        <section className="calc-card">
                          <div className="admin-heading-row calc-card-title-row">
                            <h3 className="calc-h3">Рамочный фасад — наполнение</h3>
                          </div>
                          <Step4FrameFilling />
                        </section>
                      </div>
                    }
                  />
                  <Route
                    path="frame/summary"
                    element={
                      <div className="calc-grid" id="calc-step-panel-5" role="tabpanel">
                        <section className="calc-card">
                          <div className="admin-heading-row calc-card-title-row">
                            <h3 className="calc-h3">Рамочный фасад — итог</h3>
                          </div>
                          <Step5FrameSummary />
                        </section>
                      </div>
                    }
                  />
                  <Route
                    path="frame"
                    element={
                      <div className="calc-grid" id="calc-step-panel-2" role="tabpanel">
                        <section className="calc-card">
                          <div className="admin-heading-row calc-card-title-row">
                            <h3 className="calc-h3">{FACADE_LABEL.frame}</h3>
                          </div>
                          <Step2FrameFacade />
                        </section>
                      </div>
                    }
                  />
                  <Route
                    path="mdf"
                    element={
                      <div className="calc-grid" id="calc-step-panel-2" role="tabpanel">
                        <section className="calc-card">
                          <div className="admin-heading-row calc-card-title-row">
                            <h3 className="calc-h3">{FACADE_LABEL.mdf}</h3>
                          </div>
                          <Step2MdfFacade />
                        </section>
                      </div>
                    }
                  />
                  <Route
                    path="pvc"
                    element={
                      <div className="calc-grid" id="calc-step-panel-2" role="tabpanel">
                        <section className="calc-card">
                          <div className="admin-heading-row calc-card-title-row">
                            <h3 className="calc-h3">{FACADE_LABEL.pvc}</h3>
                          </div>
                          <Step2PvcFacade />
                        </section>
                      </div>
                    }
                  />
                  <Route path="*" element={<CalcRouteFallback />} />
                </Routes>
              </div>
            </div>
            {routeBusy && (
              <div className="calc-route-shade" role="status" aria-live="polite" aria-label="Переключение шага">
                <span className="calc-route-shade__spinner" aria-hidden />
              </div>
            )}
          </div>
        </div>
        <CalcPriceTotals hideTotals={isStep1 || isStep2} />
      </div>
    </div>
  )
}

export type CalculatorPageProps = {
  /** `public` — главная для гостей, только выбор; `admin` — полный режим в админке */
  variant?: 'admin' | 'public'
}

export function CalculatorPage({ variant = 'admin' }: CalculatorPageProps) {
  const calcBase = variant === 'public' ? '' : '/calculator'
  const readOnly = variant === 'public'
  return (
    <CalcPathsProvider base={calcBase} readOnly={readOnly}>
      <CalculatorPageInner showProfilesCount={!readOnly} />
    </CalcPathsProvider>
  )
}

export default CalculatorPage
