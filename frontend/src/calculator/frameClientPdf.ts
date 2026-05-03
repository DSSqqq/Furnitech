import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import type { Material } from '../types'
import {
  type EdgeChainSegmentMm,
  type HandleHolesPersisted,
  type HingeLayoutPersisted,
  type HingeMountSide,
  edgeChainSegmentsMm,
  handleHoleCentersMm,
  hingeEdgeLengthMm,
  validateHandleHoles,
  validateHingePositions,
} from './frameCalcSession'
import { resolveMediaUrl } from './sketchFrame'

export type FrameClientPdfBreakdown = {
  profile: number
  filling: number
  related: number
  operations: number
  total: number
}

export type FrameClientPdfInput = {
  contact: { name: string; phone: string; email: string; comment: string }
  frameTypeName: string
  colorMaterial: Material | null
  fillingMaterial: Material | null
  heightMm: number
  widthMm: number
  facadeCount: number
  mortiseLine: string
  hingeLayoutLine: string
  handleLine: string
  breakdown: FrameClientPdfBreakdown
  currency: string
  currencyMismatch: boolean
  /** Как на шаге 7: эскиз с цепочками и отверстиями. */
  hingeLayout: HingeLayoutPersisted | null
  /** Строка «Раскладка петель» на первой странице — только если на шаге 5 выбраны присадки под петли. */
  includeHingeLayoutRow: boolean
  handleHoles: HandleHolesPersisted | null
}

/** Оценочная толщина видимой рамки на чертеже (мм): подписи как отступ от края фасада до «стекла». */
const FRAME_INSET_MM = 5

/** Как на эскизах калькулятора (Step3–7): ширина/высота на экране слегка «смягчена» относительно реальных мм. */
function clampPdf(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function blendAspectPdf(defaultAspect: number, targetAspect: number, strength: number) {
  const k = clampPdf(strength, 0, 1)
  return defaultAspect + (targetAspect - defaultAspect) * k
}

/** Соотношение сторон рамки на чертеже (ширина / высота), как `sketchAspect` в `Step7FrameHandleHoles`. */
function facadePdfSketchAspect(widthMm: number, heightMm: number): number {
  const W = widthMm
  const H = heightMm
  if (!(W > 0 && H > 0)) return 3 / 4.2
  const target = W / H
  const softened = blendAspectPdf(3 / 4.2, target, 0.28)
  return clampPdf(softened, 0.56, 0.92)
}

const PDF_DIM_THIN_SPAN_PCT = 10
const PDF_CHAIN_NUDGE_STEP_MM = 2.6
const PDF_CHAIN_BASE_MM = 11
const PDF_MAIN_DIM_GAP_MM = 9

function pdfChainSegmentsWithNudge(segments: EdgeChainSegmentMm[]): (EdgeChainSegmentMm & { nudgeMm: number })[] {
  let run = 0
  return segments.map((seg) => {
    const span = seg.t1 - seg.t0
    let nudgeMm = 0
    if (span < PDF_DIM_THIN_SPAN_PCT) {
      nudgeMm = run * PDF_CHAIN_NUDGE_STEP_MM
      run += 1
    } else {
      run = 0
    }
    return { ...seg, nudgeMm }
  })
}

function pdfInsetForChainSide(side: HingeMountSide | undefined | null): { l: number; r: number; t: number; b: number } {
  if (!side) return { l: 0, r: 0, t: 0, b: 0 }
  const g = 17
  if (side === 'left') return { l: g, r: 0, t: 0, b: 0 }
  if (side === 'right') return { l: 0, r: g, t: 0, b: 0 }
  if (side === 'top') return { l: 0, r: 0, t: g, b: 0 }
  return { l: 0, r: 0, t: 0, b: g }
}

function hingePositionsPdf(layout: HingeLayoutPersisted | null): number[] | null {
  if (!layout) return null
  if (validateHingePositions(layout.side, layout.positionsMm)) return null
  return layout.positionsMm
}

function handleCentersPdf(h: HandleHolesPersisted | null, hingeLayout: HingeLayoutPersisted | null): number[] | null {
  if (!h) return null
  if (validateHandleHoles(h, hingeLayout)) return null
  return handleHoleCentersMm(h)
}

function pdfEdgePoint(
  side: HingeMountSide,
  posMm: number,
  W: number,
  H: number,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
): [number, number] {
  switch (side) {
    case 'left':
      return [ox, oy + (posMm / H) * dh]
    case 'right':
      return [ox + dw, oy + (posMm / H) * dh]
    case 'top':
      return [ox + (posMm / W) * dw, oy]
    default:
      return [ox + (posMm / W) * dw, oy + dh]
  }
}

function formatDimMmPdf(v: number): string {
  return `${Math.round(v)} мм`
}

/** Base64 TTF после первой успешной загрузки; `addFileToVFS` / `addFont` вызываются на каждом новом `jsPDF` (иначе кириллица ломается). */
let notoSansVfsBase64: string | null = null

const NOTO_SANS_FONT_URLS = [
  `${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf`,
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
] as const

let activePdfFont: 'NotoSans' | 'helvetica' = 'helvetica'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(binary)
}

