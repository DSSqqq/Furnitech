import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
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
import { usePanelLoading } from '../AdminPanelLoadingHost'
import {
  collectMaterialTextureImageUrls,
  useCalcImagesPreload,
} from './calcStepAssetsLoading'
import { collectCurrencies, computeFramePriceBreakdown } from './framePriceEstimate'
import {
  type HingeMountSide,
  FRAME_DEFAULT_HEIGHT_MM,
  FRAME_DEFAULT_WIDTH_MM,
  adjustEditingFacadeSlotAfterRemove,
  clearEditingFacadeSlot,
  isFrameStep2Ready,
  isFrameStep4Ready,
  hingesPerFacadeForPrice,
  parseFramePriceSessionFromConfigKey,
  readCalculatorPriceConfigKey,
  readEditingFacadeSlot,
  readCurrentFacadeIndex,
  CALC_LS_CURRENT_FACADE_INDEX,
  savedIndexToTabIndex,
  tabIndexToSavedIndex,
  writeCurrentFacadeIndex,
  readHandleHoles,
  readHingeLayout,
  shouldBillProductionHinges,
  subscribeFrameCalcSession,
  clearFrameCalculatorStorage,
  notifyFrameCalcSession,
  resetFrameCalculatorForNewFacade,
} from './frameCalcSession'
import './Step2FrameFacade.css'
import './Step8FrameResult.css'
import { materialTextureLabel, sketchFillingLine } from './materialTextureLabel'
import { useFillingTypeName } from './useFillingTypeName'
import { matchFormulaTotalForFrame } from './calculationFormula'
import { serializePriceBreakdownForSnapshot } from './priceBreakdown'
import {
  appendSavedFacade,
  facadeSnapshotToOrderJson,
  facadeSnapshotToPdfPartial,
  readSavedFacades,
  readSavedFacadesRaw,
  removeSavedFacadeAt,
  replaceSavedFacadeAt,
  swapFacadeTabIntoSession,
  promoteSavedFacadeToSession,
  totalFacadeVariantCount,
  type FrameFacadeSnapshot,
} from './frameSavedFacades'
import { savedFacadeToPanelsProps, Step8FacadePanels } from './Step8FacadePanels'
import type { FrameClientPdfBundle } from './frameClientPdf'

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

