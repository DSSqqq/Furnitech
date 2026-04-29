import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { fetchMaterial } from '../api'
import { BASE_CURRENCY } from '../currencies'
import type { Material } from '../types'
import {
  collectCurrencies,
  computeFramePriceBreakdown,
  resolvePricingUomCode,
  unitsPerFacade,
} from './framePriceEstimate'
import { formatNumberForUi } from '../floatInput'
import {
  readCalculatorPriceConfigKey,
  subscribeFrameCalcSession,
} from './frameCalcSession'

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
  const code = resolvePricingUomCode(m?.uom)
  if (code === 'm2') return 'кв.м'
  if (code === 'm') {
    const raw = (m?.uom?.code ?? '').trim().toLowerCase()
    return raw === 'mp' ? 'м.п.' : 'м'
  }
  if (code === 'pc') return 'шт'
  return m?.uom?.short_name || m?.uom?.name || 'шт'
}

function CalcPriceTotalsActive() {
  const cfgKey = useSyncExternalStore(
    subscribeFrameCalcSession,
    readCalculatorPriceConfigKey,
    () => ''
  )

  const parsed = useMemo(() => {
    const parts = cfgKey.split('|')
    const colorIdRaw = parts[0]?.trim() ?? ''
    const colorId = colorIdRaw ? Number(colorIdRaw) : null
    const h = asPositiveMm(parts[1] ?? null, 2000)
    const w = asPositiveMm(parts[2] ?? null, 500)
    const qty = asPositiveInt(parts[3] ?? null, 1)
    const fillIdRaw = parts[4]?.trim() ?? ''
    const fillMatId = fillIdRaw ? Number(fillIdRaw) : null
    return {
      colorId: colorId && Number.isFinite(colorId) && colorId > 0 ? colorId : null,
      heightMm: h,
      widthMm: w,
      facadeCount: qty,
      fillMatId: fillMatId && Number.isFinite(fillMatId) && fillMatId > 0 ? fillMatId : null,
    }
  }, [cfgKey])

  const [colorMaterial, setColorMaterial] = useState<Material | null>(null)
  const [fillingMaterial, setFillingMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

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
        if (parsed.fillMatId) {
          const m = await fetchMaterial(parsed.fillMatId)
          if (!cancel) setFillingMaterial(m)
        } else {
          setFillingMaterial(null)
        }
      } catch (e) {
        if (!cancel) {
          setFetchErr(e instanceof Error ? e.message : String(e))
          setColorMaterial(null)
          setFillingMaterial(null)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [parsed.colorId, parsed.fillMatId])

  const breakdown = useMemo(
    () =>
      computeFramePriceBreakdown(
        colorMaterial,
        fillingMaterial,
        parsed.heightMm,
        parsed.widthMm,
        parsed.facadeCount
      ),
    [colorMaterial, fillingMaterial, parsed.heightMm, parsed.widthMm, parsed.facadeCount]
  )

  const currencies = useMemo(
    () => collectCurrencies(colorMaterial, fillingMaterial),
    [colorMaterial, fillingMaterial]
  )

  const currency =
    colorMaterial?.base_currency ||
    fillingMaterial?.base_currency ||
    (currencies.length === 1 ? currencies[0] : BASE_CURRENCY)

  const currencyMismatch = currencies.length > 1
  const showTotals = Boolean(parsed.colorId) && colorMaterial != null && !fetchErr
  const idleHint = !parsed.colorId ? 'Выберите цвет профиля на шаге 2 — здесь появится расчёт.' : null

  const dimsInfo = useMemo(() => {
    const areaPerFacade = unitsPerFacade(parsed.heightMm, parsed.widthMm, 'm2')
    const perimPerFacade = unitsPerFacade(parsed.heightMm, parsed.widthMm, 'm')
    return { areaPerFacade, perimPerFacade }
  }, [parsed.heightMm, parsed.widthMm])

  return (
    <aside className="calc-totals-aside" aria-label="Итого по калькулятору">
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
            <dl className="calc-totals-lines">
              <div className="calc-totals-line">
                <dt>Профиль (цвет)</dt>
                <dd>
                  {formatSum(breakdown.profile)} {currency}
                </dd>
              </div>
              {breakdown.related > 0 && (
                <div className="calc-totals-line">
                  <dt>Сопутствующие</dt>
                  <dd>
                    {formatSum(breakdown.related)} {currency}
                  </dd>
                </div>
              )}
              {breakdown.operations > 0 && (
                <div className="calc-totals-line">
                  <dt>Операции</dt>
                  <dd>
                    {formatSum(breakdown.operations)} {currency}
                  </dd>
                </div>
              )}
              {breakdown.filling > 0 && (
                <div className="calc-totals-line">
                  <dt>Наполнение</dt>
                  <dd>
                    {formatSum(breakdown.filling)} {currency}
                  </dd>
                </div>
              )}
            </dl>
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
              Материал профиля #{colorMaterial?.id ?? '—'} ({uomDebug(colorMaterial)}).
            </p>
          </>
        )}
      </div>
    </aside>
  )
}

type Props = {
  /** Не показывать расчёт на ранних шагах (например, шаг 1 и 2). */
  hideTotals: boolean
}

export function CalcPriceTotals({ hideTotals }: Props) {
  if (hideTotals) {
    return (
      <aside className="calc-totals-aside" aria-label="Итого по калькулятору">
        <div className="calc-totals-card">
          <h3 className="calc-totals-title">Расчёт</h3>
          <p className="calc-totals-muted">
            Ориентировочная сумма появится на шаге 3 после выбора габаритов фасада (высота, ширина, количество).
          </p>
        </div>
      </aside>
    )
  }
  return <CalcPriceTotalsActive />
}
