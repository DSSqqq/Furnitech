import type { CalculationFormula } from '../types'
import type { FormulaEvaluationResult } from './calculationFormula'
import { formatNumberForUi } from '../floatInput'
import type { FramePriceBreakdown } from './framePriceEstimate'
import type { MaterialLineBreakdown } from './priceBreakdown'
import { hingeSubtotalOutsideFormula } from './calculationFormula'
import { collectFrameMaterialLines } from './priceBreakdown'
import type { Material } from '../types'

function formatSum(n: number): string {
  return formatNumberForUi(n, 3)
}

function formatQty(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 4 })
}

function formatMaterialLineDetail(line: MaterialLineBreakdown, currency: string): string {
  const parts: string[] = []
  if (line.source === 'related' && line.lineQuantity !== 1) {
    parts.push(`${formatQty(line.lineQuantity)}×`)
  }
  if (line.source === 'hinge' && line.geomPerFacade > 0 && line.uomCode === 'pc') {
    parts.push(`${formatQty(line.geomPerFacade)} ${line.uomLabel}/фас × ${line.facadeCount} фас`)
  } else if (line.excessCoefficient !== 1 && line.quantityRaw > 0) {
    parts.push(
      `${formatQty(line.geomPerFacade)} ${line.uomLabel}/фас × ${line.facadeCount} фас × запас ${formatQty(line.excessCoefficient)}`,
    )
  } else if (line.quantityScale === 'per_facade') {
    parts.push(`${line.facadeCount} фас`)
  } else if (line.source !== 'hinge' && line.geomPerFacade > 0 && line.facadeCount > 1) {
    parts.push(`${formatQty(line.geomPerFacade)} ${line.uomLabel}/фас × ${line.facadeCount} фас`)
  } else if (line.source !== 'hinge' && line.geomPerFacade > 0) {
    parts.push(`${formatQty(line.geomPerFacade)} ${line.uomLabel}/фас`)
  }
  if (line.quantityBeforeRounding != null) {
    parts.push(
      `${formatQty(line.quantityWithExcess)} ${line.uomLabel} → ${formatQty(line.quantityBilled)} ${line.uomLabel} (округление)`,
    )
  } else {
    parts.push(`${formatQty(line.quantityBilled)} ${line.uomLabel}`)
  }
  parts.push(`× ${formatSum(line.unitPrice)} ${currency}`)
  return parts.join(' · ')
}

function MaterialLineRow({ line, currency }: { line: MaterialLineBreakdown; currency: string }) {
  return (
    <li className="calc-price-line">
      <span className="calc-price-line-name">{line.name}</span>
      <span className="calc-price-line-detail">{formatMaterialLineDetail(line, currency)}</span>
      <span className="calc-price-line-sum">
        {formatSum(line.subtotal)} {currency}
      </span>
    </li>
  )
}

export type CalcPriceBreakdownViewProps = {
  currency: string
  base: FramePriceBreakdown
  formulaMatch?: {
    formulaName: string
    formulaExpression?: string
    evaluation: FormulaEvaluationResult
    formula?: CalculationFormula
  } | null
  colorMaterial: Material | null
  fillingMaterial: Material | null
  hingeMaterial?: Material | null
  hingesPerFacade?: number | null
  heightMm: number
  widthMm: number
  facadeCount: number
}

function HingeLinesSection({
  lines,
  hingesTotal,
  currency,
}: {
  lines: MaterialLineBreakdown[]
  hingesTotal: number
  currency: string
}) {
  if (lines.length === 0) return null
  return (
    <section className="calc-price-class-block">
      <div className="calc-price-class-head">
        <span className="calc-price-class-code">Петли производства</span>
        <span className="calc-price-class-sum">
          {formatSum(hingesTotal)} {currency}
        </span>
      </div>
      <ul className="calc-price-lines">
        {lines.map((line) => (
          <MaterialLineRow
            key={`h-${line.materialId}-${line.source}-${line.name}`}
            line={line}
            currency={currency}
          />
        ))}
      </ul>
    </section>
  )
}

