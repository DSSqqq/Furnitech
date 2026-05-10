import { useEffect, useState } from 'react'
import { FtSelect, type FtSelectOption } from '../FtSelect'
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
import './Step3FrameSizes.css'
import './FrameHingeMortisePanel.css'

const MORTISE_OPTIONS: FtSelectOption[] = [
  { value: 'none', label: 'Не требуется' },
  { value: 'hinge', label: 'Присадки под петли' },
]

const HINGE_SOURCE_OPTIONS: FtSelectOption[] = [
  { value: '', label: 'Выберите вариант' },
  { value: 'production', label: 'Петли производства' },
  { value: 'customer', label: 'Петли заказчика' },
]

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
    <div className="frame-mortise-panel">
      <div className="admin-heading-row calc-card-title-row">
        <div className="frame3-title" role="heading" aria-level={3}>
          Присадки
        </div>
      </div>
      <div className="frame-mortise-field">
        <div className="frame-mortise-label">Вид работ</div>
        <FtSelect
          id="calc-mortise-select"
          value={mortise}
          onChange={(v) => persistMortise(v === 'hinge' ? 'hinge' : 'none')}
          options={MORTISE_OPTIONS}
          aria-label="Вид работ: присадка"
          menuStrategy="inline"
        />
      </div>

      {mortise === 'hinge' && (
        <div className="frame-mortise-field frame-mortise-field--hinge">
          <div className="frame-mortise-label">Петли</div>
          <FtSelect
            id="calc-hinge-source"
            value={hingeSource}
            onChange={(v) => persistSource(v === 'customer' || v === 'production' ? v : '')}
            options={HINGE_SOURCE_OPTIONS}
            aria-label="Петли: производство или заказчик"
            menuStrategy="inline"
          />

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
