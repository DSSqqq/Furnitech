import { fetchMaterial } from '../api'
import type { FacadeOrder } from '../api'
import type { Material } from '../types'
import type { FrameClientPdfBreakdown, FrameClientPdfBundle, FrameClientPdfInput } from './frameClientPdf'
import type { HandleHolesPersisted, HingeLayoutPersisted } from './frameCalcSession'

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function parseHingeLayout(raw: unknown): HingeLayoutPersisted | null {
  const j = asRecord(raw)
  if (!j) return null
  const side = j.side
  if (side !== 'left' && side !== 'right' && side !== 'top' && side !== 'bottom') return null
  const count = asNumber(j.count, 0)
  const positionsMm = Array.isArray(j.positionsMm) ? j.positionsMm.map((x) => Number(x)) : []
  if (count < 2 || positionsMm.length !== count) return null
  if (positionsMm.some((x) => !Number.isFinite(x))) return null
  return { side, count, positionsMm }
}

function parseHandleHoles(raw: unknown): HandleHolesPersisted | null {
  const j = asRecord(raw)
  if (!j) return null
  const side = j.side
  if (side !== 'left' && side !== 'right' && side !== 'top' && side !== 'bottom') return null
  const orientation = j.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  const count = Math.max(0, Math.floor(asNumber(j.count, 0)))
  const diameterMm = asNumber(j.diameterMm, 0)
  if (count <= 0 || diameterMm <= 0) return null
  const offsetStartMm = asNumber(j.offsetStartMm, NaN)
  if (!Number.isFinite(offsetStartMm)) return null
  const spanArr = Array.isArray(j.spanMm) ? j.spanMm.map((x) => Number(x)) : []
  if (spanArr.length !== count - 1) return null
  if (spanArr.some((x) => !Number.isFinite(x))) return null
  return {
    side,
    orientation,
    count,
    diameterMm,
    bushings: Boolean(j.bushings),
    offsetStartMm,
    spanMm: spanArr,
  }
}

function parseBreakdown(raw: unknown): FrameClientPdfBreakdown {
  const b = asRecord(raw)
  const hinges = b?.hinges
  return {
    profile: asNumber(b?.profile),
    filling: asNumber(b?.filling),
    related: asNumber(b?.related),
    hinges: typeof hinges === 'number' && Number.isFinite(hinges) ? hinges : undefined,
    total: asNumber(b?.total),
  }
}

async function materialFromSnapshotPart(part: unknown): Promise<Material | null> {
  const rec = asRecord(part)
  if (!rec) return null
  const id = asNumber(rec.id, 0)
  if (id <= 0) return null
  try {
    return await fetchMaterial(id)
  } catch {
    return null
  }
}