export function CalcPriceBreakdownView({
  currency,
  base,
  formulaMatch,
  colorMaterial,
  fillingMaterial,
  hingeMaterial,
  hingesPerFacade,
  heightMm,
  widthMm,
  facadeCount,
}: CalcPriceBreakdownViewProps) {
  const allLines = collectFrameMaterialLines(
    colorMaterial,
    fillingMaterial,
    heightMm,
    widthMm,
    facadeCount,
    hingeMaterial,
    hingesPerFacade,
  )
  const hingeLines = allLines.filter(
    (l) => l.source === 'hinge' || (l.source === 'related' && l.parentSource === 'hinge'),
  )

  if (formulaMatch) {
    const { evaluation, formulaName, formulaExpression, formula } = formulaMatch
    const expr = formulaExpression || evaluation.expression
    const hingeExtraTotal = formula
      ? hingeSubtotalOutsideFormula(evaluation.materialLines, formula)
      : 0

    return (
      <div className="calc-price-breakdown">
        <p className="calc-price-breakdown-formula-head">
          Формула: <strong>{formulaName}</strong>
          {expr ? <span className="calc-price-breakdown-expr"> ({expr})</span> : null}
        </p>
        {evaluation.classSteps.map((step) => (
          <section key={step.classId} className="calc-price-class-block">
            <div className="calc-price-class-head">
              <span className="calc-price-class-code">{step.classCode ?? `#${step.classId}`}</span>
              <span className="calc-price-class-sum">
                {formatSum(step.subtotal)} {currency}
              </span>
            </div>
            {step.lines.length > 0 ? (
              <ul className="calc-price-lines">
                {step.lines.map((line) => (
                  <MaterialLineRow key={`${line.materialId}-${line.source}-${line.name}`} line={line} currency={currency} />
                ))}
              </ul>
            ) : (
              <p className="calc-totals-muted">Нет материалов с этим классом в конфигурации.</p>
            )}
          </section>
        ))}
        {hingeExtraTotal > 0 && (
          <HingeLinesSection lines={hingeLines} hingesTotal={hingeExtraTotal} currency={currency} />
        )}
      </div>
    )
  }

  const lines = allLines
  const profileLines = lines.filter((l) => l.source === 'profile')
  const relatedLines = lines.filter((l) => l.source === 'related' && l.parentSource === 'profile')
  const fillingLines = lines.filter((l) => l.source === 'filling' || (l.source === 'related' && l.parentSource === 'filling'))

  return (
    <div className="calc-price-breakdown">
      {profileLines.length > 0 && (
        <section className="calc-price-class-block">
          <div className="calc-price-class-head">
            <span className="calc-price-class-code">Профиль (цвет)</span>
            <span className="calc-price-class-sum">
              {formatSum(base.profile)} {currency}
            </span>
          </div>
          <ul className="calc-price-lines">
            {profileLines.map((line) => (
              <MaterialLineRow key={`p-${line.materialId}`} line={line} currency={currency} />
            ))}
          </ul>
        </section>
      )}
      {relatedLines.length > 0 && (
        <section className="calc-price-class-block">
          <div className="calc-price-class-head">
            <span className="calc-price-class-code">Сопутствующие материалы (профиль)</span>
            <span className="calc-price-class-sum">
              {formatSum(base.related)} {currency}
            </span>
          </div>
          <ul className="calc-price-lines">
            {relatedLines.map((line) => (
              <MaterialLineRow key={`r-${line.materialId}-${line.name}`} line={line} currency={currency} />
            ))}
          </ul>
        </section>
      )}
      {fillingLines.length > 0 && (
        <section className="calc-price-class-block">
          <div className="calc-price-class-head">
            <span className="calc-price-class-code">Наполнение</span>
            <span className="calc-price-class-sum">
              {formatSum(base.filling)} {currency}
            </span>
          </div>
          <ul className="calc-price-lines">
            {fillingLines.map((line) => (
              <MaterialLineRow
                key={`f-${line.materialId}-${line.source}`}
                line={line}
                currency={currency}
              />
            ))}
          </ul>
        </section>
      )}
      {base.hinges > 0 && (
        <HingeLinesSection lines={hingeLines} hingesTotal={base.hinges} currency={currency} />
      )}
    </div>
  )
}
