import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { fetchCalculationFormulas, fetchMaterial, fetchMaterialClasses } from '../api'
import { BASE_CURRENCY } from '../currencies'
import type { CalculationFormula, Material } from '../types'
import {
  collectCurrencies,
  computeFramePriceBreakdown,
  resolveMaterialPricingUomCode,
  unitsPerFacade,
} from './framePriceEstimate'
import { formatNumberForUi } from '../floatInput'
import {
  FRAME_DEFAULT_HEIGHT_MM,
  FRAME_DEFAULT_WIDTH_MM,
  hingesPerFacadeForPrice,
  parseFramePriceSessionFromConfigKey,
  readCalculatorPriceConfigKey,
  shouldBillProductionHinges,
  subscribeFrameCalcSession,
} from './frameCalcSession'
import { materialTextureLabel, sketchFillingLine } from './materialTextureLabel'
import { useFillingTypeName } from './useFillingTypeName'
import { CalcPriceBreakdownView } from './CalcPriceBreakdownView'
import { matchFormulaTotalForFrame } from './calculationFormula'

function asPositiveInt(s: string | null, fallback: number): number {
  if (s == null || s === '') return fallback
  const n = Math.floor(Number(String(s).replace(',', '.')))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function asPositiveMm(s: string | null, fallback: number): number {
  if (s == null || s === '') return fallback
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function formatSum(n: number): string {
  return formatNumberForUi(n, 3)
}

function uomLabel(m: Material | null): string {
  return m?.uom?.short_name || m?.uom?.name || '—'
}

function uomDebug(m: Material | null): string {
  const code = (m?.uom?.code ?? '').trim() || '—'
  const short = (m?.uom?.short_name ?? '').trim() || '—'
  return `code=${code}, short=${short}`
}

function uomPricingLabel(m: Material | null): string {
  const code = resolveMaterialPricingUomCode(m)
  if (code === 'm2') return 'кв.м'
  if (code === 'm') {
    if (m?.pricing_calc_mode === 'linear') return 'м.п.'
    const raw = (m?.uom?.code ?? '').trim().toLowerCase()
    return raw === 'mp' ? 'м.п.' : 'м'
  }
  if (code === 'pc') return 'шт'
  return m?.uom?.short_name || m?.uom?.name || 'шт'
}

function CalcPriceTotalsActive({
  placement = 'aside',
  includeFillingInPrice = true,
  includeHingesInPrice = true,
}: {
  placement?: CalcPriceTotalsPlacement
  /** На шаге 3 наполнение ещё не выбирают — не подтягивать id из localStorage. */
  includeFillingInPrice?: boolean
  /** Петли производства — с шага 5 (количество с шага 6). */
  includeHingesInPrice?: boolean
}) {
  const cfgKey = useSyncExternalStore(
    subscribeFrameCalcSession,
    readCalculatorPriceConfigKey,
    () => ''
  )

  const fillingTypeName = useFillingTypeName(cfgKey)

  const parsed = useMemo(() => {
    const session = parseFramePriceSessionFromConfigKey(cfgKey)
    const parts = cfgKey.split('|')
    const h = asPositiveMm(parts[1] ?? null, FRAME_DEFAULT_HEIGHT_MM)
    const w = asPositiveMm(parts[2] ?? null, FRAME_DEFAULT_WIDTH_MM)
    const qty = asPositiveInt(parts[3] ?? null, 1)
    return {
      colorId: session.colorId,
      heightMm: h,
      widthMm: w,
      facadeCount: qty,
      fillMatId: session.fillMatId,
      mortiseMode: session.mortiseMode,
      hingeSource: session.hingeSource,
      hingeMatId: session.hingeMatId,
      billHinges:
        includeHingesInPrice &&
        shouldBillProductionHinges(session),
      hingesPerFacade: hingesPerFacadeForPrice(),
    }
  }, [cfgKey, includeHingesInPrice])

  const [colorMaterial, setColorMaterial] = useState<Material | null>(null)
  const [fillingMaterial, setFillingMaterial] = useState<Material | null>(null)
  const [hingeMaterial, setHingeMaterial] = useState<Material | null>(null)
  const [formulas, setFormulas] = useState<CalculationFormula[]>([])
  const [classCodesById, setClassCodesById] = useState<Map<number, string>>(() => new Map())
  const [loading, setLoading] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    fetchMaterialClasses()
      .then((r) => {
        if (cancel) return
        const m = new Map<number, string>()
        for (const c of r.results ?? []) m.set(c.id, c.code)
        setClassCodesById(m)
      })
      .catch(() => {
        if (!cancel) setClassCodesById(new Map())
      })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    let cancel = false
    fetchCalculationFormulas({ active: true })
      .then((r) => {
        if (!cancel) setFormulas(r.results ?? [])
      })
      .catch(() => {
        if (!cancel) setFormulas([])
      })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    let cancel = false
    setFetchErr(null)
    const run = async () => {
      setLoading(true)
      try {
        if (parsed.colorId) {
          const m = await fetchMaterial(parsed.colorId)
          if (!cancel) setColorMaterial(m)
        } else {
          setColorMaterial(null)
        }
        const fillId = includeFillingInPrice ? parsed.fillMatId : null
        if (fillId) {
          const m = await fetchMaterial(fillId)
          if (!cancel) setFillingMaterial(m)
        } else {
          setFillingMaterial(null)
        }
        const hingeId = parsed.billHinges ? parsed.hingeMatId : null
        if (hingeId) {
          const m = await fetchMaterial(hingeId)
          if (!cancel) setHingeMaterial(m)
        } else {
          setHingeMaterial(null)
        }
      } catch (e) {
        if (!cancel) {
          setFetchErr(e instanceof Error ? e.message : String(e))
          setColorMaterial(null)
          setFillingMaterial(null)
          setHingeMaterial(null)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [parsed.colorId, parsed.fillMatId, parsed.billHinges, parsed.hingeMatId, includeFillingInPrice])

  const hingesPerFacade = parsed.billHinges ? parsed.hingesPerFacade : null

  const priceState = useMemo(() => {
    const base = computeFramePriceBreakdown(
      colorMaterial,
      fillingMaterial,
      parsed.heightMm,
      parsed.widthMm,
      parsed.facadeCount,
      hingeMaterial,
      hingesPerFacade,
    )
    const matched = matchFormulaTotalForFrame(
      formulas,
      colorMaterial,
      fillingMaterial,
      parsed.heightMm,
      parsed.widthMm,
      parsed.facadeCount,
      classCodesById,
      hingeMaterial,
      hingesPerFacade,
    )
    const breakdown = matched
      ? {
          ...base,
          total: matched.total,
          formulaName: matched.formula.name,
          formulaExpression: matched.formula.expression,
        }
      : base
    return {
      base,
      breakdown,
      formulaMatch: matched
        ? {
            formulaName: matched.formula.name,
            formulaExpression: matched.formula.expression,
            evaluation: matched.evaluation,
            formula: matched.formula,
          }
        : null,
    }
  }, [
    formulas,
    classCodesById,
    colorMaterial,
    fillingMaterial,
    hingeMaterial,
    hingesPerFacade,
    parsed.heightMm,
    parsed.widthMm,
    parsed.facadeCount,
  ])

  const breakdown = priceState.breakdown

  const currencies = useMemo(
    () => collectCurrencies(colorMaterial, fillingMaterial, hingeMaterial),
    [colorMaterial, fillingMaterial, hingeMaterial]
  )

  const currency =
    colorMaterial?.base_currency ||
    fillingMaterial?.base_currency ||
    hingeMaterial?.base_currency ||
    (currencies.length === 1 ? currencies[0] : BASE_CURRENCY)

  const currencyMismatch = currencies.length > 1
  const showTotals = Boolean(parsed.colorId) && colorMaterial != null && !fetchErr
  const idleHint = !parsed.colorId ? 'Выберите цвет профиля на шаге 2 — здесь появится расчёт.' : null
  const fillingPendingHint =
    showTotals && !includeFillingInPrice
      ? 'Наполнение и формула по его классам появятся после выбора на шаге 4.'
      : null

  const dimsInfo = useMemo(() => {
    const areaPerFacade = unitsPerFacade(parsed.heightMm, parsed.widthMm, 'm2')
    const perimPerFacade = unitsPerFacade(parsed.heightMm, parsed.widthMm, 'm')
    return { areaPerFacade, perimPerFacade }
  }, [parsed.heightMm, parsed.widthMm])

  return (
    <CalcPriceTotalsShell placement={placement}>
      <div className="calc-totals-card">
        <h3 className="calc-totals-title">Расчёт</h3>
        {fetchErr && <p className="calc-totals-err">{fetchErr}</p>}
        {idleHint && !fetchErr && <p className="calc-totals-muted">{idleHint}</p>}
        {loading && parsed.colorId && <p className="calc-totals-muted">Расчёт…</p>}
        {showTotals && !loading && (
          <>
            {currencyMismatch && (
              <p className="calc-totals-warn">
                В конфигурации разные валюты — сумма ориентировочная; уточняйте у менеджера.
              </p>
            )}
            {fillingPendingHint && <p className="calc-totals-muted">{fillingPendingHint}</p>}
            <CalcPriceBreakdownView
              currency={currency}
              base={priceState.base}
              formulaMatch={priceState.formulaMatch}
              colorMaterial={colorMaterial}
              fillingMaterial={fillingMaterial}
              hingeMaterial={hingeMaterial}
              hingesPerFacade={hingesPerFacade}
              heightMm={parsed.heightMm}
              widthMm={parsed.widthMm}
              facadeCount={parsed.facadeCount}
            />
            <div className="calc-totals-grand">
              <span className="calc-totals-grand-label">Итого</span>
              <span className="calc-totals-grand-value">
                {formatSum(breakdown.total)} {currency}
              </span>
            </div>
            <p className="calc-totals-note">
              Габариты {parsed.heightMm}×{parsed.widthMm} мм, фасадов {parsed.facadeCount} шт. На 1 фасад:
              площадь {dimsInfo.areaPerFacade.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} м², периметр{' '}
              {dimsInfo.perimPerFacade.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} м.п.
              <br />
              Профиль (цвет): ед.&nbsp;изм. «{uomLabel(colorMaterial)}» (в расчёте как {uomPricingLabel(colorMaterial)}
              ).{' '}
              {fillingMaterial && (
                <>
                  Наполнение: ед.&nbsp;изм. «{uomLabel(fillingMaterial)}» (в расчёте как {uomPricingLabel(fillingMaterial)}
                  ).
                </>
              )}
              <br />
              Визуал профиля: {materialTextureLabel(colorMaterial)}.
              {fillingMaterial ? (
                <>
                  {' '}
                  Наполнение: {sketchFillingLine(fillingTypeName, fillingMaterial)}.
                </>
              ) : null}{' '}
              Материал профиля #{colorMaterial?.id ?? '—'} ({uomDebug(colorMaterial)}).
            </p>
          </>
        )}
      </div>
    </CalcPriceTotalsShell>
  )
}

type CalcPriceTotalsPlacement = 'aside' | 'inline'

function CalcPriceTotalsShell({
  placement,
  children,
}: {
  placement: CalcPriceTotalsPlacement
  children: ReactNode
}) {
  if (placement === 'inline') {
    return <div className="calc-totals-inline">{children}</div>
  }
  return (
    <aside className="calc-totals-aside" aria-label="Итого по калькулятору">
      {children}
    </aside>
  )
}

type Props = {
  /** Не показывать расчёт на ранних шагах (например, шаг 1 и 2). */
  hideTotals: boolean
  /** Полностью скрыть колонку (например, шаг «Итог» со своей таблицей цен). */
  blankAside?: boolean
  placement?: CalcPriceTotalsPlacement
  /** Учитывать материал наполнения из localStorage (false на шаге 3). */
  includeFillingInPrice?: boolean
  /** Учитывать петли производства (false до шага 5). */
  includeHingesInPrice?: boolean
}

export function CalcPriceTotals({
  hideTotals,
  blankAside,
  placement = 'aside',
  includeFillingInPrice = true,
  includeHingesInPrice = true,
}: Props) {
  if (blankAside) return null
  if (hideTotals) {
    return (
      <CalcPriceTotalsShell placement={placement}>
        <div className="calc-totals-card">
          <h3 className="calc-totals-title">Расчёт</h3>
          <p className="calc-totals-muted">
            Ориентировочная сумма появится на шаге 3 после выбора габаритов фасада (высота, ширина, количество).
          </p>
        </div>
      </CalcPriceTotalsShell>
    )
  }
  return (
    <CalcPriceTotalsActive
      placement={placement}
      includeFillingInPrice={includeFillingInPrice}
      includeHingesInPrice={includeHingesInPrice}
    />
  )
}

type CalcPriceTotalsSlotValue = {
  hideTotals: boolean
  blankAside: boolean
  includeFillingInPrice: boolean
  includeHingesInPrice: boolean
}

const CalcPriceTotalsSlotContext = createContext<CalcPriceTotalsSlotValue | null>(null)

export function CalcPriceTotalsSlotProvider({
  hideTotals,
  blankAside,
  includeFillingInPrice,
  includeHingesInPrice,
  children,
}: CalcPriceTotalsSlotValue & { children: ReactNode }) {
  return (
    <CalcPriceTotalsSlotContext.Provider
      value={{ hideTotals, blankAside, includeFillingInPrice, includeHingesInPrice }}
    >
      {children}
    </CalcPriceTotalsSlotContext.Provider>
  )
}

/** Встроенный блок «Расчёт» внутри `.calc-side-panel-scroll` шага. */
export function CalcStepPriceTotals() {
  const slot = useContext(CalcPriceTotalsSlotContext)
  if (!slot || slot.blankAside) return null
  return (
    <CalcPriceTotals
      hideTotals={slot.hideTotals}
      placement="inline"
      includeFillingInPrice={slot.includeFillingInPrice}
      includeHingesInPrice={slot.includeHingesInPrice}
    />
  )
}
