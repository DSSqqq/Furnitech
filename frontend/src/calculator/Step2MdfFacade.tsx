import { CalcStepPriceTotals } from './CalcPriceTotals'

export function Step2MdfFacade() {
  return (
    <div className="calc-side-panel">
      <div className="admin-heading-row calc-card-title-row">
        <h3 className="calc-h3">Шаг 2 — МДФ фасад</h3>
      </div>
      <div className="calc-side-panel-scroll">
        <div className="calc-note">Дальнейшие шаги для «МДФ фасад» пока не реализованы.</div>
        <CalcStepPriceTotals />
      </div>
    </div>
  )
}

export default Step2MdfFacade