/** Собрать вход PDF из snapshot заказа (как на шаге 8). Поддерживает несколько конфигураций фасадов. */
export async function buildPdfInputFromOrderSnapshot(
  snapshot: Record<string, unknown>,
  orderNumber?: string,
): Promise<FrameClientPdfInput | FrameClientPdfBundle> {
  const contactRec = asRecord(snapshot.contact) ?? {}
  const contact = {
    name: asString(contactRec.name) || asString(snapshot.contact_name),
    phone: asString(contactRec.phone) || asString(snapshot.contact_phone),
    email: asString(contactRec.email) || asString(snapshot.contact_email),
    comment: asString(contactRec.comment) || asString(snapshot.contact_comment),
  }

  const variantsRaw = snapshot.facadeVariants
  if (Array.isArray(variantsRaw) && variantsRaw.length > 0) {
    const facades = await Promise.all(
      variantsRaw.map(async (variant) => {
        const v = asRecord(variant) ?? {}
        const breakdown = parseBreakdown(v.breakdown)
        const formulaName = asString(v.formulaName)
        const [colorMaterial, fillingMaterial] = await Promise.all([
          materialFromSnapshotPart(v.colorMaterial),
          materialFromSnapshotPart(v.fillingMaterial),
        ])
        const hingeLayout = parseHingeLayout(v.hingeLayout)
        const includeHingeLayoutRow =
          v.includeHingeLayoutRow === true ||
          (hingeLayout != null && v.includeHingeLayoutRow !== false)

        return {
          frameTypeName: asString(v.frameTypeName) || '—',
          fillingTypeName: asString(v.fillingTypeName) || undefined,
          colorMaterial,
          fillingMaterial,
          heightMm: asNumber(v.heightMm, 500),
          widthMm: asNumber(v.widthMm, 200),
          facadeCount: Math.max(1, Math.floor(asNumber(v.facadeCount, 1))),
          mortiseLine: asString(v.mortiseLine) || '—',
          hingeLayoutLine: asString(v.hingeLayoutLine) || '—',
          handleLine: asString(v.handleLine) || '—',
          breakdown,
          priceBreakdownDetail:
            asRecord(v.priceBreakdown) ?? asRecord(v.priceBreakdownDetail) ?? undefined,
          formulaName: formulaName || undefined,
          currency: asString(v.currency) || asString(snapshot.currency) || 'KZT',
          currencyMismatch: v.currencyMismatch === true || snapshot.currencyMismatch === true,
          hingeLayout,
          includeHingeLayoutRow,
          handleHoles: parseHandleHoles(v.handleHoles),
        }
      }),
    )
    return { contact, facades, orderNumber: orderNumber?.trim() || undefined }
  }

  const breakdown = parseBreakdown(snapshot.breakdown)
  const formulaName = asString(snapshot.formulaName)

  const [colorMaterial, fillingMaterial] = await Promise.all([
    materialFromSnapshotPart(snapshot.colorMaterial),
    materialFromSnapshotPart(snapshot.fillingMaterial),
  ])

  const hingeLayout = parseHingeLayout(snapshot.hingeLayout)
  const includeHingeLayoutRow =
    snapshot.includeHingeLayoutRow === true ||
    (hingeLayout != null && snapshot.includeHingeLayoutRow !== false)

  return {
    contact,
    frameTypeName: asString(snapshot.frameTypeName) || '—',
    fillingTypeName: asString(snapshot.fillingTypeName) || undefined,
    colorMaterial,
    fillingMaterial,
    heightMm: asNumber(snapshot.heightMm, 500),
    widthMm: asNumber(snapshot.widthMm, 200),
    facadeCount: Math.max(1, Math.floor(asNumber(snapshot.facadeCount, 1))),
    mortiseLine: asString(snapshot.mortiseLine) || '—',
    hingeLayoutLine: asString(snapshot.hingeLayoutLine) || '—',
    handleLine: asString(snapshot.handleLine) || '—',
    breakdown,
    priceBreakdownDetail:
      asRecord(snapshot.priceBreakdown) ?? asRecord(snapshot.priceBreakdownDetail) ?? undefined,
    formulaName: formulaName || undefined,
    currency: asString(snapshot.currency) || 'KZT',
    currencyMismatch: snapshot.currencyMismatch === true,
    hingeLayout,
    includeHingeLayoutRow,
    handleHoles: parseHandleHoles(snapshot.handleHoles),
    orderNumber: orderNumber?.trim() || undefined,
  }
}

/** Открыть PDF во вкладке — тот же генератор, что «Открыть PDF» на шаге 8. */
export async function openFacadeOrderPdf(order: Pick<FacadeOrder, 'snapshot' | 'order_number'>): Promise<void> {
  const preview = window.open('about:blank', '_blank')
  if (!preview) {
    window.alert(
      'Не удалось открыть новую вкладку. Разрешите всплывающие окна для этого сайта и попробуйте снова.',
    )
    throw new Error('popup_blocked')
  }

  try {
    const pdf = await import('./frameClientPdf')
    await pdf.preloadFramePdfFont()
    const input = await buildPdfInputFromOrderSnapshot(order.snapshot ?? {}, order.order_number)
    const { blob } = await pdf.buildFrameClientPdfBlob(input)
    const url = URL.createObjectURL(blob)
    preview.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 180_000)
  } catch (e) {
    preview.close()
    throw e
  }
}
