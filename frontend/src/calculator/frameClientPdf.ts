import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import type { Material } from '../types'
import {
  type HandleHolesPersisted,
  type HingeLayoutPersisted,
  type HingeMountSide,
  handleHoleCentersMm,
  hingeEdgeLengthMm,
  validateHandleHoles,
  validateHingePositions,
} from './frameCalcSession'
import {
  computeHingeChainDims,
  layoutHingeChainDimsWithNudge,
  sketchMainDimPlacement,
  type HingeChainDimSegmentLayout,
} from './hingeChainSketchDims'
import { materialTextureLabel, sketchFillingLine } from './materialTextureLabel'
import { resolveMediaUrl } from './sketchFrame'

export type FrameClientPdfBreakdown = {
  profile: number
  filling: number
  related: number
  total: number
}

export type FrameClientPdfInput = {
  contact: { name: string; phone: string; email: string; comment: string }
  frameTypeName: string
  /** Имя типа наполнения (как в каталоге шага 4). */
  fillingTypeName?: string
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

/** Эскиз на странице фасада — на 30% меньше максимально возможного (больше места под размеры). */
const PDF_SKETCH_SIZE_FACTOR = 0.7

/** Аналог `--frame3-chain-sketch-gap` (30px) в мм на листе A4. */
const PDF_CHAIN_SKETCH_GAP_MM = 11
/** Аналог `HINGE_TRACK_STEP_PX` (26px) — ступень дорожки для петель №2+. */
const PDF_CHAIN_TRACK_STEP_MM = 7
/** Аналог `--frame3-dim-sketch-gap-y/x` (15/14px после −50%) для габаритов H×W. */
const PDF_MAIN_DIM_GAP_MM = 5
/** Перевод nudge из px (эскиз) в мм (PDF). */
const PDF_PX_TO_MM = 2.6 / 12

const HINGE_TRACK_STEP_PX = 26

function pdfTrackOffsetMm(trackOffsetPx: number): number {
  return (trackOffsetPx / HINGE_TRACK_STEP_PX) * PDF_CHAIN_TRACK_STEP_MM
}

function pdfInsetForChainSide(
  side: HingeMountSide | undefined | null,
  segments: HingeChainDimSegmentLayout[],
): { l: number; r: number; t: number; b: number } {
  if (!side || segments.length === 0) return { l: 0, r: 0, t: 0, b: 0 }
  const maxTrack = Math.max(0, ...segments.map((s) => pdfTrackOffsetMm(s.trackOffsetPx)))
  const g = PDF_CHAIN_SKETCH_GAP_MM + maxTrack + PDF_CHAIN_TRACK_STEP_MM + 5
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

/** Сегодняшняя дата DD.MM.YYYY (локаль ru-RU). */
function todayDateRu(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${dd}.${mm}.${yyyy}`
}

function sideHumanLabel(side: HingeMountSide): { letter: 'L' | 'R' | 'T' | 'B'; label: string } {
  switch (side) {
    case 'left':
      return { letter: 'L', label: 'левая' }
    case 'right':
      return { letter: 'R', label: 'правая' }
    case 'top':
      return { letter: 'T', label: 'верхняя' }
    default:
      return { letter: 'B', label: 'нижняя' }
  }
}

/** Тянем «Производителя петли» из строки `mortiseLine` (как формируется в Step8FrameResult). */
function extractHingeManufacturer(mortiseLine: string): string {
  const s = String(mortiseLine ?? '').trim()
  if (!s || s === '—') return ''
  if (/Петли заказчика/i.test(s)) return 'Заказчика'
  if (/не выбраны/i.test(s)) return ''
  if (/Не требуется/i.test(s)) return ''
  /** `${typeName} — ${textureLabel}` → берём левую часть до тире. */
  const dash = s.split(/[—–-]/)
  return (dash[0] ?? s).trim()
}

/** Base64 TTF после первой успешной загрузки; `addFileToVFS` / `addFont` вызываются на каждом новом `jsPDF` (иначе кириллица ломается). */
let notoSansVfsBase64: string | null = null
let notoSansBoldVfsBase64: string | null = null

const NOTO_SANS_FONT_URLS = [
  `${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf`,
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
] as const
const NOTO_SANS_BOLD_FONT_URLS = [
  `${import.meta.env.BASE_URL}fonts/NotoSans-Bold.ttf`,
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Bold.ttf',
] as const

let activePdfFont: 'NotoSans' | 'helvetica' = 'helvetica'
let activeBoldRegistered = false

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(binary)
}

async function loadFontBase64(urls: readonly string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) continue
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.toLowerCase().includes('text/html')) continue
      return arrayBufferToBase64(await res.arrayBuffer())
    } catch {
      continue
    }
  }
  return null
}

async function ensureNotoSans(doc: jsPDF): Promise<void> {
  if (!notoSansVfsBase64) {
    const loaded = await loadFontBase64(NOTO_SANS_FONT_URLS)
    if (!loaded) {
      activePdfFont = 'helvetica'
      activeBoldRegistered = false
      doc.setFont('helvetica', 'normal')
      return
    }
    notoSansVfsBase64 = loaded
  }
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansVfsBase64)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')

  if (!notoSansBoldVfsBase64) {
    notoSansBoldVfsBase64 = await loadFontBase64(NOTO_SANS_BOLD_FONT_URLS)
  }
  if (notoSansBoldVfsBase64) {
    try {
      doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldVfsBase64)
      doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
      activeBoldRegistered = true
    } catch {
      notoSansBoldVfsBase64 = null
      activeBoldRegistered = false
    }
  } else {
    activeBoldRegistered = false
  }

  activePdfFont = 'NotoSans'
  doc.setFont('NotoSans', 'normal')
}

/** Безопасно переключиться на жирный шрифт: используем bold только если он зарегистрирован. */
function setBoldFont(doc: jsPDF): void {
  if (activePdfFont === 'NotoSans' && activeBoldRegistered) {
    doc.setFont('NotoSans', 'bold')
  } else if (activePdfFont === 'NotoSans') {
    doc.setFont('NotoSans', 'normal')
  } else {
    doc.setFont('helvetica', 'bold')
  }
}

function setRegularFont(doc: jsPDF): void {
  doc.setFont(activePdfFont, 'normal')
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

/**
 * Страница 1: «Бланк на изготовление алюминиевых фасадов» — авто-заполнение полей
 * заказчика/заказа из калькулятора, профиль/наполнение/габариты, петли/ручка,
 * комментарий и блок цены. По стилю — как бумажная форма-бланк цеха.
 */
async function buildBlankPage(doc: jsPDF, calcNo: string, data: FrameClientPdfInput): Promise<void> {
  await ensureNotoSans(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - 2 * margin
  /** Нижний блок: сноска + две строки подписей — всегда на том же листе. */
  const sigLine1Y = pageH - margin - 12
  const sigLine2Y = pageH - margin - 5
  const footnoteY = sigLine1Y - 5
  const labelColW = 46
  const valueColW = 68
  const formTableW = labelColW + valueColW
  const formTableFontSize = 8
  const formTableCellPad = 1.2
  const topY = 14

  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Бланк на изготовление алюминиевых фасадов`, margin, topY + 2)

  setBoldFont(doc)
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text('ФУРНИТЕХ', pageW - margin, topY + 2, { align: 'right' })
  setRegularFont(doc)

  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.4)
  doc.line(margin, topY + 5, pageW - margin, topY + 5)

  setBoldFont(doc)
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text('Бланк на изготовление алюминиевых фасадов', pageW / 2, topY + 12, { align: 'center' })
  setRegularFont(doc)

  let y = topY + 18
  const formBlockStartY = y

  const drawSectionTable = (rows: Array<[string, string]>, opts?: { startY?: number }) => {
    autoTable(doc, {
      startY: opts?.startY ?? y,
      body: rows,
      theme: 'grid',
      tableWidth: formTableW,
      styles: {
        font: activePdfFont,
        fontSize: formTableFontSize,
        cellPadding: formTableCellPad,
        textColor: [25, 25, 25],
        lineColor: [60, 60, 60],
        lineWidth: 0.2,
        overflow: 'linebreak',
        valign: 'middle',
      },
      columnStyles: {
        0: {
          cellWidth: labelColW,
          fillColor: [240, 240, 240],
          fontStyle: 'normal',
          textColor: [60, 60, 60],
        },
        1: { cellWidth: valueColW, fontStyle: 'normal' },
      },
      margin: { left: margin, right: pageW - margin - formTableW },
    })
    y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 3
  }

  drawSectionTable([
    ['Заказ №', String(calcNo)],
    ['Заказчик', data.contact.name.trim() || '—'],
    ['Телефон', data.contact.phone.trim() || '—'],
    ['Email', data.contact.email.trim() || '—'],
    ['Дата приёма', todayDateRu()],
    ['Дата готовности', ''],
  ])

  drawSectionTable([
    ['Тип профиля', data.frameTypeName || '—'],
    ['Цвет профиля', materialTextureLabel(data.colorMaterial)],
    ['Наполнение', sketchFillingLine(data.fillingTypeName, data.fillingMaterial)],
  ])

  drawSectionTable([
    ['Высота фасада, мм', String(data.heightMm)],
    ['Ширина фасада, мм', String(data.widthMm)],
    ['Кол-во, шт.', String(data.facadeCount)],
  ])

  const hingeRows: Array<[string, string]> = []
  if (data.hingeLayout) {
    const sideInfo = sideHumanLabel(data.hingeLayout.side)
    hingeRows.push([
      `Количество фасадов ${sideInfo.letter} — ${sideInfo.label} (сторона петель)`,
      String(data.facadeCount),
    ])
  } else {
    hingeRows.push(['Количество фасадов (сторона петель)', String(data.facadeCount)])
  }
  hingeRows.push(['Производитель петли', extractHingeManufacturer(data.mortiseLine) || '—'])
  hingeRows.push(['Тип открывания', ''])
  hingeRows.push(['Механизм открывания', ''])
  if (data.includeHingeLayoutRow) {
    hingeRows.push(['Раскладка петель', data.hingeLayoutLine])
  }
  hingeRows.push(['Ручка', data.handleLine])

  drawSectionTable(hingeRows)

  const comment = data.contact.comment.trim()
  if (comment) {
    drawSectionTable([['Комментарий', comment]])
  } else {
    drawSectionTable([['Комментарий', '']])
  }

  const formBlockEndY = y
  const sketchGap = 8
  const sketchX = margin + formTableW + sketchGap
  const sketchY = formBlockStartY
  const sketchW = pageW - margin - sketchX
  const sketchH = Math.max(48, formBlockEndY - formBlockStartY)
  setRegularFont(doc)
  doc.setFontSize(7)
  doc.setTextColor(110, 110, 110)
  doc.text('Эскиз (примерный)', sketchX + sketchW / 2, sketchY - 1.5, { align: 'center' })
  await drawFacadeSketchInArea(
    doc,
    data,
    { x: sketchX, y: sketchY, w: sketchW, h: sketchH },
    {
      showDimensionChains: false,
      showInfoOverlay: true,
      showMainDimensions: true,
      sizeFactor: 1,
    },
  )

  y = Math.max(y, sketchY + sketchH) + 4
  const costTitleY = Math.min(y + 2, footnoteY - 18)
  setBoldFont(doc)
  doc.setFontSize(9)
  doc.setTextColor(35, 35, 35)
  doc.text('Стоимость изготовления (фасады)*', margin, costTitleY)
  setRegularFont(doc)
  let costY = costTitleY + 5

  if (data.currencyMismatch && costY < footnoteY - 10) {
    doc.setFontSize(8)
    doc.setTextColor(120, 80, 0)
    doc.text('Внимание: в конфигурации разные валюты — суммы ориентировочные.', margin, costY)
    costY += 3.5
  }

  autoTable(doc, {
    startY: costY,
    head: [['№', 'Профиль', 'Наполнение', 'Сопутствующие', 'Итого']],
    body: [
      [
        '1',
        formatMoney(data.breakdown.profile, data.currency),
        formatMoney(data.breakdown.filling, data.currency),
        formatMoney(data.breakdown.related, data.currency),
        formatMoney(data.breakdown.total, data.currency),
      ],
    ],
    theme: 'grid',
    styles: { font: activePdfFont, fontSize: 8, cellPadding: 1.2, lineColor: [60, 60, 60], lineWidth: 0.2 },
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [20, 20, 20],
      fontStyle: 'normal',
      font: activePdfFont,
      fontSize: 8,
    },
    margin: { left: margin, right: margin },
    tableWidth: contentW,
  })

  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  doc.text(
    '* Цена ориентировочная, без учёта доставки и монтажа. Уточняйте у менеджера.',
    margin,
    footnoteY,
    { maxWidth: contentW },
  )

  doc.setDrawColor(80, 80, 80)
  doc.setLineWidth(0.2)
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  const sigGap = contentW / 2 - 6
  doc.text('Оплату принял', margin, sigLine1Y)
  doc.line(margin + 28, sigLine1Y + 0.6, margin + sigGap, sigLine1Y + 0.6)
  doc.text('Дата', margin + sigGap + 6, sigLine1Y)
  doc.line(margin + sigGap + 14, sigLine1Y + 0.6, pageW - margin, sigLine1Y + 0.6)
  doc.text('Товар получен, претензий к внешнему виду не имею', margin, sigLine2Y)
  doc.line(margin + 78, sigLine2Y + 0.6, pageW - margin, sigLine2Y + 0.6)
}

