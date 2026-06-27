import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createFacadeOrder,
  fetchCalculationFormulas,
  fetchCalculatorHingeTypes,
  fetchCalculatorProfileTypes,
  fetchMaterial,
  fetchMaterialClasses,
} from '../api'
import { fetchMe, hasValidSession } from '../auth'
import { BASE_CURRENCY } from '../currencies'
import type { CalculationFormula, Material } from '../types'
import { formatNumberForUi } from '../floatInput'
import { useCalcPaths } from './calcPathsContext'
import { AdminPanelLoadingOverlay, adminPanelBodyClass } from '../AdminPanelLoadingOverlay'
import { collectCurrencies, computeFramePriceBreakdown } from './framePriceEstimate'
import {
  type HingeMountSide,
  FRAME_DEFAULT_HEIGHT_MM,
  FRAME_DEFAULT_WIDTH_MM,
  isFrameStep2Ready,
  isFrameStep4Ready,
  hingesPerFacadeForPrice,
  parseFramePriceSessionFromConfigKey,
  readCalculatorPriceConfigKey,
  readHandleHoles,
  readHingeLayout,
  shouldBillProductionHinges,
  subscribeFrameCalcSession,
  clearFrameCalculatorStorage,
  notifyFrameCalcSession,
} from './frameCalcSession'
import './Step2FrameFacade.css'
import './Step8FrameResult.css'
import { materialTextureLabel, sketchFillingLine } from './materialTextureLabel'
import { useFillingTypeName } from './useFillingTypeName'
import { CalcPriceBreakdownView } from './CalcPriceBreakdownView'
import { matchFormulaTotalForFrame } from './calculationFormula'
import { serializePriceBreakdownForSnapshot } from './priceBreakdown'

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