async function ensureNotoSans(doc: jsPDF): Promise<void> {
  if (!notoSansVfsBase64) {
    let loaded: string | null = null
    for (const url of NOTO_SANS_FONT_URLS) {
      try {
        const res = await fetch(url, { mode: 'cors' })
        if (!res.ok) continue
        loaded = arrayBufferToBase64(await res.arrayBuffer())
        break
      } catch {
        continue
      }
    }
    if (!loaded) {
      activePdfFont = 'helvetica'
      doc.setFont('helvetica', 'normal')
      return
    }
    notoSansVfsBase64 = loaded
  }

  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansVfsBase64)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  activePdfFont = 'NotoSans'
  doc.setFont('NotoSans', 'normal')
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  const abs = resolveMediaUrl(url)
  if (!abs) return null
  try {
    const res = await fetch(abs, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function imgFmt(dataUrl: string): 'JPEG' | 'PNG' {
  return dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
}

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return [r, g, b]
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    if ([r, g, b].every((x) => Number.isFinite(x))) return [r, g, b]
  }
  return null
}

function formatMoney(n: number, currency: string): string {
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${currency}`
}

/** Страница 1: контакты и таблица-детализация (в духе коммерческого просчёта). */
async function buildSummaryPage(doc: jsPDF, calcNo: string, data: FrameClientPdfInput): Promise<void> {
  await ensureNotoSans(doc)
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Просчёт № ${calcNo}`, 14, 16)

  doc.setFontSize(14)
  doc.setTextColor(20, 20, 20)
  doc.text('Детализация заказа (фасады)', pageW / 2, 26, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(40, 40, 40)
  let y = 36
  const line = (label: string, val: string) => {
    doc.text(`${label}: ${val}`, 14, y)
    y += 5
  }
  line('Клиент', data.contact.name.trim() || '—')
  line('Телефон', data.contact.phone.trim() || '—')
  line('Email', data.contact.email.trim() || '—')
  if (data.contact.comment.trim()) {
    const split = doc.splitTextToSize(`Комментарий: ${data.contact.comment.trim()}`, pageW - 28)
    doc.text(split, 14, y)
    y += split.length * 5 + 2
  }
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Параметр', 'Значение']],
    body: [
      ['Профиль', data.frameTypeName],
      ['Цвет профиля', data.colorMaterial?.name ?? '—'],
      ['Высота фасада (мм)', String(data.heightMm)],
      ['Ширина фасада (мм)', String(data.widthMm)],
      ['Количество фасадов', String(data.facadeCount)],
    ],
    theme: 'grid',
    styles: { font: activePdfFont, fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: 'normal', font: activePdfFont },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: pageW - 28 - 58 },
    },
  })

  let finalY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 40) + 10

  doc.setFontSize(10)
  doc.setTextColor(35, 35, 35)
  doc.text('Присадка и петли', 14, finalY)
  finalY += 6

  autoTable(doc, {
    startY: finalY,
    head: [['Параметр', 'Значение']],
    body: [
      ['Присадка / источник петель', data.mortiseLine],
      ...(data.includeHingeLayoutRow ? [['Раскладка петель', data.hingeLayoutLine] as [string, string]] : []),
    ],
    theme: 'grid',
    styles: { font: activePdfFont, fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: 'normal', font: activePdfFont },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: pageW - 28 - 58 },
    },
  })

  finalY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? finalY + 20) + 10

  doc.text('Наполнение и ручка', 14, finalY)
  finalY += 6

  autoTable(doc, {
    startY: finalY,
    head: [['Параметр', 'Значение']],
    body: [
      ['Наполнение', data.fillingMaterial?.name ?? '—'],
      ['Ручка', data.handleLine],
    ],
    theme: 'grid',
    styles: { font: activePdfFont, fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: 'normal', font: activePdfFont },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: pageW - 28 - 58 },
    },
  })

  finalY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? finalY + 20) + 8

  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  if (data.currencyMismatch) {
    doc.text('Внимание: в конфигурации разные валюты — суммы ориентировочные.', 14, finalY)
  }

  autoTable(doc, {
    startY: finalY + (data.currencyMismatch ? 8 : 0),
    head: [['№', 'Профиль', 'Наполнение', 'Сопутствующие', 'Операции', 'Итого']],
    body: [
      [
        '1',
        formatMoney(data.breakdown.profile, data.currency),
        formatMoney(data.breakdown.filling, data.currency),
        formatMoney(data.breakdown.related, data.currency),
        formatMoney(data.breakdown.operations, data.currency),
        formatMoney(data.breakdown.total, data.currency),
      ],
    ],
    theme: 'striped',
    styles: { font: activePdfFont, fontSize: 9 },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: [20, 20, 20],
      fontStyle: 'normal',
      font: activePdfFont,
    },
  })

  const afterPrice =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? finalY + 30) + 6
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(
    '* Цена ориентировочная, без учёта доставки и монтажа. Уточняйте у менеджера.',
    14,
    afterPrice,
    { maxWidth: pageW - 28 },
  )
}