/** Эскиз страницы фасада: рисует «sketch-sheet»-карточку (как в Step7) поверх рамы. */
function drawSketchInfoOverlay(
  doc: jsPDF,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
  data: FrameClientPdfInput,
): void {
  /** Как `.sketch-sheet { inset: 16% 10% }`: внутренняя «бумага» с подписями. */
  const insetX = dw * 0.1
  const insetY = dh * 0.16
  const sx = ox + insetX
  const sy = oy + insetY
  const sw = dw - 2 * insetX
  const sh = dh - 2 * insetY
  if (sw <= 6 || sh <= 10) return

  /** Полупрозрачная белая подложка, чтобы текст читался поверх заливки. */
  doc.setFillColor(255, 255, 255)
  if (typeof (doc as unknown as { setGState?: unknown }).setGState === 'function') {
    try {
      const gs = (doc as unknown as { GState: (o: { opacity?: number }) => unknown; setGState: (g: unknown) => void })
      const layer = gs.GState({ opacity: 0.85 })
      gs.setGState(layer)
      doc.rect(sx, sy, sw, sh, 'F')
      const reset = gs.GState({ opacity: 1 })
      gs.setGState(reset)
    } catch {
      doc.rect(sx, sy, sw, sh, 'F')
    }
  } else {
    doc.rect(sx, sy, sw, sh, 'F')
  }

  setBoldFont(doc)
  doc.setTextColor(15, 15, 15)
  const titleFs = Math.max(6, Math.min(10, sw / 22))
  doc.setFontSize(titleFs)
  doc.text('ЛИЦЕВАЯ СТОРОНА ФАСАДА', sx + sw / 2, sy + 5, { align: 'center', maxWidth: sw - 2 })

  setRegularFont(doc)
  doc.setTextColor(60, 60, 60)
  const subFs = Math.max(5.5, Math.min(8, sw / 30))
  doc.setFontSize(subFs)
  doc.text('Визуализация примерная', sx + sw / 2, sy + 5 + titleFs * 0.6, {
    align: 'center',
    maxWidth: sw - 2,
  })

  const rows: Array<[string, string]> = [
    ['Профиль', data.frameTypeName || '—'],
    ['Цвет', materialTextureLabel(data.colorMaterial)],
    ['В × Ш (мм)', `${data.heightMm} × ${data.widthMm}`],
    ['Наполнение', sketchFillingLine(data.fillingTypeName, data.fillingMaterial)],
  ]

  const tableTop = sy + 5 + titleFs * 0.6 + subFs * 1.4 + 1
  if (tableTop >= sy + sh - 3) return

  const tableFs = Math.max(5.5, Math.min(7.5, sw / 36))
  const rowH = tableFs * 1.4
  /** Линия сверху таблички — как `border-top` в Step2FrameFacade.css. */
  doc.setDrawColor(140, 140, 140)
  doc.setLineWidth(0.15)
  doc.line(sx + 3, tableTop, sx + sw - 3, tableTop)
  doc.setFontSize(tableFs)
  let rowY = tableTop + 2
  const keyX = sx + 3
  const valX = sx + sw * 0.4
  for (const [k, v] of rows) {
    if (rowY > sy + sh - 1) break
    doc.setTextColor(50, 50, 50)
    setRegularFont(doc)
    doc.text(k, keyX, rowY + tableFs * 0.6)
    setBoldFont(doc)
    doc.setTextColor(15, 15, 15)
    const valWrap = doc.splitTextToSize(v, sw - (sx + sw * 0.4 - keyX) - 4)
    doc.text(valWrap as string[], valX, rowY + tableFs * 0.6)
    setRegularFont(doc)
    const linesUsed = Array.isArray(valWrap) ? Math.max(1, valWrap.length) : 1
    rowY += rowH * linesUsed * 0.9
  }
}

