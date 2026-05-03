import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import type { Material } from '../types'
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
}

/** Оценочная толщина видимой рамки на чертеже (мм): подписи как отступ от края фасада до «стекла». */
const FRAME_INSET_MM = 5

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
      ['Раскладка петель', data.hingeLayoutLine],
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

/** Страница фасада: чертёж с габаритами и превью текстур (упрощённо). */
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

  const drawAreaW = pageW - 2 * margin
  const drawAreaH = pageH - 52 - margin
  const scale = Math.min(drawAreaW / W, drawAreaH / H)
  const dw = W * scale
  const dh = H * scale
  const ox = margin + (drawAreaW - dw) / 2
  const oy = 36 + (drawAreaH - dh) / 2

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

  const ix = ox + FRAME_INSET_MM * scale
  const iy = oy + FRAME_INSET_MM * scale
  const idw = innerW * scale
  const idh = innerH * scale

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

  doc.setFontSize(8)
  doc.setTextColor(30, 30, 30)

  const dimY = oy - 5
  doc.line(ox, dimY, ox + dw, dimY)
  doc.line(ox, dimY - 2, ox, dimY + 2)
  doc.line(ox + dw, dimY - 2, ox + dw, dimY + 2)
  doc.text(`${W} мм`, ox + dw / 2, dimY - 2, { align: 'center' })

  const dimX = ox + dw + 6
  doc.line(dimX, oy, dimX, oy + dh)
  doc.line(dimX - 2, oy, dimX + 2, oy)
  doc.line(dimX - 2, oy + dh, dimX + 2, oy + dh)
  doc.text(`${H} мм`, dimX + 6, oy + dh / 2, { angle: 90, align: 'center' })

  const dimInnerY = oy + dh + 6
  doc.line(ox, dimInnerY, ox, dimInnerY + 4)
  doc.text(`${FRAME_INSET_MM} мм`, ox + 3, dimInnerY + 8)

  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  doc.text(
    `Внутреннее поле наполнения (условно): ${innerW} × ${innerH} мм (вылет рамы ${FRAME_INSET_MM} мм с каждой стороны).`,
    margin,
    pageH - margin - 4,
    { maxWidth: pageW - 2 * margin },
  )
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