/** Страница фасада: как шаг 7 — пропорции эскиза, габариты, цепочки вдоль петель/ручки, маркеры отверстий. */
async function buildFacadePage(
  doc: jsPDF,
  calcNo: string,
  facadeIndex: number,
  data: FrameClientPdfInput,
): Promise<void> {
  await ensureNotoSans(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Просчёт № ${calcNo}`, margin, 16)

  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text(`Фасад ${facadeIndex}`, pageW / 2, 26, { align: 'center' })

  const W = data.widthMm
  const H = data.heightMm
  const innerW = Math.max(1, W - 2 * FRAME_INSET_MM)
  const innerH = Math.max(1, H - 2 * FRAME_INSET_MM)

  const hingePos = hingePositionsPdf(data.hingeLayout)
  const handleCenters = handleCentersPdf(data.handleHoles, data.hingeLayout)
  const handleSide = data.handleHoles?.side ?? 'left'
  const mainDimSide: HingeMountSide = data.hingeLayout?.side ?? handleSide
  const widthPos: 'top' | 'bottom' =
    mainDimSide === 'top' ? 'bottom' : mainDimSide === 'bottom' ? 'top' : 'top'
  const heightPos: 'left' | 'right' =
    mainDimSide === 'left' ? 'right' : mainDimSide === 'right' ? 'left' : 'left'

  const inh = pdfInsetForChainSide(data.hingeLayout && hingePos ? data.hingeLayout.side : null)
  const inb = pdfInsetForChainSide(data.handleHoles && handleCenters ? data.handleHoles.side : null)
  const insetL = margin + inh.l + inb.l + (heightPos === 'left' ? 12 : 0) + (widthPos === 'top' || widthPos === 'bottom' ? 0 : 0)
  const insetR = margin + inh.r + inb.r + (heightPos === 'right' ? 12 : 0)
  const insetT = 36 + inh.t + inb.t + (widthPos === 'top' ? 15 : 0)
  const insetB = margin + inh.b + inb.b + (widthPos === 'bottom' ? 15 : 0) + 12

  const drawAreaW = pageW - insetL - insetR
  const drawAreaH = pageH - insetT - insetB
  const aspectWh = facadePdfSketchAspect(W, H)
  const dh = Math.min(drawAreaH, drawAreaW / aspectWh, 1e6)
  const dw = aspectWh * dh
  const scaleX = dw / W
  const scaleY = dh / H
  const ox = insetL + (drawAreaW - dw) / 2
  const oy = insetT + (drawAreaH - dh) / 2

  const hingeEdgeL =
    data.hingeLayout && hingePos ? hingeEdgeLengthMm(data.hingeLayout.side, W, H) : null
  const hingeSegs =
    hingeEdgeL != null && hingePos && hingePos.length > 0
      ? pdfChainSegmentsWithNudge(edgeChainSegmentsMm(hingeEdgeL, hingePos))
      : []

  const handleEdgeL =
    data.handleHoles && handleCenters ? hingeEdgeLengthMm(data.handleHoles.side, W, H) : null
  const handleSegs =
    handleEdgeL != null && handleCenters && handleCenters.length > 0
      ? pdfChainSegmentsWithNudge(edgeChainSegmentsMm(handleEdgeL, handleCenters))
      : []

  const profileFill = hexToRgb(data.colorMaterial?.texture_color ?? '#b08d57') ?? [176, 141, 87]
  const glassFill = hexToRgb(data.fillingMaterial?.texture_color ?? '#d9d9d9') ?? [217, 217, 217]

  const profileImg = data.colorMaterial?.texture_image
    ? await loadImageDataUrl(data.colorMaterial.texture_image)
    : null
  const glassImg = data.fillingMaterial?.texture_image
    ? await loadImageDataUrl(data.fillingMaterial.texture_image)
    : null

  try {
    if (profileImg) {
      doc.addImage(profileImg, imgFmt(profileImg), ox, oy, dw, dh, undefined, 'FAST')
    } else {
      doc.setFillColor(profileFill[0], profileFill[1], profileFill[2])
      doc.rect(ox, oy, dw, dh, 'F')
    }
  } catch {
    doc.setFillColor(profileFill[0], profileFill[1], profileFill[2])
    doc.rect(ox, oy, dw, dh, 'F')
  }

  const ix = ox + FRAME_INSET_MM * scaleX
  const iy = oy + FRAME_INSET_MM * scaleY
  const idw = innerW * scaleX
  const idh = innerH * scaleY

  try {
    if (glassImg) {
      doc.addImage(glassImg, imgFmt(glassImg), ix, iy, idw, idh, undefined, 'FAST')
    } else {
      doc.setFillColor(glassFill[0], glassFill[1], glassFill[2])
      doc.rect(ix, iy, idw, idh, 'F')
    }
  } catch {
    doc.setFillColor(glassFill[0], glassFill[1], glassFill[2])
    doc.rect(ix, iy, idw, idh, 'F')
  }

  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.25)
  doc.rect(ox, oy, dw, dh, 'S')
  doc.rect(ix, iy, idw, idh, 'S')

  doc.setFontSize(6.5)
  doc.setTextColor(28, 28, 28)

  if (hingePos && data.hingeLayout) {
    const side = data.hingeLayout.side
    hingePos.forEach((posMm, i) => {
      const [px, py] = pdfEdgePoint(side, posMm, W, H, ox, oy, dw, dh)
      doc.setFillColor(10, 10, 12)
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.15)
      if (side === 'top' || side === 'bottom') {
        doc.rect(px - 2.4, py - (side === 'top' ? 0 : 2.4), 4.8, 2.4, 'FD')
      } else {
        doc.rect(px - (side === 'left' ? 0 : 2.4), py - 2.4, 2.4, 4.8, 'FD')
      }
      doc.setTextColor(255, 255, 255)
      const lx =
        side === 'left'
          ? px + 3.5
          : side === 'right'
            ? px - 3.5 - doc.getTextWidth(`№${i + 1}`)
            : px - doc.getTextWidth(`№${i + 1}`) / 2
      const ly =
        side === 'top'
          ? py + 4
          : side === 'bottom'
            ? py - 3
            : py + 1
      doc.text(`№${i + 1}`, lx, ly)
    })
  }

  if (handleCenters && data.handleHoles) {
    const side = data.handleHoles.side
    const dia = Math.min(4, Math.max(1.8, data.handleHoles.diameterMm * Math.min(scaleX, scaleY) * 0.35))
    handleCenters.forEach((posMm, i) => {
      const [px, py] = pdfEdgePoint(side, posMm, W, H, ox, oy, dw, dh)
      const first = i === 0
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(first ? 232 : 120, first ? 140 : 125, first ? 50 : 135)
      doc.setLineWidth(first ? 0.35 : 0.22)
      doc.circle(px, py, dia / 2, 'FD')
      doc.setTextColor(40, 40, 45)
      const lx =
        side === 'left'
          ? px + dia / 2 + 1.5
          : side === 'right'
            ? px - dia / 2 - 1.5 - doc.getTextWidth(`№${i + 1}`)
            : px - doc.getTextWidth(`№${i + 1}`) / 2
      const ly =
        side === 'top'
          ? py + dia / 2 + 3
          : side === 'bottom'
            ? py - dia / 2 - 1.5
            : py + 1
      doc.text(`№${i + 1}`, lx, ly)
    })
  }

  doc.setDrawColor(38, 38, 42)
  doc.setLineWidth(0.2)
  doc.setFontSize(7)
  doc.setTextColor(32, 32, 36)

  const drawVertChain = (
    segments: (EdgeChainSegmentMm & { nudgeMm: number })[],
    edge: 'left' | 'right',
  ) => {
    if (segments.length === 0) return
    const flip = edge === 'left'
    for (const seg of segments) {
      const y1 = oy + (seg.t0 / 100) * dh
      const y2 = oy + (seg.t1 / 100) * dh
      const base = PDF_CHAIN_BASE_MM + seg.nudgeMm
      const xDim = flip ? ox - base : ox + dw + base
      doc.line(ox + (flip ? 0 : dw), y1, xDim, y1)
      doc.line(ox + (flip ? 0 : dw), y2, xDim, y2)
      doc.line(xDim, y1, xDim, y2)
      const label = formatDimMmPdf(seg.valueMm)
      const ly = (y1 + y2) / 2
      const lx = flip ? xDim - 2.2 : xDim + 2.2
      doc.text(label, lx, ly, { angle: 90, align: 'center' })
    }
  }

  const drawHorizChain = (
    segments: (EdgeChainSegmentMm & { nudgeMm: number })[],
    edge: 'top' | 'bottom',
  ) => {
    if (segments.length === 0) return
    const flip = edge === 'top'
    for (const seg of segments) {
      const x1b = ox + (seg.t0 / 100) * dw
      const x2b = ox + (seg.t1 / 100) * dw
      const base = PDF_CHAIN_BASE_MM + seg.nudgeMm
      const yDim = flip ? oy - base : oy + dh + base
      doc.line(x1b, oy + (flip ? 0 : dh), x1b, yDim)
      doc.line(x2b, oy + (flip ? 0 : dh), x2b, yDim)
      doc.line(x1b, yDim, x2b, yDim)
      doc.text(formatDimMmPdf(seg.valueMm), (x1b + x2b) / 2, flip ? yDim - 2 : yDim + 4, {
        align: 'center',
      })
    }
  }

  if (data.hingeLayout && hingeSegs.length > 0) {
    const es = data.hingeLayout.side
    if (es === 'left' || es === 'right') drawVertChain(hingeSegs, es)
    else drawHorizChain(hingeSegs, es)
  }

  if (data.handleHoles && handleSegs.length > 0) {
    const es = data.handleHoles.side
    if (es === 'left' || es === 'right') drawVertChain(handleSegs, es)
    else drawHorizChain(handleSegs, es)
  }

  doc.setDrawColor(22, 22, 26)
  doc.setLineWidth(0.28)
  doc.setFontSize(8)
  doc.setTextColor(22, 22, 26)

  if (widthPos === 'top') {
    const yDim = oy - PDF_MAIN_DIM_GAP_MM
    doc.line(ox, oy, ox, yDim)
    doc.line(ox + dw, oy, ox + dw, yDim)
    doc.line(ox, yDim, ox + dw, yDim)
    doc.text(`${W} мм`, ox + dw / 2, yDim - 2, { align: 'center' })
  } else {
    const yDim = oy + dh + PDF_MAIN_DIM_GAP_MM
    doc.line(ox, oy + dh, ox, yDim)
    doc.line(ox + dw, oy + dh, ox + dw, yDim)
    doc.line(ox, yDim, ox + dw, yDim)
    doc.text(`${W} мм`, ox + dw / 2, yDim + 4, { align: 'center' })
  }

  if (heightPos === 'left') {
    const xDim = ox - PDF_MAIN_DIM_GAP_MM
    doc.line(ox, oy, xDim, oy)
    doc.line(ox, oy + dh, xDim, oy + dh)
    doc.line(xDim, oy, xDim, oy + dh)
    doc.text(`${H} мм`, xDim - 2, oy + dh / 2, { angle: 90, align: 'center' })
  } else {
    const xDim = ox + dw + PDF_MAIN_DIM_GAP_MM
    doc.line(ox + dw, oy, xDim, oy)
    doc.line(ox + dw, oy + dh, xDim, oy + dh)
    doc.line(xDim, oy, xDim, oy + dh)
    doc.text(`${H} мм`, xDim + 2, oy + dh / 2, { angle: 90, align: 'center' })
  }

  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  const legend: string[] = [
    `Внутреннее поле наполнения (условно): ${innerW} × ${innerH} мм (вылет рамы ${FRAME_INSET_MM} мм с каждой стороны).`,
  ]
  if (data.handleHoles && handleCenters) {
    legend.push(
      `Отверстия под ручку: Ø${data.handleHoles.diameterMm} мм${data.handleHoles.bushings ? ', втулки' : ''}.`,
    )
  }
  const foot = legend.join(' ')
  doc.text(foot, margin, pageH - margin - 4, { maxWidth: pageW - 2 * margin })
}

/** Предзагрузка шрифта с CDN, чтобы при нажатии «PDF» меньше терять «user gesture» из‑за await fetch. */
export async function preloadFramePdfFont(): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  await ensureNotoSans(doc)
}

/** Собирает PDF в память. Для показа во вкладке: синхронно открыть `about:blank`, затем после await назначить `win.location.href` на `URL.createObjectURL(blob)` — см. шаг 8 калькулятора. */
export async function buildFrameClientPdfBlob(data: FrameClientPdfInput): Promise<{ blob: Blob; filename: string }> {
  const calcNo = String(1000 + Math.floor(Math.random() * 9000))
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  await buildSummaryPage(doc, calcNo, data)

  const n = Math.max(1, Math.floor(data.facadeCount))
  for (let i = 1; i <= n; i++) {
    doc.addPage()
    await buildFacadePage(doc, calcNo, i, data)
  }

  const safeName = `furnitech-proschet-${calcNo}.pdf`
  const blob = doc.output('blob')
  return { blob, filename: safeName }
}
