import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCalculatorHingeTypes, fetchCalculatorProfileTypes, fetchMaterial } from '../api'
import { BASE_CURRENCY } from '../currencies'
import type { Material } from '../types'
import { formatNumberForUi } from '../floatInput'
import { useCalcPaths } from './calcPathsContext'
import { collectCurrencies, computeFramePriceBreakdown } from './framePriceEstimate'
import {
  type HingeMountSide,
  FRAME_DEFAULT_HEIGHT_MM,
  FRAME_DEFAULT_WIDTH_MM,
  isFrameStep2Ready,
  isFrameStep4Ready,
  readCalculatorPriceConfigKey,
  readHandleHoles,
  readHingeLayout,
  subscribeFrameCalcSession,
  clearFrameCalculatorStorage,
  notifyFrameCalcSession,
} from './frameCalcSession'
import './Step2FrameFacade.css'
import './Step8FrameResult.css'
import { buildFrameClientPdfBlob, preloadFramePdfFont } from './frameClientPdf'

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

function sideLabel(s: HingeMountSide): string {
  const m: Record<HingeMountSide, string> = {
    left: 'Слева',
    right: 'Справа',
    top: 'Сверху',
    bottom: 'Снизу',
  }
  return m[s] ?? s
}

export function Step8FrameResult() {
  const nav = useNavigate()
  const { step, home } = useCalcPaths()

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    if (!isFrameStep4Ready()) nav(step('frame/filling'), { replace: true })
  }, [nav, step])

  const cfgKey = useSyncExternalStore(subscribeFrameCalcSession, readCalculatorPriceConfigKey, () => '')

  const parsed = useMemo(() => {
    const parts = cfgKey.split('|')
    const colorIdRaw = parts[0]?.trim() ?? ''
    const colorId = colorIdRaw ? Number(colorIdRaw) : null
    const h = parts[1] ?? ''
    const w = parts[2] ?? ''
    const qty = asPositiveInt(parts[3] ?? null, 1)
    const fillIdRaw = parts[4]?.trim() ?? ''
    const fillMatId = fillIdRaw ? Number(fillIdRaw) : null
    const mortiseRaw = parts[5]?.trim() ?? ''
    const mortiseMode = mortiseRaw === 'hinge' ? 'hinge' : 'none'
    const hingeSrcRaw = parts[6]?.trim() ?? ''
    const hingeSource =
      hingeSrcRaw === 'customer' || hingeSrcRaw === 'production' ? hingeSrcRaw : ('' as const)
    const htRaw = parts[7]?.trim() ?? ''
    const hmRaw = parts[8]?.trim() ?? ''
    const hingeTypeId = htRaw ? Number(htRaw) : null
    const hingeMatId = hmRaw ? Number(hmRaw) : null
    return {
      colorId: colorId && Number.isFinite(colorId) && colorId > 0 ? colorId : null,
      heightMm: asPositiveMm(h, FRAME_DEFAULT_HEIGHT_MM),
      widthMm: asPositiveMm(w, FRAME_DEFAULT_WIDTH_MM),
      facadeCount: qty,
      fillMatId: fillMatId && Number.isFinite(fillMatId) && fillMatId > 0 ? fillMatId : null,
      mortiseMode,
      hingeSource,
      hingeTypeId:
        hingeTypeId != null && Number.isFinite(hingeTypeId) && hingeTypeId > 0 ? hingeTypeId : null,
      hingeMatId:
        hingeMatId != null && Number.isFinite(hingeMatId) && hingeMatId > 0 ? hingeMatId : null,
    }
  }, [cfgKey])

  const hingeLayout = useMemo(() => (parsed.mortiseMode === 'hinge' ? readHingeLayout() : null), [cfgKey, parsed.mortiseMode])
  const handleHoles = useMemo(() => readHandleHoles(), [cfgKey])

  const [frameTypeName, setFrameTypeName] = useState('—')
  const [colorMaterial, setColorMaterial] = useState<Material | null>(null)
  const [fillingMaterial, setFillingMaterial] = useState<Material | null>(null)
  const [mortiseLine, setMortiseLine] = useState('—')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactComment, setContactComment] = useState('')
  const [sendHint, setSendHint] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    void preloadFramePdfFont()
  }, [])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const tid = localStorage.getItem('calc_frame_type_id')
      const cid = localStorage.getItem('calc_frame_color_id')
      if (cid) {
        try {
          const m = await fetchMaterial(Number(cid))
          if (!cancel) setColorMaterial(m)
        } catch {
          if (!cancel) setColorMaterial(null)
        }
      } else if (!cancel) setColorMaterial(null)
      if (tid) {
        try {
          const r = await fetchCalculatorProfileTypes()
          const t = (r.results ?? []).find((x) => x.id === Number(tid))
          if (!cancel && t) setFrameTypeName(t.name)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [cfgKey])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!parsed.fillMatId) {
        setFillingMaterial(null)
        return
      }
      try {
        const m = await fetchMaterial(parsed.fillMatId)
        if (!cancel) setFillingMaterial(m)
      } catch {
        if (!cancel) setFillingMaterial(null)
      }
    })()
    return () => {
      cancel = true
    }
  }, [parsed.fillMatId])

  useEffect(() => {
    if (parsed.mortiseMode !== 'hinge') {
      setMortiseLine('Не требуется')
      return
    }
    if (parsed.hingeSource === 'customer') {
      setMortiseLine('Петли заказчика')
      return
    }
    if (parsed.hingeSource !== 'production') {
      setMortiseLine('—')
      return
    }
    if (parsed.hingeTypeId == null || parsed.hingeMatId == null) {
      setMortiseLine('Петли производства — не выбраны')
      return
    }
    let cancel = false
    ;(async () => {
      try {
        const r = await fetchCalculatorHingeTypes()
        const t = (r.results ?? []).find((x) => x.id === parsed.hingeTypeId)
        const row = t?.materials?.find((c) => c.material_id === parsed.hingeMatId)
        const name = row?.material?.name
        if (!cancel) {
          setMortiseLine(
            name ? `${t?.name ?? '—'} — ${name}` : 'Петли производства — не выбраны',
          )
        }
      } catch {
        if (!cancel) setMortiseLine('—')
      }
    })()
    return () => {
      cancel = true
    }
  }, [cfgKey, parsed.hingeMatId, parsed.hingeSource, parsed.hingeTypeId, parsed.mortiseMode])

  const breakdown = useMemo(
    () =>
      computeFramePriceBreakdown(
        colorMaterial,
        fillingMaterial,
        parsed.heightMm,
        parsed.widthMm,
        parsed.facadeCount,
      ),
    [colorMaterial, fillingMaterial, parsed.heightMm, parsed.widthMm, parsed.facadeCount],
  )

  const currencies = useMemo(
    () => collectCurrencies(colorMaterial, fillingMaterial),
    [colorMaterial, fillingMaterial],
  )

  const currency =
    colorMaterial?.base_currency ||
    fillingMaterial?.base_currency ||
    (currencies.length === 1 ? currencies[0] : BASE_CURRENCY)

  const currencyMismatch = currencies.length > 1

  const hingeLayoutLine = useMemo(() => {
    if (parsed.mortiseMode !== 'hinge') return '—'
    if (!hingeLayout) return '—'
    return `${sideLabel(hingeLayout.side)}, ${hingeLayout.count} отв.`
  }, [hingeLayout, parsed.mortiseMode])

  const handleLine = useMemo(() => {
    if (!handleHoles) return 'Не заданы (шаг пропущен)'
    const ori = handleHoles.orientation === 'vertical' ? 'вертикаль' : 'горизонталь'
    const bus = handleHoles.bushings ? ', втулки' : ''
    return `${ori}, ${sideLabel(handleHoles.side)}, ${handleHoles.count}×Ø${handleHoles.diameterMm} мм${bus}`
  }, [handleHoles])

  function buildPlainSummary(): string {
    const lines: string[] = [
      'Расчёт фасада (Furnitech)',
      `Профиль: ${frameTypeName}`,
      `Цвет: ${colorMaterial?.name ?? '—'}`,
      `Габариты: ${parsed.heightMm} × ${parsed.widthMm} мм, ${parsed.facadeCount} шт.`,
      `Наполнение: ${fillingMaterial?.name ?? '—'}`,
      `Присадка / петли: ${mortiseLine}`,
      ...(parsed.mortiseMode === 'hinge' ? [`Раскладка петель: ${hingeLayoutLine}`] : []),
      `Ручка: ${handleLine}`,
      '',
      `Итого: ${formatSum(breakdown.total)} ${currency}`,
    ]
    return lines.join('\n')
  }

  function onSubmitManager(e: FormEvent) {
    e.preventDefault()
    setSendHint(null)
    const subject = encodeURIComponent('Заявка по калькулятору фасада')
    const body = encodeURIComponent(
      [
        `Имя: ${contactName.trim() || '—'}`,
        `Телефон: ${contactPhone.trim() || '—'}`,
        `Email: ${contactEmail.trim() || '—'}`,
        '',
        contactComment.trim() || '—',
        '',
        '---',
        buildPlainSummary(),
      ].join('\n'),
    )
    const mail = contactEmail.trim()
    const href = mail.includes('@')
      ? `mailto:${mail}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`
    window.location.href = href
    setSendHint('Если почтовый клиент не открылся, скопируйте текст заявки вручную.')
  }

  function pdfInputPayload() {
    return {
      contact: {
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
        comment: contactComment,
      },
      frameTypeName,
      colorMaterial,
      fillingMaterial,
      heightMm: parsed.heightMm,
      widthMm: parsed.widthMm,
      facadeCount: parsed.facadeCount,
      mortiseLine,
      hingeLayoutLine,
      handleLine,
      breakdown: {
        profile: breakdown.profile,
        filling: breakdown.filling,
        related: breakdown.related,
        operations: breakdown.operations,
        total: breakdown.total,
      },
      currency,
      currencyMismatch,
      hingeLayout,
      includeHingeLayoutRow: parsed.mortiseMode === 'hinge',
      handleHoles,
    }
  }

  async function onOpenClientPdfInNewTab() {
    const preview = window.open('about:blank', '_blank')
    if (!preview) {
      window.alert(
        'Не удалось открыть новую вкладку. Разрешите всплывающие окна для этого сайта и попробуйте снова.',
      )
      return
    }
    try {
      preview.document.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Furnitech PDF</title></head><body style="margin:0;font-family:system-ui,sans-serif;padding:2rem;background:#1a1a1a;color:#e8e8e8">Формируем PDF…</body></html>',
      )
      preview.document.close()
    } catch {
      /* если доступ к document недоступен — остаётся пустая вкладка до загрузки blob */
    }

    setPdfBusy(true)
    try {
      const { blob } = await buildFrameClientPdfBlob(pdfInputPayload())
      const url = URL.createObjectURL(blob)
      preview.location.href = url
      window.setTimeout(() => URL.revokeObjectURL(url), 180_000)
    } catch (e) {
      console.error(e)
      preview.close()
      window.alert(
        'Не удалось сформировать PDF. Проверьте сеть (для кириллицы подгружается шрифт) и попробуйте снова.',
      )
    } finally {
      setPdfBusy(false)
    }
  }

  function onNewCalc() {
    clearFrameCalculatorStorage()
    notifyFrameCalcSession()
    nav(home, { replace: true })
  }

  return (
    <div className="frame2 step8-result">
      <section className="step8-result__contact frame2-card">
        <p className="frame3-step-kicker step8-result__kicker">Шаг 8</p>
        <h3 className="frame3-title step8-result__title">Итог</h3>
        <p className="frame3-sub">
          Проверьте детали и ориентировочную стоимость. Отправьте заявку менеджеру или сохраните расчёт для печати.
        </p>

        <form className="step8-form" onSubmit={onSubmitManager}>
          <div className="step8-form__head">Контактные данные</div>
          <label className="frame3-field">
            <span className="frame3-label">Ваше имя</span>
            <input
              className="admin-input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="frame3-field">
            <span className="frame3-label">Телефон</span>
            <input
              className="admin-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="frame3-field">
            <span className="frame3-label">Email</span>
            <input
              className="admin-input"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="primer@gmail.com"
              autoComplete="email"
            />
          </label>
          <label className="frame3-field frame3-field--wide">
            <span className="frame3-label">Комментарий</span>
            <textarea
              className="admin-input step8-form__textarea"
              rows={4}
              value={contactComment}
              onChange={(e) => setContactComment(e.target.value)}
            />
          </label>
          {sendHint ? <p className="step8-form__hint">{sendHint}</p> : null}
          <div className="step8-form__actions">
            <button type="submit" className="admin-primary step8-form__submit">
              Отправить менеджеру
            </button>
            <button
              type="button"
              className="admin-secondary step8-form__pdf"
              disabled={pdfBusy}
              onClick={() => void onOpenClientPdfInNewTab()}
            >
              {pdfBusy ? 'Формируем PDF…' : 'Открыть PDF…'}
            </button>
          </div>
        </form>

        <div className="frame2-card-nav step8-result__nav">
          <button type="button" className="admin-secondary" onClick={() => nav(step('frame/handle-holes'))}>
            ← Назад
          </button>
        </div>
      </section>

      <section className="step8-result__details" aria-label="Детали заказа">
        <div className="step8-result__scroll-pack">
          <div className="step8-panel">
          <h4 className="step8-panel__title">Детализация заказа (фасады)</h4>
          <div className="step8-kv">
            <div className="step8-kv__row">
              <span className="step8-kv__k">Тип профиля</span>
              <span className="step8-kv__v">{frameTypeName}</span>
            </div>
            <div className="step8-kv__row">
              <span className="step8-kv__k">Цвет профиля</span>
              <span className="step8-kv__v">{colorMaterial?.name ?? '—'}</span>
            </div>
            <div className="step8-kv__row">
              <span className="step8-kv__k">Габариты (В × Ш)</span>
              <span className="step8-kv__v">
                {parsed.heightMm} × {parsed.widthMm} мм
              </span>
            </div>
            <div className="step8-kv__row">
              <span className="step8-kv__k">Количество</span>
              <span className="step8-kv__v">{parsed.facadeCount} шт.</span>
            </div>
            <div className="step8-kv__row">
              <span className="step8-kv__k">Наполнение</span>
              <span className="step8-kv__v">{fillingMaterial?.name ?? '—'}</span>
            </div>
            <div className="step8-kv__row">
              <span className="step8-kv__k">Присадка / петли</span>
              <span className="step8-kv__v">{mortiseLine}</span>
            </div>
            {parsed.mortiseMode === 'hinge' ? (
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
          <h4 className="step8-panel__title">Стоимость изготовления (фасады)*</h4>
          {currencyMismatch ? (
            <p className="step8-panel__warn">В конфигурации разные валюты — сумма ориентировочная.</p>
          ) : null}
          <div className="step8-table-wrap">
            <table className="step8-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Профиль</th>
                  <th>Наполнение</th>
                  <th>Сопутствующие</th>
                  <th>Операции</th>
                  <th>Итого</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>
                    {formatSum(breakdown.profile)} {currency}
                  </td>
                  <td>
                    {formatSum(breakdown.filling)} {currency}
                  </td>
                  <td>
                    {formatSum(breakdown.related)} {currency}
                  </td>
                  <td>
                    {formatSum(breakdown.operations)} {currency}
                  </td>
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

          <div className="step8-result__footer-actions">
          <button type="button" className="admin-primary" onClick={() => nav(step('frame'))}>
            Добавить ещё фасад или полку
          </button>
          <button type="button" className="admin-primary" onClick={onNewCalc}>
            Новый расчёт
          </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Step8FrameResult
