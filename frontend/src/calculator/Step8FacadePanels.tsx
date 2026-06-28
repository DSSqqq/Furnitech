import type { Material } from '../types'
import { formatNumberForUi } from '../floatInput'
import { CalcPriceBreakdownView } from './CalcPriceBreakdownView'
import type { FrameFacadeSnapshot } from './frameSavedFacades'
import { materialTextureLabel, sketchFillingLine } from './materialTextureLabel'
import type { FramePriceBreakdown } from './framePriceEstimate'

function formatSum(n: number): string {
  return formatNumberForUi(n, 3)
}

export type Step8FacadePanelsProps = {
  index: number
  isCurrent?: boolean
  frameTypeName: string
  fillingTypeName: string
  colorMaterial: Material | null
  fillingMaterial: Material | null
  hingeMaterial: Material | null
  heightMm: number
  widthMm: number
  facadeCount: number
  mortiseLine: string
  hingeLayoutLine: string
  handleLine: string
  showHingeLayout: boolean
  currency: string
  currencyMismatch: boolean
  breakdown: FramePriceBreakdown
  base: FramePriceBreakdown
  formulaMatch?: FrameFacadeSnapshot['formulaMatch']
  hingesPerFacade: number | null
}

export function Step8FacadePanels({
  index: _index,
  isCurrent = false,
  frameTypeName,
  fillingTypeName,
  colorMaterial,
  fillingMaterial,
  hingeMaterial,
  heightMm,
  widthMm,
  facadeCount,
  mortiseLine,
  hingeLayoutLine,
  handleLine,
  showHingeLayout,
  currency,
  currencyMismatch,
  breakdown,
  base,
  formulaMatch,
  hingesPerFacade,
}: Step8FacadePanelsProps) {
  const suffix = isCurrent ? ' (текущий)' : ''

  return (
    <>
      <div className="step8-panel">
        <h4 className="step8-panel__title">Детализация заказа (фасады){suffix}</h4>
        <div className="step8-kv">
          <div className="step8-kv__row">
            <span className="step8-kv__k">Тип профиля</span>
            <span className="step8-kv__v">{frameTypeName}</span>
          </div>
          <div className="step8-kv__row">
            <span className="step8-kv__k">Цвет профиля</span>
            <span className="step8-kv__v">{materialTextureLabel(colorMaterial)}</span>
          </div>
          <div className="step8-kv__row">
            <span className="step8-kv__k">Габариты (В × Ш)</span>
            <span className="step8-kv__v">
              {heightMm} × {widthMm} мм
            </span>
          </div>
          <div className="step8-kv__row">
            <span className="step8-kv__k">Количество</span>
            <span className="step8-kv__v">{facadeCount} шт.</span>
          </div>
          <div className="step8-kv__row">
            <span className="step8-kv__k">Наполнение</span>
            <span className="step8-kv__v">{sketchFillingLine(fillingTypeName, fillingMaterial)}</span>
          </div>
          <div className="step8-kv__row">
            <span className="step8-kv__k">Присадка / петли</span>
            <span className="step8-kv__v">{mortiseLine}</span>
          </div>
          {showHingeLayout ? (
            <div className="step8-kv__row">
              <span className="step8-kv__k">Петли (сторона, число отверстий)</span>
              <span className="step8-kv__v">{hingeLayoutLine}</span>
            </div>
          ) : null}
          <div className="step8-kv__row">
            <span className="step8-kv__k">Ручка</span>
            <span className="step8-kv__v">{handleLine}</span>
          </div>
        </div>
      </div>

      <div className="step8-panel">
        <h4 className="step8-panel__title">Стоимость изготовления (фасады)*{suffix}</h4>
        {currencyMismatch ? (
          <p className="step8-panel__warn">В конфигурации разные валюты — сумма ориентировочная.</p>
        ) : null}
        <div className="step8-price-breakdown-wrap">
          <CalcPriceBreakdownView
            currency={currency}
            base={base}
            formulaMatch={
              formulaMatch
                ? {
                    formulaName: formulaMatch.formulaName,
                    formulaExpression: formulaMatch.formulaExpression,
                    evaluation: formulaMatch.evaluation,
                  }
                : null
            }
            colorMaterial={colorMaterial}
            fillingMaterial={fillingMaterial}
            hingeMaterial={hingeMaterial}
            hingesPerFacade={hingesPerFacade}
            heightMm={heightMm}
            widthMm={widthMm}
            facadeCount={facadeCount}
          />
        </div>
        <div className="step8-table-wrap step8-table-wrap--grand">
          <table className="step8-table">
            <tbody>
              <tr>
                <td className="step8-table__grand-label">Итого</td>
                <td className="step8-table__total">
                  {formatSum(breakdown.total)} {currency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="step8-panel__note">
          * Цена ориентировочная, без учёта доставки и монтажа. Уточняйте детали у менеджера.
        </p>
      </div>
    </>
  )
}

export function savedFacadeToPanelsProps(
  snapshot: FrameFacadeSnapshot,
  index: number,
): Step8FacadePanelsProps {
  return {
    index,
    frameTypeName: snapshot.frameTypeName,
    fillingTypeName: snapshot.fillingTypeName,
    colorMaterial: snapshot.colorMaterial,
    fillingMaterial: snapshot.fillingMaterial,
    hingeMaterial: snapshot.hingeMaterial,
    heightMm: snapshot.heightMm,
    widthMm: snapshot.widthMm,
    facadeCount: snapshot.facadeCount,
    mortiseLine: snapshot.mortiseLine,
    hingeLayoutLine: snapshot.hingeLayoutLine,
    handleLine: snapshot.handleLine,
    showHingeLayout: snapshot.includeHingeLayoutRow,
    currency: snapshot.currency,
    currencyMismatch: snapshot.currencyMismatch,
    breakdown: snapshot.breakdown,
    base: snapshot.breakdown,
    formulaMatch: snapshot.formulaMatch,
    hingesPerFacade: snapshot.hingesPerFacade,
  }
}
