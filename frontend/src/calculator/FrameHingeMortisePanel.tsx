import { useEffect, useState } from 'react'
import { useCalcPaths } from './calcPathsContext'
import {
  CALC_LS_FRAME_MORTISE,
  CALC_LS_HINGE_MATERIAL_ID,
  CALC_LS_HINGE_SOURCE,
  CALC_LS_HINGE_TYPE_ID,
  notifyFrameCalcSession,
  writeHingeLayout,
} from './frameCalcSession'
import { FrameHingeCatalog } from './FrameHingeCatalog'

export function FrameHingeMortisePanel() {
  const { readOnly } = useCalcPaths()
  const [mortise, setMortise] = useState<'none' | 'hinge'>('none')
  const [hingeSource, setHingeSource] = useState<'customer' | 'production' | ''>('')

  useEffect(() => {
    try {
      const m = localStorage.getItem(CALC_LS_FRAME_MORTISE)
      setMortise(m === 'hinge' ? 'hinge' : 'none')
      const s = localStorage.getItem(CALC_LS_HINGE_SOURCE) || ''
      if (s === 'customer' || s === 'production') setHingeSource(s)
      else setHingeSource('')
    } catch {
      /* ignore */
    }
  }, [])

  const persistMortise = (next: 'none' | 'hinge') => {
    try {
      if (next === 'none') {
        localStorage.removeItem(CALC_LS_FRAME_MORTISE)
        localStorage.removeItem(CALC_LS_HINGE_SOURCE)
        localStorage.removeItem(CALC_LS_HINGE_TYPE_ID)
        localStorage.removeItem(CALC_LS_HINGE_MATERIAL_ID)
        writeHingeLayout(null)
        setHingeSource('')
      } else {
        localStorage.setItem(CALC_LS_FRAME_MORTISE, 'hinge')
      }
    } catch {
      /* ignore */
    }
    setMortise(next)
    notifyFrameCalcSession()
  }

  const persistSource = (next: 'customer' | 'production' | '') => {
    try {
      if (next === '') {
        localStorage.removeItem(CALC_LS_HINGE_SOURCE)
        localStorage.removeItem(CALC_LS_HINGE_TYPE_ID)
        localStorage.removeItem(CALC_LS_HINGE_MATERIAL_ID)
      } else {
        localStorage.setItem(CALC_LS_HINGE_SOURCE, next)
        if (next === 'customer') {
          localStorage.removeItem(CALC_LS_HINGE_TYPE_ID)
          localStorage.removeItem(CALC_LS_HINGE_MATERIAL_ID)
        }
      }
    } catch {
      /* ignore */
    }
    setHingeSource(next)
    notifyFrameCalcSession()
  }

  return (
    <div className="frame-mortise-panel" style={{ marginBottom: '1.1rem' }}>
      <h4 className="frame2-h4">Присадка</h4>
      <label className="admin-muted" style={{ display: 'block', marginBottom: '0.35rem' }} htmlFor="calc-mortise-select">
        Вид работ
      </label>
      <select
        id="calc-mortise-select"
        className="admin-input"
        value={mortise}
        onChange={(e) => {
          const v = e.target.value === 'hinge' ? 'hinge' : 'none'
          persistMortise(v)
        }}
      >
        <option value="none">Не требуется</option>
        <option value="hinge">Присадки под петли</option>
      </select>

      {mortise === 'hinge' && (
        <div style={{ marginTop: '0.85rem' }}>
          <label className="admin-muted" style={{ display: 'block', marginBottom: '0.35rem' }} htmlFor="calc-hinge-source">
            Петли
          </label>
          <select
            id="calc-hinge-source"
            className="admin-input"
            value={hingeSource}
            onChange={(e) => {
              const v = e.target.value
              persistSource(v === 'customer' || v === 'production' ? v : '')
            }}
          >
            <option value="">Выберите вариант</option>
            <option value="production">Петли производства</option>
            <option value="customer">Петли заказчика</option>
          </select>

          {hingeSource === 'customer' && (
            <p className="admin-muted" style={{ marginTop: '0.75rem' }}>
              Необходимо уточнить детали и стоимость у сотрудника.
            </p>
          )}

          {hingeSource === 'production' && (
            <div className="frame-hinge-catalog-wrap">
              <FrameHingeCatalog readOnly={readOnly} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