function readCurrentFacadeIndexRaw(): string {
  try {
    return localStorage.getItem(CALC_LS_CURRENT_FACADE_INDEX) ?? ''
  } catch {
    return ''
  }
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

  const cfgKey = useSyncExternalStore(subscribeFrameCalcSession, readCalculatorPriceConfigKey, () => '')
  const savedFacadesRaw = useSyncExternalStore(subscribeFrameCalcSession, readSavedFacadesRaw, () => '[]')
  const currentFacadeIndexRaw = useSyncExternalStore(subscribeFrameCalcSession, readCurrentFacadeIndexRaw, () => '')
  const savedFacades = useMemo(() => readSavedFacades(), [savedFacadesRaw])
  const fillingTypeName = useFillingTypeName(cfgKey)
  const currentFacadeReady = isFrameStep2Ready() && isFrameStep4Ready()
  const facadeVariantCount = totalFacadeVariantCount(savedFacades.length, currentFacadeReady)

  useEffect(() => {
    if (!isFrameStep2Ready() && savedFacades.length === 0) nav(step('frame'), { replace: true })
  }, [nav, step, savedFacades.length])

  useEffect(() => {
    if (!isFrameStep4Ready() && savedFacades.length === 0) nav(step('frame/filling'), { replace: true })
  }, [nav, step, savedFacades.length])

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
  const [metaLoading, setMetaLoading] = useState(true)
  const [fillingMaterial, setFillingMaterial] = useState<Material | null>(null)
  const [fillMatLoading, setFillMatLoading] = useState(false)
  const [hingeMaterial, setHingeMaterial] = useState<Material | null>(null)
  const [hingeMatLoading, setHingeMatLoading] = useState(false)
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
  const [selectedFacadeIndex, setSelectedFacadeIndex] = useState(() => {
    const savedLen = readSavedFacades().length
    const ready = isFrameStep2Ready() && isFrameStep4Ready()
    return ready ? readCurrentFacadeIndex(savedLen) : Math.max(0, savedLen - 1)
  })
  const editingSlotCommittedRef = useRef(false)
  /** На публичном сайте сотрудник может отправить почту без обязательных полей клиента. */
  const [staffOnSession, setStaffOnSession] = useState(false)

  const currentFacadeIndex = useMemo(() => {
    if (!currentFacadeReady) return -1
    return readCurrentFacadeIndex(savedFacades.length)
  }, [currentFacadeReady, savedFacades.length, currentFacadeIndexRaw])
  const isViewingCurrentFacade = currentFacadeReady && selectedFacadeIndex === currentFacadeIndex

  useEffect(() => {
    setSelectedFacadeIndex((prev) => Math.min(prev, Math.max(0, facadeVariantCount - 1)))
  }, [facadeVariantCount])

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
    setMetaLoading(true)
    void Promise.all([
      fetchMaterialClasses()
        .then((r) => {
          if (cancel) return
          const m = new Map<number, string>()
          for (const c of r.results ?? []) m.set(c.id, c.code)
          setClassCodesById(m)
        })
        .catch(() => {
          if (!cancel) setClassCodesById(new Map())
        }),
      fetchCalculationFormulas({ active: true })
        .then((r) => {
          if (!cancel) setFormulasList(r.results ?? [])
        })
        .catch(() => {
          if (!cancel) setFormulasList([])
        }),
    ]).finally(() => {
      if (!cancel) setMetaLoading(false)
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
    if (!parsed.fillMatId) {
      setFillingMaterial(null)
      setFillMatLoading(false)
      return
    }
    setFillMatLoading(true)
    const fillMatId = parsed.fillMatId
    ;(async () => {
      try {
        const m = await fetchMaterial(fillMatId)
        if (!cancel) setFillingMaterial(m)
      } catch {
        if (!cancel) setFillingMaterial(null)
      } finally {
        if (!cancel) setFillMatLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [parsed.fillMatId])

  useEffect(() => {
    let cancel = false
    if (!parsed.billHinges || !parsed.hingeMatId) {
      setHingeMaterial(null)
      setHingeMatLoading(false)
      return
    }
    setHingeMatLoading(true)
    const hingeMatId = parsed.hingeMatId
    ;(async () => {
      try {
        const m = await fetchMaterial(hingeMatId)
        if (!cancel) setHingeMaterial(m)
      } catch {
        if (!cancel) setHingeMaterial(null)
      } finally {
        if (!cancel) setHingeMatLoading(false)
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

  function readSessionFrameTypeId(): number | null {
    try {
      const raw = localStorage.getItem('calc_frame_type_id')?.trim() ?? ''
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    } catch {
      return null
    }
  }

  function readSessionFillingTypeId(): number | null {
    try {
      const raw = localStorage.getItem('calc_filling_type_id')?.trim() ?? ''
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    } catch {
      return null
    }
  }

  function buildCurrentFacadeSnapshot(): Omit<FrameFacadeSnapshot, 'id'> {
    return {
      frameTypeId: readSessionFrameTypeId(),
      fillingTypeId: readSessionFillingTypeId(),
      hingeTypeId: parsed.hingeTypeId,
      hingeSource: parsed.hingeSource,
      frameTypeName,
      fillingTypeName,
      colorMaterial,
      fillingMaterial,
      hingeMaterial,
      heightMm: parsed.heightMm,
      widthMm: parsed.widthMm,
      facadeCount: parsed.facadeCount,
      mortiseLine,
      hingeLayoutLine,
      handleLine,
      breakdown,
      priceBreakdown: serializePriceBreakdownForSnapshot(priceState.matched, priceState.base),
      formulaName: breakdown.formulaName,
      formulaExpression: breakdown.formulaExpression,
      formulaMatch: priceState.matched
        ? {
            formulaName: priceState.matched.formula.name,
            formulaExpression: priceState.matched.formula.expression,
            evaluation: priceState.matched.evaluation,
          }
        : null,
      currency,
      currencyMismatch,
      hingeLayout,
      includeHingeLayoutRow: parsed.mortiseMode === 'hinge',
      handleHoles,
      hingesPerFacade,
      mortiseMode: parsed.mortiseMode,
    }
  }

  function buildPlainSummaryForFacade(
    snap: Pick<
      FrameFacadeSnapshot,
      | 'frameTypeName'
      | 'colorMaterial'
      | 'heightMm'
      | 'widthMm'
      | 'facadeCount'
      | 'fillingTypeName'
      | 'fillingMaterial'
      | 'mortiseLine'
      | 'hingeLayoutLine'
      | 'handleLine'
      | 'includeHingeLayoutRow'
      | 'breakdown'
      | 'formulaName'
      | 'currency'
    >,
    index: number,
  ): string {
    const lines: string[] = [
      `Фасад №${index}`,
      `Профиль: ${snap.frameTypeName}`,
      `Цвет: ${materialTextureLabel(snap.colorMaterial)}`,
      `Габариты: ${snap.heightMm} × ${snap.widthMm} мм, ${snap.facadeCount} шт.`,
      `Наполнение: ${sketchFillingLine(snap.fillingTypeName, snap.fillingMaterial)}`,
      `Присадка / петли: ${snap.mortiseLine}`,
      ...(snap.includeHingeLayoutRow ? [`Раскладка петель: ${snap.hingeLayoutLine}`] : []),
      `Ручка: ${snap.handleLine}`,
      '',
      ...(snap.formulaName ?? snap.breakdown.formulaName ? [`Формула: ${snap.formulaName ?? snap.breakdown.formulaName}`] : []),
      `Итого: ${formatSum(snap.breakdown.total)} ${snap.currency}`,
    ]
    return lines.join('\n')
  }

  function savedFacadeAtTab(tabIndex: number): FrameFacadeSnapshot | null {
    if (!currentFacadeReady) return savedFacades[tabIndex] ?? null
    const savedIdx = tabIndexToSavedIndex(tabIndex, currentFacadeIndex)
    if (savedIdx == null) return null
    return savedFacades[savedIdx] ?? null
  }

  function buildPlainSummary(): string {
    const parts: string[] = ['Расчёт фасадов (Furnitech)', `Разных конфигураций: ${facadeVariantCount}`]
    for (let i = 0; i < facadeVariantCount; i++) {
      if (currentFacadeReady && i === currentFacadeIndex) {
        parts.push('', buildPlainSummaryForFacade(buildCurrentFacadeSnapshot(), i + 1))
      } else {
        const snap = savedFacadeAtTab(i)
        if (snap) parts.push('', buildPlainSummaryForFacade(snap, i + 1))
      }
    }
    return parts.join('\n')
  }

  async function submitFacadeOrder(): Promise<void> {
    const { buildFrameClientPdfBlob } = await import('./frameClientPdf')
    const { blob } = await buildFrameClientPdfBlob(pdfInputBundle())
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

  function pdfInputBundle(): FrameClientPdfBundle {
    const contact = {
      name: contactName,
      phone: contactPhone,
      email: contactEmail,
      comment: contactComment,
    }
    const facades = []
    for (let i = 0; i < facadeVariantCount; i++) {
      if (currentFacadeReady && i === currentFacadeIndex) {
        facades.push(facadeSnapshotToPdfPartial(buildCurrentFacadeSnapshot()))
      } else {
        const snap = savedFacadeAtTab(i)
        if (snap) facades.push(facadeSnapshotToPdfPartial(snap))
      }
    }
    return { contact, facades }
  }

  function buildOrderSnapshot(): Record<string, unknown> {
    const variants: FrameFacadeSnapshot[] = []
    for (let i = 0; i < facadeVariantCount; i++) {
      if (currentFacadeReady && i === currentFacadeIndex) {
        variants.push({ ...buildCurrentFacadeSnapshot(), id: 'current' })
      } else {
        const snap = savedFacadeAtTab(i)
        if (snap) variants.push(snap)
      }
    }
    const legacy = variants[variants.length - 1]!
    return {
      contact: {
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
        comment: contactComment,
      },
      facadeVariantCount: facadeVariantCount,
      facadeVariants: variants.map((snap) => ({
        ...facadeSnapshotToOrderJson(snap),
        colorMaterial: snap.colorMaterial
          ? {
              id: snap.colorMaterial.id,
              name: snap.colorMaterial.name,
              texture_label: materialTextureLabel(snap.colorMaterial),
              article: snap.colorMaterial.article,
            }
          : null,
        fillingMaterial: snap.fillingMaterial
          ? {
              id: snap.fillingMaterial.id,
              name: snap.fillingMaterial.name,
              texture_label: materialTextureLabel(snap.fillingMaterial),
              article: snap.fillingMaterial.article,
            }
          : null,
      })),
      frameTypeName: legacy.frameTypeName,
      colorMaterial: legacy.colorMaterial
        ? {
            id: legacy.colorMaterial.id,
            name: legacy.colorMaterial.name,
            texture_label: materialTextureLabel(legacy.colorMaterial),
            article: legacy.colorMaterial.article,
          }
        : null,
      fillingTypeName: legacy.fillingTypeName,
      fillingMaterial: legacy.fillingMaterial
        ? {
            id: legacy.fillingMaterial.id,
            name: legacy.fillingMaterial.name,
            texture_label: materialTextureLabel(legacy.fillingMaterial),
            article: legacy.fillingMaterial.article,
          }
        : null,
      heightMm: legacy.heightMm,
      widthMm: legacy.widthMm,
      facadeCount: legacy.facadeCount,
      mortiseLine: legacy.mortiseLine,
      hingeLayoutLine: legacy.hingeLayoutLine,
      handleLine: legacy.handleLine,
      breakdown: {
        profile: legacy.breakdown.profile,
        filling: legacy.breakdown.filling,
        related: legacy.breakdown.related,
        hinges: legacy.breakdown.hinges,
        total: legacy.breakdown.total,
        formulaName: legacy.breakdown.formulaName,
      },
      formulaName: legacy.formulaName,
      formulaExpression: legacy.formulaExpression,
      priceBreakdown: legacy.priceBreakdown,
      currency: legacy.currency,
      currencyMismatch: legacy.currencyMismatch,
      hingeLayout: legacy.hingeLayout,
      includeHingeLayoutRow: legacy.includeHingeLayoutRow,
      handleHoles: legacy.handleHoles,
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
      const { blob } = await buildFrameClientPdfBlob(pdfInputBundle())
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

  function onSelectFacadeTab(tabIndex: number) {
    if (tabIndex === selectedFacadeIndex && tabIndex === currentFacadeIndex) return
    if (!dataApisReady) {
      setSelectedFacadeIndex(tabIndex)
      return
    }
    clearEditingFacadeSlot()
    editingSlotCommittedRef.current = false

    if (!currentFacadeReady) {
      promoteSavedFacadeToSession(tabIndex, tabIndex)
      setSelectedFacadeIndex(tabIndex)
      return
    }

    if (tabIndex === currentFacadeIndex) {
      setSelectedFacadeIndex(tabIndex)
      return
    }

    swapFacadeTabIntoSession(tabIndex, currentFacadeIndex, buildCurrentFacadeSnapshot())
    setSelectedFacadeIndex(tabIndex)
  }

  function onAddFacade() {
    if (!dataApisReady) return
    if (!currentFacadeReady) {
      clearEditingFacadeSlot()
      nav(step('frame'))
      return
    }
    clearEditingFacadeSlot()
    editingSlotCommittedRef.current = false
    appendSavedFacade(buildCurrentFacadeSnapshot())
    writeCurrentFacadeIndex(readSavedFacades().length)
    resetFrameCalculatorForNewFacade()
    notifyFrameCalcSession()
    nav(step('frame'))
  }

  function onDeleteSelectedFacade() {
    if (facadeVariantCount <= 1) return
    const label = isViewingCurrentFacade
      ? 'текущий фасад'
      : `фасад ${selectedFacadeIndex + 1}`
    if (!window.confirm(`Удалить ${label} из расчёта? Это действие нельзя отменить.`)) return

    const nextIndex = Math.min(selectedFacadeIndex, facadeVariantCount - 2)

    if (isViewingCurrentFacade) {
      resetFrameCalculatorForNewFacade()
      notifyFrameCalcSession()
      const newSavedLen = readSavedFacades().length
      const nextCurrent = Math.max(0, newSavedLen - 1)
      writeCurrentFacadeIndex(nextCurrent)
      setSelectedFacadeIndex(Math.max(0, nextIndex))
      return
    }

    const savedIdx = tabIndexToSavedIndex(selectedFacadeIndex, currentFacadeIndex)
    if (savedIdx == null) return
    adjustEditingFacadeSlotAfterRemove(savedIdx)
    removeSavedFacadeAt(savedIdx)
    let nextCurrent = currentFacadeIndex
    if (selectedFacadeIndex < currentFacadeIndex) nextCurrent -= 1
    writeCurrentFacadeIndex(nextCurrent)
    setSelectedFacadeIndex(Math.max(0, nextIndex))
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

  const dataApisReady = !profileLoading && !metaLoading && !fillMatLoading && !hingeMatLoading

  useEffect(() => {
    if (!dataApisReady || editingSlotCommittedRef.current) return
    const slot = readEditingFacadeSlot()
    if (slot == null) return
    if (slot < 0 || slot >= savedFacades.length) {
      clearEditingFacadeSlot()
      return
    }
    editingSlotCommittedRef.current = true
    replaceSavedFacadeAt(slot, buildCurrentFacadeSnapshot())
    clearEditingFacadeSlot()
    setSelectedFacadeIndex(savedIndexToTabIndex(slot, readCurrentFacadeIndex(savedFacades.length)))
  }, [
    dataApisReady,
    savedFacades.length,
    cfgKey,
    frameTypeName,
    fillingTypeName,
    colorMaterial,
    fillingMaterial,
    hingeMaterial,
    mortiseLine,
    hingeLayoutLine,
    handleLine,
    breakdown,
    priceState,
    currency,
    currencyMismatch,
    hingeLayout,
    handleHoles,
    hingesPerFacade,
    parsed,
  ])

  const summaryTextureUrls = useMemo(
    () =>
      collectMaterialTextureImageUrls(
        [colorMaterial, fillingMaterial, hingeMaterial].filter(Boolean) as Material[],
      ),
    [colorMaterial, fillingMaterial, hingeMaterial],
  )
  const summaryTexturesLoading = useCalcImagesPreload(summaryTextureUrls, dataApisReady)
  usePanelLoading(
    'data',
    profileLoading || metaLoading || fillMatLoading || hingeMatLoading || summaryTexturesLoading,
  )

  return (
    <>
    <div className="frame2 step8-result">
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
          <div className="step8-facade-switcher" role="tablist" aria-label="Фасады в расчёте">
            {Array.from({ length: facadeVariantCount }, (_, i) => {
              const isCurrent = currentFacadeReady && i === currentFacadeIndex
              const isActive = i === selectedFacadeIndex
              const tabKey = isCurrent ? `current-${i}` : savedFacadeAtTab(i)?.id ?? `tab-${i}`
              return (
                <button
                  key={tabKey}
                  type="button"
                  role="tab"
                  id={`step8-facade-tab-${i + 1}`}
                  aria-selected={isActive}
                  aria-controls="step8-facade-panels"
                  className={[
                    'step8-facade-tab',
                    isActive ? 'step8-facade-tab--active' : '',
                    isCurrent ? 'step8-facade-tab--current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectFacadeTab(i)}
                >
                  Фасад {i + 1}
                  {isCurrent ? <span className="step8-facade-tab__badge">текущий</span> : null}
                </button>
              )
            })}
          </div>

          <div id="step8-facade-panels" role="tabpanel" aria-labelledby={`step8-facade-tab-${selectedFacadeIndex + 1}`}>
            {!isViewingCurrentFacade && savedFacadeAtTab(selectedFacadeIndex) ? (
              <Step8FacadePanels {...savedFacadeToPanelsProps(savedFacadeAtTab(selectedFacadeIndex)!, selectedFacadeIndex + 1)} />
            ) : (
              <Step8FacadePanels
                index={currentFacadeIndex + 1}
                isCurrent
                frameTypeName={frameTypeName}
                fillingTypeName={fillingTypeName}
                colorMaterial={colorMaterial}
                fillingMaterial={fillingMaterial}
                hingeMaterial={hingeMaterial}
                heightMm={parsed.heightMm}
                widthMm={parsed.widthMm}
                facadeCount={parsed.facadeCount}
                mortiseLine={mortiseLine}
                hingeLayoutLine={hingeLayoutLine}
                handleLine={handleLine}
                showHingeLayout={parsed.mortiseMode === 'hinge'}
                currency={currency}
                currencyMismatch={currencyMismatch}
                breakdown={breakdown}
                base={priceState.base}
                formulaMatch={
                  priceState.matched
                    ? {
                        formulaName: priceState.matched.formula.name,
                        formulaExpression: priceState.matched.formula.expression,
                        evaluation: priceState.matched.evaluation,
                      }
                    : null
                }
                hingesPerFacade={hingesPerFacade}
              />
            )}
          </div>

          <div className="step8-result__footer-actions">
          <button
            type="button"
            className="admin-primary"
            disabled={!dataApisReady}
            onClick={onAddFacade}
          >
            Добавить фасад
          </button>
          <button type="button" className="admin-primary" onClick={onNewCalc}>
            Новый расчёт
          </button>
          <button
            type="button"
            className="admin-primary step8-facade-delete"
            disabled={!dataApisReady || facadeVariantCount <= 1}
            onClick={onDeleteSelectedFacade}
          >
            Удалить текущий
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
              <div className="admin-row mat-form-actions">
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
              <div className="admin-row mat-form-actions">
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
