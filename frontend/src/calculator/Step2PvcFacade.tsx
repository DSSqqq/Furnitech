import { HintButton } from '../HintButton'
import { CalcStepPriceTotals } from './CalcPriceTotals'

export function Step2PvcFacade() {
  return (
    <div className="calc-side-panel">
      <div className="admin-heading-row calc-card-title-row">
        <h3 className="calc-h3">Шаг 2 — ПВХ фасад</h3>
        <HintButton text="Шаги для ПВХ фасада будем разрабатывать отдельно (пока заглушка)." />
      </div>
      <div className="calc-side-panel-scroll">
        <div className="calc-note">Дальнейшие шаги для «ПВХ фасад» пока не реализованы.</div>
        <CalcStepPriceTotals />
      </div>
    </div>
  )
}

export default Step2PvcFacade
