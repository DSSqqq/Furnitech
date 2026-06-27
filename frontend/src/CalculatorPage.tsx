import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  CalcPathsProvider,
  facadeFromNormalized,
  normalizedCalcPath,
  useCalcPaths,
} from './calculator/calcPathsContext'
import {
  clearFrameCalculatorStorage,
  isFrameMortiseHingeSelected,
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
import { Step6FrameHingeLayout } from './calculator/Step6FrameHingeLayout'
import { Step7FrameHandleHoles } from './calculator/Step7FrameHandleHoles'
import { Step8FrameResult } from './calculator/Step8FrameResult'
import { CalcPriceTotalsSlotProvider, CalcStepPriceTotals } from './calculator/CalcPriceTotals'
import { AdminPanelLoadingOverlay, adminPanelBodyClass } from './AdminPanelLoadingOverlay'
import './calculator/Step3FrameSizes.css'
import './calculator/CalculatorPanelShell.css'
import './CalculatorPage.css'

type FacadeType = 'frame' | 'mdf' | 'pvc'

const FACADE_LABEL: Record<FacadeType, string> = {
  frame: 'Рамочный фасад',
  mdf: 'МДФ фасад',
  pvc: 'ПВХ фасад',
}

const CALC_ROUTE_TRANSITION_MS = 280
/** Индекс вкладки «Шаг 6» в `.calc-steps-tabs` (0 = «Шаг 1»). */
const CALC_STEP_6_TAB_INDEX = 5

function syncCalcStepsTabsWidth(calcEl: HTMLElement, tabsEl: HTMLElement) {
  const tabEls = tabsEl.querySelectorAll<HTMLElement>('.calc-step-tab')
  if (tabEls.length === 0) {
    calcEl.style.removeProperty('--calc-steps-tabs-width')
    calcEl.style.removeProperty('--calc-steps-panel-width')
    return
  }
  const tabsBox = tabsEl.getBoundingClientRect()
  const lastTab = tabEls[tabEls.length - 1]
  const lastBox = lastTab.getBoundingClientRect()
  const width = Math.ceil(lastBox.right - tabsBox.left)
  const step6Tab = tabEls[CALC_STEP_6_TAB_INDEX] ?? lastTab
  const step6Box = step6Tab.getBoundingClientRect()
  const panelWidth = Math.ceil(step6Box.right - tabsBox.left)
  if (width > 0) {
    calcEl.style.setProperty('--calc-steps-tabs-width', `${width}px`)
  }
  if (panelWidth > 0) {
    calcEl.style.setProperty('--calc-steps-panel-width', `${panelWidth}px`)
  }
}

function CalcRouteFallback() {
  const { home } = useCalcPaths()
  return <Navigate to={home} replace />
}

function CalculatorPageInner() {
  const nav = useNavigate()
  const loc = useLocation()
  const { base, home, step } = useCalcPaths()
  const [routeBusy, setRouteBusy] = useState(false)
  const [step1Facade, setStep1Facade] = useState<FacadeType | null>(null)
  const routeMountRef = useRef(true)
  const calcRootRef = useRef<HTMLDivElement>(null)
  const stepsTabsRef = useRef<HTMLDivElement>(null)

  const normalized = useMemo(() => normalizedCalcPath(loc.pathname, base), [loc.pathname, base])
  const facade = useMemo(() => facadeFromNormalized(normalized), [normalized])

  const isStep1 = normalized === '/' || normalized === ''
  const isStep3FrameSizes = normalized === '/frame/size'
  const isStep4FrameFilling = normalized === '/frame/filling'
  const isStep5FrameSummary = normalized === '/frame/summary'
  const isStep6FrameHingeLayout = normalized === '/frame/hinge-layout'
  const isStep7FrameHandleHoles = normalized === '/frame/handle-holes'
  const isStep8FrameResult = normalized === '/frame/result'
  const isStep2 =
    Boolean(facade) &&
    !isStep1 &&
    !isStep3FrameSizes &&
    !isStep4FrameFilling &&
    !isStep5FrameSummary &&
    !isStep6FrameHingeLayout &&
    !isStep7FrameHandleHoles &&
    !isStep8FrameResult

  const frameStep2Ready = useSyncExternalStore(subscribeFrameCalcSession, isFrameStep2Ready, isFrameStep2Ready)
  const frameStep4Ready = useSyncExternalStore(subscribeFrameCalcSession, isFrameStep4Ready, isFrameStep4Ready)
  const frameMortiseHinge = useSyncExternalStore(
    subscribeFrameCalcSession,
    isFrameMortiseHingeSelected,
    isFrameMortiseHingeSelected,
  )
  const canOpenFrameStep3 = facade === 'frame' && frameStep2Ready
  const canOpenFrameStep4 = facade === 'frame' && frameStep2Ready
  const canOpenFrameStep5 = facade === 'frame' && frameStep4Ready
  const canOpenFrameStep6 = facade === 'frame' && frameStep4Ready && frameMortiseHinge
  const canOpenFrameStep7 = facade === 'frame' && frameStep4Ready
  const canOpenFrameStep8 = facade === 'frame' && frameStep4Ready

  useEffect(() => {
    if (routeMountRef.current) {
      routeMountRef.current = false
      return
    }
    setRouteBusy(true)
    const id = window.setTimeout(() => setRouteBusy(false), CALC_ROUTE_TRANSITION_MS)
    return () => window.clearTimeout(id)
  }, [loc.pathname])

  useEffect(() => {
    if (isStep1) setStep1Facade(null)
  }, [isStep1, loc.pathname])

  useEffect(() => {
    const calcEl = calcRootRef.current
    const tabsEl = stepsTabsRef.current
    if (!calcEl || !tabsEl) return

    const sync = () => syncCalcStepsTabsWidth(calcEl, tabsEl)

    sync()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    ro?.observe(tabsEl)
    window.addEventListener('resize', sync)
    void document.fonts?.ready.then(sync)

    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', sync)
      calcEl.style.removeProperty('--calc-steps-tabs-width')
      calcEl.style.removeProperty('--calc-steps-panel-width')
    }
  }, [loc.pathname])

  return (
    <CalcPriceTotalsSlotProvider
      hideTotals={isStep1 || isStep2}
      blankAside={isStep8FrameResult}
      includeFillingInPrice={!isStep3FrameSizes}
      includeHingesInPrice={
        isStep5FrameSummary ||
        isStep6FrameHingeLayout ||
        isStep7FrameHandleHoles ||
        isStep8FrameResult
      }
    >
    <div className="calc" ref={calcRootRef}>
      <div className="calc-head">
        <div className="calc-head-bar">
          <div
            className="calc-steps-tabs"
            ref={stepsTabsRef}
            role="tablist"
            aria-label="Шаги калькулятора"
          >
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
          <button
            type="button"
            role="tab"
            className={isStep6FrameHingeLayout ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab'}
            aria-selected={isStep6FrameHingeLayout}
            disabled={!canOpenFrameStep6}
            onClick={() => {
              if (canOpenFrameStep6) nav(step('frame/hinge-layout'))
            }}
            title={
              !facade
                ? 'Сначала выберите фасад'
                : facade !== 'frame'
                  ? 'Шаг 6 только для рамочного фасада'
                  : !frameStep2Ready
                    ? 'Сначала на шаге 2 выберите тип профиля и цвет'
                    : !frameStep4Ready
                      ? 'Сначала на шаге 4 выберите наполнение'
                      : !frameMortiseHinge
                        ? 'Шаг 6 только при присадке под петли (шаг 5)'
                        : undefined
            }
          >
            Шаг 6
          </button>
          <button
            type="button"
            role="tab"
            className={isStep7FrameHandleHoles ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab'}
            aria-selected={isStep7FrameHandleHoles}
            disabled={!canOpenFrameStep7}
            onClick={() => {
              if (canOpenFrameStep7) nav(step('frame/handle-holes'))
            }}
            title={
              !facade
                ? 'Сначала выберите фасад'
                : facade !== 'frame'
                  ? 'Шаг 7 только для рамочного фасада'
                  : !frameStep2Ready
                    ? 'Сначала на шаге 2 выберите тип профиля и цвет'
                    : !frameStep4Ready
                      ? 'Сначала на шаге 4 выберите наполнение'
                      : undefined
            }
          >
            Шаг 7
          </button>
          <button
            type="button"
            role="tab"
            className={isStep8FrameResult ? 'calc-step-tab calc-step-tab--active' : 'calc-step-tab'}
            aria-selected={isStep8FrameResult}
            disabled={!canOpenFrameStep8}
            onClick={() => {
              if (canOpenFrameStep8) nav(step('frame/result'))
            }}
            title={
              !facade
                ? 'Сначала выберите фасад'
                : facade !== 'frame'
                  ? 'Итог только для рамочного фасада'
                  : !frameStep2Ready
                    ? 'Сначала на шаге 2 выберите тип профиля и цвет'
                    : !frameStep4Ready
                      ? 'Сначала на шаге 4 выберите наполнение'
                      : undefined
            }
          >
            Итог
          </button>
        </div>
        </div>
      </div>

      <div className="calc-body-with-totals calc-body-with-totals--wide">
        <div className="calc-main-column">
          <div
            className={adminPanelBodyClass(routeBusy, isStep8FrameResult ? 'calc-routes-wrap calc-routes-wrap--step8' : 'calc-routes-wrap')}
          >
            <div className="calc-routes-inner">
              <div key={loc.pathname} className="calc-routes-step">
                {(() => {
                  const n = normalized
                  if (n === '/' || n === '') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-1" role="tabpanel">
                          <div className="frame2-card calc-side-panel">
                            <div className="admin-heading-row calc-card-title-row">
                              <div className="frame3-title" role="heading" aria-level={3}>
                                Выберите тип фасада
                              </div>
                            </div>
                            <div className="calc-side-panel-scroll">
                            <div className="calc-facade-grid" role="radiogroup" aria-label="Выбор фасада">
                              {(['frame', 'mdf', 'pvc'] as const).map((k) => (
                                <label
                                  key={k}
                                  className={
                                    step1Facade === k ? 'calc-facade calc-facade--active' : 'calc-facade'
                                  }
                                >
                                  <input
                                    className="calc-facade-radio"
                                    type="radio"
                                    name="facade"
                                    value={k}
                                    checked={step1Facade === k}
                                    onChange={() => setStep1Facade(k)}
                                  />
                                  <span className="calc-facade-title">{FACADE_LABEL[k]}</span>
                                </label>
                              ))}
                            </div>
                            <CalcStepPriceTotals />
                            </div>
                            <div className="frame2-card-nav frame2-card-nav--step1">
                              <button
                                type="button"
                                className="admin-primary"
                                disabled={!step1Facade}
                                title={!step1Facade ? 'Сначала выберите тип фасада' : undefined}
                                onClick={() => {
                                  if (!step1Facade) return
                                  clearFrameCalculatorStorage()
                                  notifyFrameCalcSession()
                                  nav(step(step1Facade))
                                }}
                              >
                                Следующий шаг →
                              </button>
                            </div>
                          </div>
                      </div>
                    )
                  }
                  if (n === '/frame/size') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-3" role="tabpanel">
                          <Step3FrameSizes />
                      </div>
                    )
                  }
                  if (n === '/frame/filling') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-4" role="tabpanel">
                          <Step4FrameFilling />
                      </div>
                    )
                  }
                  if (n === '/frame/summary') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-5" role="tabpanel">
                          <Step5FrameSummary />
                      </div>
                    )
                  }
                  if (n === '/frame/hinge-layout') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-6" role="tabpanel">
                          <Step6FrameHingeLayout />
                      </div>
                    )
                  }
                  if (n === '/frame/handle-holes') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-7" role="tabpanel">
                          <Step7FrameHandleHoles />
                      </div>
                    )
                  }
                  if (n === '/frame/result') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-8" role="tabpanel">
                          <Step8FrameResult />
                      </div>
                    )
                  }
                  if (n === '/frame') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-2" role="tabpanel">
                          <Step2FrameFacade />
                      </div>
                    )
                  }
                  if (n === '/mdf') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-2" role="tabpanel">
                          <Step2MdfFacade />
                      </div>
                    )
                  }
                  if (n === '/pvc') {
                    return (
                      <div className="calc-grid" id="calc-step-panel-2" role="tabpanel">
                          <Step2PvcFacade />
                      </div>
                    )
                  }
                  return <CalcRouteFallback />
                })()}
              </div>
            </div>
            <AdminPanelLoadingOverlay active={routeBusy} ariaLabel="Переключение шага" />
          </div>
        </div>
      </div>
    </div>
    </CalcPriceTotalsSlotProvider>
  )
}

export type CalculatorPageProps = {
  /** `public` — главная для гостей, только выбор; `admin` — полный режим в админке */
  variant?: 'admin' | 'public'
}

export function CalculatorPage({ variant = 'admin' }: CalculatorPageProps) {
  const calcBase = variant === 'public' ? '' : '/calculator'
  const readOnly = variant === 'public'
  const inner = (
    <CalcPathsProvider base={calcBase} readOnly={readOnly}>
      <CalculatorPageInner />
    </CalcPathsProvider>
  )
  if (variant === 'public') {
    return (
      <div className="calc-panel-shell" id="public-panel-calculator">
        <div className="admin-orders-placeholder">{inner}</div>
      </div>
    )
  }
  return inner
}

export default CalculatorPage