function isValidClientEmail(raw: string): boolean {
  const t = raw.trim()
  if (!t.includes('@')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

export function Step8FrameResult() {
  const nav = useNavigate()
  const loc = useLocation()
  const { step, home, readOnly } = useCalcPaths()

  useEffect(() => {
    if (!isFrameStep2Ready()) nav(step('frame'), { replace: true })
  }, [nav, step])

  useEffect(() => {
    if (!isFrameStep4Ready()) nav(step('frame/filling'), { replace: true })
  }, [nav, step])

  const cfgKey = useSyncExternalStore(subscribeFrameCalcSession, readCalculatorPriceConfigKey, () => '')
  const fillingTypeName = useFillingTypeName(cfgKey)

  const parsed = useMemo(() => {
    const session = parseFramePriceSessionFromConfigKey(cfgKey)
    const parts = cfgKey.split('|')
    const h = parts[1] ?? ''
    const w = parts[2] ?? ''
    const qty = asPositiveInt(parts[3] ?? null, 1)
    return {
      colorId: session.colorId,
      heightMm: asPositiveMm(h, FRAME_DEFAULT_HEIGHT_MM),
      widthMm: asPositiveMm(w, FRAME_DEFAULT_WIDTH_MM),
      facadeCount: qty,
      fillMatId: session.fillMatId,
      mortiseMode: session.mortiseMode,
      hingeSource: session.hingeSource,
      hingeTypeId: session.hingeTypeId,
      hingeMatId: session.hingeMatId,
      billHinges: shouldBillProductionHinges(session),
      hingesPerFacade: hingesPerFacadeForPrice(),
    }
  }, [cfgKey])

  const hingeLayout = useMemo(() => (parsed.mortiseMode === 'hinge' ? readHingeLayout() : null), [cfgKey, parsed.mortiseMode])
  const handleHoles = useMemo(() => readHandleHoles(), [cfgKey])

  const [frameTypeName, setFrameTypeName] = useState('—')
  const [colorMaterial, setColorMaterial] = useState<Material | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [fillingMaterial, setFillingMaterial] = useState<Material | null>(null)
  const [hingeMaterial, setHingeMaterial] = useState<Material | null>(null)
  const [formulasList, setFormulasList] = useState<CalculationFormula[]>([])
  const [classCodesById, setClassCodesById] = useState<Map<number, string>>(() => new Map())
  const [mortiseLine, setMortiseLine] = useState('—')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactComment, setContactComment] = useState('')
  const [sendHint, setSendHint] = useState<string | null>(null)
  const [authWallModalOpen, setAuthWallModalOpen] = useState(false)
  const [orderSentModalOpen, setOrderSentModalOpen] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  /** На публичном сайте сотрудник может отправить почту без обязательных полей клиента. */
  const [staffOnSession, setStaffOnSession] = useState(false)

  const returnAfterAuthPath = `${loc.pathname}${loc.search}`

  const clientContactComplete = useMemo(() => {
    const name = contactName.trim()
    const phone = contactPhone.trim()
    const email = contactEmail.trim()
    return Boolean(name && phone && isValidClientEmail(email))
  }, [contactName, contactPhone, contactEmail])

  const submitToManagerDisabled =
    submitBusy || (readOnly && !staffOnSession && !clientContactComplete)

  useEffect(() => {
    let cancel = false
    void fetchMe().then((m) => {
      if (!cancel && m) setStaffOnSession(m.is_staff || m.is_superuser)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!authWallModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAuthWallModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [authWallModalOpen])

  useEffect(() => {
    if (!orderSentModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOrderSentModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderSentModalOpen])

  useEffect(() => {
    void import('./frameClientPdf').then((m) => m.preloadFramePdfFont())
  }, [])

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
        if (!cancel) setFormulasList(r.results ?? [])
      })
      .catch(() => {
        if (!cancel) setFormulasList([])
      })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    let cancel = false
    setProfileLoading(true)
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
      if (!cancel) setProfileLoading(false)
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
    let cancel = false
    ;(async () => {
      if (!parsed.billHinges || !parsed.hingeMatId) {
        setHingeMaterial(null)
        return
      }
      try {
        const m = await fetchMaterial(parsed.hingeMatId)
        if (!cancel) setHingeMaterial(m)
      } catch {
        if (!cancel) setHingeMaterial(null)
      }
    })()
    return () => {
      cancel = true
    }
  }, [parsed.billHinges, parsed.hingeMatId])

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
        const mat = row?.material
        const tex = mat ? materialTextureLabel(mat as Material) : ''
        if (!cancel) {
          setMortiseLine(
            tex && tex !== '—'
              ? `${t?.name ?? '—'} — ${tex}`
              : 'Петли производства — не выбраны',
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
      formulasList,
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
    return { base, breakdown, matched }
  }, [
    formulasList,
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
    [colorMaterial, fillingMaterial, hingeMaterial],
  )

  const currency =
    colorMaterial?.base_currency ||
    fillingMaterial?.base_currency ||
    hingeMaterial?.base_currency ||
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
      `Цвет: ${materialTextureLabel(colorMaterial)}`,
      `Габариты: ${parsed.heightMm} × ${parsed.widthMm} мм, ${parsed.facadeCount} шт.`,
      `Наполнение: ${sketchFillingLine(fillingTypeName, fillingMaterial)}`,
      `Присадка / петли: ${mortiseLine}`,
      ...(parsed.mortiseMode === 'hinge' ? [`Раскладка петель: ${hingeLayoutLine}`] : []),
      `Ручка: ${handleLine}`,
      '',
      ...(breakdown.formulaName ? [`Формула: ${breakdown.formulaName}`] : []),
      `Итого: ${formatSum(breakdown.total)} ${currency}`,
    ]
    return lines.join('\n')
  }

  async function submitFacadeOrder(): Promise<void> {
    const { buildFrameClientPdfBlob } = await import('./frameClientPdf')
    const { blob } = await buildFrameClientPdfBlob(pdfInputPayload())
    const fd = new FormData()
    fd.append(
      'pdf_file',
      new File([blob], 'furnitech-raschet.pdf', { type: 'application/pdf' }),
    )
    fd.append('contact_name', contactName.trim())
    fd.append('contact_phone', contactPhone.trim())
    fd.append('contact_email', contactEmail.trim())
    fd.append('contact_comment', contactComment.trim())
    fd.append('snapshot', JSON.stringify(buildOrderSnapshot()))
    await createFacadeOrder(fd)
  }

  async function onSubmitManager(e: FormEvent) {
    e.preventDefault()
    setSendHint(null)
    setAuthWallModalOpen(false)
    const sessionOk = await hasValidSession()
    if (!sessionOk) {
      setAuthWallModalOpen(true)
      return
    }
    const me = await fetchMe()
    if (!me) {
      setAuthWallModalOpen(true)
      return
    }

    const isStaff = me.is_staff || me.is_superuser
    if (readOnly && !isStaff && !clientContactComplete) {
      setSendHint('Укажите имя, телефон и email — без них заявку нельзя отправить менеджеру.')
      return
    }

    setSubmitBusy(true)
    try {
      await submitFacadeOrder()
      setOrderSentModalOpen(true)
    } catch (err) {
      setSendHint(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitBusy(false)
    }
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
      fillingTypeName,
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
        hinges: breakdown.hinges,
        total: breakdown.total,
        formulaName: breakdown.formulaName,
      },
      priceBreakdownDetail: serializePriceBreakdownForSnapshot(priceState.matched, priceState.base),
      formulaName: breakdown.formulaName,
      currency,
      currencyMismatch,
      hingeLayout,
      includeHingeLayoutRow: parsed.mortiseMode === 'hinge',
      handleHoles,
    }
  }

  function buildOrderSnapshot(): Record<string, unknown> {
    const p = pdfInputPayload()
    return {
      contact: p.contact,
      frameTypeName: p.frameTypeName,
      colorMaterial: p.colorMaterial
        ? {
            id: p.colorMaterial.id,
            name: p.colorMaterial.name,
            texture_label: materialTextureLabel(p.colorMaterial),
            article: p.colorMaterial.article,
          }
        : null,
      fillingTypeName: p.fillingTypeName,
      fillingMaterial: p.fillingMaterial
        ? {
            id: p.fillingMaterial.id,
            name: p.fillingMaterial.name,
            texture_label: materialTextureLabel(p.fillingMaterial),
            article: p.fillingMaterial.article,
          }
        : null,
      heightMm: p.heightMm,
      widthMm: p.widthMm,
      facadeCount: p.facadeCount,
      mortiseLine: p.mortiseLine,
      hingeLayoutLine: p.hingeLayoutLine,
      handleLine: p.handleLine,
      breakdown: p.breakdown,
      formulaName: breakdown.formulaName,
      formulaExpression: breakdown.formulaExpression,
      priceBreakdown: serializePriceBreakdownForSnapshot(priceState.matched, priceState.base),
      currency: p.currency,
      currencyMismatch: p.currencyMismatch,
      hingeLayout: p.hingeLayout,
      includeHingeLayoutRow: p.includeHingeLayoutRow,
      handleHoles: p.handleHoles,
      plainSummary: buildPlainSummary(),
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
      const { buildFrameClientPdfBlob } = await import('./frameClientPdf')
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

  function closeOrderSentModal() {
    setOrderSentModalOpen(false)
  }

  function closeAuthWallModal() {
    setAuthWallModalOpen(false)
  }

  return (
    <>
    <div className={adminPanelBodyClass(profileLoading, 'frame2 step8-result')}>
      <AdminPanelLoadingOverlay active={profileLoading} ariaLabel="Загрузка итога" />
      <section className="step8-result__contact frame2-card calc-side-panel">
        <h3 className="frame3-title">Итог</h3>
        <p className="frame3-sub">
          Проверьте детали и ориентировочную стоимость. Отправьте заявку менеджеру или сохраните расчёт для печати.
        </p>

        <div className="calc-side-panel-scroll">
        <form id="step8-contact-form" className="step8-form" onSubmit={onSubmitManager}>
          <div className="step8-form__head">Контактные данные</div>
          <label className="frame3-field">
            <span className="frame3-label">
              Ваше имя
              {readOnly && !staffOnSession ? <span className="step8-form__req"> *</span> : null}
            </span>
            <input
              className="admin-input"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              autoComplete="name"
              required={readOnly && !staffOnSession}
            />
          </label>
          <label className="frame3-field">
            <span className="frame3-label">
              Телефон
              {readOnly && !staffOnSession ? <span className="step8-form__req"> *</span> : null}
            </span>
            <input
              className="admin-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
              autoComplete="tel"
              required={readOnly && !staffOnSession}
            />
          </label>
          <label className="frame3-field">
            <span className="frame3-label">
              Email
              {readOnly && !staffOnSession ? <span className="step8-form__req"> *</span> : null}
            </span>
            <input
              className="admin-input"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="primer@gmail.com"
              autoComplete="email"
              required={readOnly && !staffOnSession}
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
        </form>
        </div>

        <div className="frame2-card-nav step8-result__nav">
          <button type="button" className="admin-secondary" onClick={() => nav(step('frame/handle-holes'))}>
            ← Назад
          </button>
          <div className="step8-result__nav-end">
            <button
              type="submit"
              form="step8-contact-form"
              className="admin-primary step8-form__submit"
              disabled={submitToManagerDisabled}
            >
              {submitBusy ? 'Отправка…' : 'Отправить'}
            </button>
            <button
              type="button"
              className="admin-secondary step8-form__pdf"
              disabled={pdfBusy}
              onClick={() => void onOpenClientPdfInNewTab()}
            >
              {pdfBusy ? 'Формируем PDF' : 'Открыть PDF'}
            </button>
          </div>
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
              <span className="step8-kv__v">{materialTextureLabel(colorMaterial)}</span>
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
              <span className="step8-kv__v">{sketchFillingLine(fillingTypeName, fillingMaterial)}</span>
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
          <div className="step8-price-breakdown-wrap">
            <CalcPriceBreakdownView
              currency={currency}
              base={priceState.base}
              formulaMatch={
                priceState.matched
                  ? {
                      formulaName: priceState.matched.formula.name,
                      formulaExpression: priceState.matched.formula.expression,
                      evaluation: priceState.matched.evaluation,
                      formula: priceState.matched.formula,
                    }
                  : null
              }
              colorMaterial={colorMaterial}
              fillingMaterial={fillingMaterial}
              hingeMaterial={hingeMaterial}
              hingesPerFacade={hingesPerFacade}
              heightMm={parsed.heightMm}
              widthMm={parsed.widthMm}
              facadeCount={parsed.facadeCount}
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

          <div className="step8-result__footer-actions">
          <button type="button" className="admin-primary" onClick={() => nav(step('frame'))}>
            Добавить фасад
          </button>
          <button type="button" className="admin-primary" onClick={onNewCalc}>
            Новый расчёт
          </button>
          </div>
        </div>
      </section>
    </div>
    {orderSentModalOpen
      ? createPortal(
          <div
            className="step8-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="step8-order-sent-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeOrderSentModal()
            }}
          >
            <div className="step8-modal step8-modal--success" role="document" onClick={(e) => e.stopPropagation()}>
              <h4 id="step8-order-sent-title" className="step8-modal__title">
                Заказ отправлен
              </h4>
              {readOnly && !staffOnSession ? (
                <p className="step8-modal__text">
                  Заказ сохранён. Его можно посмотреть во вкладке «Мои заказы».
                </p>
              ) : null}
              <div className="step8-modal__actions">
                <button type="button" className="admin-primary" onClick={closeOrderSentModal}>
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}
    {authWallModalOpen
      ? createPortal(
          <div
            className="admin-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="step8-auth-wall-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeAuthWallModal()
            }}
          >
            <div className="admin-modal" role="document" onClick={(e) => e.stopPropagation()}>
              <h4 id="step8-auth-wall-title" className="admin-modal-title">
                Войти или зарегистрироваться
              </h4>
              <p className="admin-modal-text">
                Чтобы отправить заявку менеджеру и получить заказ в «Мои заказы», нужен аккаунт клиента.
                Войдите или зарегистрируйтесь — после входа вернитесь к этому шагу и нажмите «Отправить»
                снова.
              </p>
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary" onClick={closeAuthWallModal}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => {
                    closeAuthWallModal()
                    nav('/register', { state: { from: returnAfterAuthPath } })
                  }}
                >
                  Регистрация
                </button>
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => {
                    closeAuthWallModal()
                    nav('/login', { state: { from: returnAfterAuthPath } })
                  }}
                >
                  Войти
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  )
}

export default Step8FrameResult
