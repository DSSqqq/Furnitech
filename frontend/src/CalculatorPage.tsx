import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { fetchCalculatorProfiles } from './api'
import { isFrameStep2Ready, subscribeFrameCalcSession } from './calculator/frameCalcSession'
import { Step2FrameFacade } from './calculator/Step2FrameFacade'
import { Step2MdfFacade } from './calculator/Step2MdfFacade'
import { Step2PvcFacade } from './calculator/Step2PvcFacade'
import { Step3FrameSizes } from './calculator/Step3FrameSizes'
import './CalculatorPage.css'

type FacadeType = 'frame' | 'mdf' | 'pvc'

const FACADE_LABEL: Record<FacadeType, string> = {
  frame: 'Рамочный фасад',
  mdf: 'МДФ фасад',
  pvc: 'ПВХ фасад',
}

export function CalculatorPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const [profilesCount, setProfilesCount] = useState<number | null>(null)

  const facade = useMemo<FacadeType | null>(() => {
    const p = loc.pathname.toLowerCase()
    if (p.includes('/calculator/frame')) return 'frame'
    if (p.includes('/calculator/mdf')) return 'mdf'
    if (p.includes('/calculator/pvc')) return 'pvc'
    return null
  }, [loc.pathname])

  const pathNorm = (loc.pathname.replace(/\/$/, '') || '/calculator').toLowerCase()
  const isStep1 = pathNorm === '/calculator'
  const isStep3FrameSizes = pathNorm === '/calculator/frame/size'
  const isStep2 = Boolean(facade) && !isStep1 && !isStep3FrameSizes

  const frameStep2Ready = useSyncExternalStore(subscribeFrameCalcSession, isFrameStep2Ready, isFrameStep2Ready)
  const canOpenFrameStep3 = facade === 'frame' && frameStep2Ready

  // facadeLabel зарезервирован под будущие подписи/хлебные крошки

  useEffect(() => {
    fetchCalculatorProfiles()
      .then((r) => setProfilesCount(r.results?.length ?? 0))
      .catch(() => setProfilesCount(null))
  }, [])

  return (
    <div className="calc">
      <div className="calc-head">
        <div className="admin-heading-row">
          <h2 className="admin-h2">Калькулятор</h2>
        </div>
        {profilesCount != null && (
          <p className="admin-muted" style={{ margin: '0.25rem 0 0' }}>
            Доступно профилей: {profilesCount}
          </p>
        )}

        <div className="calc-steps-tabs" role="tablist" aria-label="Шаги калькулятора">
          <NavLink
            to="/calculator"
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
              if (facade) nav(`/calculator/${facade}`)
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
              if (canOpenFrameStep3) nav('/calculator/frame/size')
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
        </div>
      </div>

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
                          onChange={() => nav(`/calculator/${k}`)}
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
        <Route path="*" element={<Navigate to="/calculator" replace />} />
      </Routes>
    </div>
  )
}

export default CalculatorPage