type PdfSketchArea = { x: number; y: number; w: number; h: number }

type DrawFacadeSketchOpts = {
  showDimensionChains?: boolean
  showInfoOverlay?: boolean
  showMainDimensions?: boolean
  sizeFactor?: number
  pageLegend?: { margin: number; pageH: number; pageW: number }
}

/** Эскиз фасада в заданном прямоугольнике (бланк справа или страница фасада). */
async function drawFacadeSketchInArea(
  doc: jsPDF,
  data: FrameClientPdfInput,
  area: PdfSketchArea,
  opts: DrawFacadeSketchOpts = {},
): Promise<void> {
  const showDimensionChains = opts.showDimensionChains ?? true
  const showInfoOverlay = opts.showInfoOverlay ?? true
  const showMainDimensions = opts.showMainDimensions ?? true
  const sizeFactor = opts.sizeFactor ?? PDF_SKETCH_SIZE_FACTOR

  const W = data.widthMm
  const H = data.heightMm
  const innerW = Math.max(1, W - 2 * FRAME_INSET_MM)
  const innerH = Math.max(1, H - 2 * FRAME_INSET_MM)

  const hingePos = hingePositionsPdf(data.hingeLayout)
  const handleCenters = handleCentersPdf(data.handleHoles, data.hingeLayout)

  const hingeEdgeL =
    data.hingeLayout && hingePos ? hingeEdgeLengthMm(data.hingeLayout.side, W, H) : null
  const hingeSegs =
    hingeEdgeL != null && hingePos && hingePos.length > 0
      ? layoutHingeChainDimsWithNudge(
          computeHingeChainDims(hingeEdgeL, hingePos, 'hinge-dim'),
          data.hingeLayout!.side,
        )
      : []

  const handleEdgeL =
    data.handleHoles && handleCenters ? hingeEdgeLengthMm(data.handleHoles.side, W, H) : null
  const handleSegs =
    handleEdgeL != null && handleCenters && handleCenters.length > 0
      ? layoutHingeChainDimsWithNudge(
          computeHingeChainDims(handleEdgeL, handleCenters, 'handle-dim'),
          data.handleHoles!.side,
        )
      : []

  const chainSides: HingeMountSide[] = []
  if (data.hingeLayout && hingePos) chainSides.push(data.hingeLayout.side)
  if (data.handleHoles && handleCenters) chainSides.push(data.handleHoles.side)
  const { widthPos, heightPos } = sketchMainDimPlacement(chainSides)

  const inh = showDimensionChains
    ? pdfInsetForChainSide(data.hingeLayout && hingePos ? data.hingeLayout.side : null, hingeSegs)
    : { l: 0, r: 0, t: 0, b: 0 }
  const inb = showDimensionChains
    ? pdfInsetForChainSide(data.handleHoles && handleCenters ? data.handleHoles.side : null, handleSegs)
    : { l: 0, r: 0, t: 0, b: 0 }

  const padInner = showDimensionChains ? 0 : 4
  const mainDimReserve = showMainDimensions ? 12 : 0
  const leftExtra =
    padInner + inh.l + inb.l + (showMainDimensions && heightPos === 'left' ? mainDimReserve : 0)
  const rightExtra =
    padInner + inh.r + inb.r + (showMainDimensions && heightPos === 'right' ? mainDimReserve : 0)
  const topExtra =
    padInner + inh.t + inb.t + (showMainDimensions && widthPos === 'top' ? mainDimReserve : 0)
  const bottomExtra =
    padInner + inh.b + inb.b + (showMainDimensions && widthPos === 'bottom' ? mainDimReserve : 0)

  const drawAreaW = Math.max(8, area.w - leftExtra - rightExtra)
  const drawAreaH = Math.max(8, area.h - topExtra - bottomExtra)
  const insetL = area.x + leftExtra
  const insetT = area.y + topExtra

  const aspectWh = facadePdfSketchAspect(W, H)
  const dh = Math.min(drawAreaH, drawAreaW / aspectWh, 1e6) * sizeFactor
  const dw = aspectWh * dh
  const scaleX = dw / W
  const scaleY = dh / H
  const ox = insetL + (drawAreaW - dw) / 2
  const oy = insetT + (drawAreaH - dh) / 2

  const profileFill = hexToRgb(data.colorMaterial?.texture_color ?? '#b08d57') ?? [176, 141, 87]
  const glassFill = hexToRgb(data.fillingMaterial?.texture_color ?? '#d9d9d9') ?? [217, 217, 217]

  const profileImg = data.colorMaterial?.texture_image
    ? await loadImageDataUrl(data.colorMaterial.texture_image)
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

  doc.setFillColor(glassFill[0], glassFill[1], glassFill[2])
  doc.rect(ix, iy, idw, idh, 'F')

  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.25)
  doc.rect(ox, oy, dw, dh, 'S')
  doc.rect(ix, iy, idw, idh, 'S')

  if (showInfoOverlay) {
    drawSketchInfoOverlay(doc, ox, oy, dw, dh, data)
  }

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
        side === 'top' ? py + 4 : side === 'bottom' ? py - 3 : py + 1
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

  if (showDimensionChains) {
    doc.setDrawColor(38, 38, 42)
    doc.setLineWidth(0.2)
    doc.setFontSize(7)
    doc.setTextColor(32, 32, 36)

    const drawVertChain = (segments: HingeChainDimSegmentLayout[], edge: 'left' | 'right') => {
      if (segments.length === 0) return
      const flip = edge === 'left'
      for (const seg of segments) {
        const y1 = oy + (seg.trackTopPct / 100) * dh
        const y2 = oy + ((seg.trackTopPct + seg.trackSpanPct) / 100) * dh
        const nudgeOut = (flip ? -seg.nudgeX : seg.nudgeX) * PDF_PX_TO_MM
        const base = PDF_CHAIN_SKETCH_GAP_MM + pdfTrackOffsetMm(seg.trackOffsetPx) + Math.abs(nudgeOut)
        const xDim = flip ? ox - base : ox + dw + base
        doc.line(ox + (flip ? 0 : dw), y1, xDim, y1)
        doc.line(ox + (flip ? 0 : dw), y2, xDim, y2)
        doc.line(xDim, y1, xDim, y2)
        doc.text(formatDimMmPdf(seg.valueMm), flip ? xDim - 2 : xDim + 2, (y1 + y2) / 2, {
          angle: 90,
          align: 'center',
        })
      }
    }

    const drawHorizChain = (segments: HingeChainDimSegmentLayout[], edge: 'top' | 'bottom') => {
      if (segments.length === 0) return
      const flip = edge === 'top'
      for (const seg of segments) {
        const x1b = ox + (seg.trackTopPct / 100) * dw
        const x2b = ox + ((seg.trackTopPct + seg.trackSpanPct) / 100) * dw
        const nudgeOut = (flip ? -seg.nudgeY : seg.nudgeY) * PDF_PX_TO_MM
        const base = PDF_CHAIN_SKETCH_GAP_MM + pdfTrackOffsetMm(seg.trackOffsetPx) + Math.abs(nudgeOut)
        const yDim = flip ? oy - base : oy + dh + base
        doc.line(x1b, oy + (flip ? 0 : dh), x1b, yDim)
        doc.line(x2b, oy + (flip ? 0 : dh), x2b, yDim)
        doc.line(x1b, yDim, x2b, yDim)
        doc.text(formatDimMmPdf(seg.valueMm), (x1b + x2b) / 2, flip ? yDim - 2.5 : yDim + 3.5, {
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
  }

  if (showMainDimensions) {
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
  }

  if (opts.pageLegend) {
    const { margin, pageH, pageW } = opts.pageLegend
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
    doc.text(legend.join(' '), margin, pageH - margin - 4, { maxWidth: pageW - 2 * margin })
  }
}

const PDF_DOC_OPTS = { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }

/** Предзагрузка шрифта с CDN, чтобы при нажатии «PDF» меньше терять «user gesture» из‑за await fetch. */
export async function preloadFramePdfFont(): Promise<void> {
  const doc = new jsPDF(PDF_DOC_OPTS)
  await ensureNotoSans(doc)
}

/** Собирает PDF в память. Для показа во вкладке: синхронно открыть `about:blank`, затем после await назначить `win.location.href` на `URL.createObjectURL(blob)` — см. шаг 8 калькулятора. */
export async function buildFrameClientPdfBlob(data: FrameClientPdfInput): Promise<{ blob: Blob; filename: string }> {
  const calcNo = String(1000 + Math.floor(Math.random() * 9000))
  const doc = new jsPDF({ ...PDF_DOC_OPTS, compress: true })

  await buildBlankPage(doc, calcNo, data)

  const safeName = `furnitech-zakaz-${calcNo}.pdf`
  const blob = doc.output('blob')
  return { blob, filename: safeName }
}
