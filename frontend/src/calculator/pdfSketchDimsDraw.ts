import type { jsPDF } from 'jspdf'
import {
  formatSketchDimMm,
  HINGE_DIM_NARROW_SPAN_PCT,
  type HingeChainDimSegmentLayout,
} from './hingeChainSketchDims'

/** Высота эскиза в UI (~px) → перевод CSS-зазоров в мм на PDF. */
const REF_SKETCH_HEIGHT_PX = 250

const DIM_GAP_Y_PX = 15
const DIM_GAP_X_PX = 14
const CHAIN_GAP_PX = 30
const LABEL_GAP_PX = 8
const VTRACK_PX = 34
const HINGE_TRACK_STEP_PX = 26

export function pdfSketchMmPerPx(sketchHeightMm: number): number {
  return sketchHeightMm / REF_SKETCH_HEIGHT_PX
}

function px(sketchHeightMm: number, cssPx: number): number {
  return cssPx * pdfSketchMmPerPx(sketchHeightMm)
}

function pdfTrackOffsetMm(trackOffsetPx: number, sketchHeightMm: number): number {
  return (trackOffsetPx / HINGE_TRACK_STEP_PX) * px(sketchHeightMm, HINGE_TRACK_STEP_PX)
}

function setDimSolid(doc: jsPDF): void {
  doc.setDrawColor(38, 38, 42)
  doc.setLineWidth(0.22)
  doc.setLineDashPattern([], 0)
}

function setWitnessDashed(doc: jsPDF): void {
  doc.setDrawColor(120, 120, 125)
  doc.setLineWidth(0.15)
  doc.setLineDashPattern([1.2, 1.2], 0)
}

function pdfArrow(
  doc: jsPDF,
  tipX: number,
  tipY: number,
  dir: 'n' | 's' | 'e' | 'w',
  sizeMm: number,
): void {
  const h = sizeMm * 0.55
  const w = sizeMm
  let pts: [number, number][]
  switch (dir) {
    case 'n':
      pts = [
        [tipX, tipY],
        [tipX - w / 2, tipY + h],
        [tipX + w / 2, tipY + h],
      ]
      break
    case 's':
      pts = [
        [tipX, tipY],
        [tipX - w / 2, tipY - h],
        [tipX + w / 2, tipY - h],
      ]
      break
    case 'e':
      pts = [
        [tipX, tipY],
        [tipX - h, tipY - w / 2],
        [tipX - h, tipY + w / 2],
      ]
      break
    default:
      pts = [
        [tipX, tipY],
        [tipX + h, tipY - w / 2],
        [tipX + h, tipY + w / 2],
      ]
  }
  doc.setFillColor(38, 38, 42)
  doc.triangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], 'F')
}

export function pdfDrawMainWidthDim(
  doc: jsPDF,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
  widthMm: number,
  pos: 'top' | 'bottom',
  sketchHeightMm: number,
): void {
  const gapY = px(sketchHeightMm, DIM_GAP_Y_PX)
  const labelGap = px(sketchHeightMm, LABEL_GAP_PX)
  const arrowMm = px(sketchHeightMm, 7)
  const yDim = pos === 'top' ? oy - gapY : oy + dh + gapY
  const labelY = pos === 'top' ? yDim - labelGap - 2.5 : yDim + labelGap + 2.5
  const edgeY = pos === 'top' ? oy : oy + dh

  setWitnessDashed(doc)
  doc.line(ox, edgeY, ox, yDim)
  doc.line(ox + dw, edgeY, ox + dw, yDim)

  setDimSolid(doc)
  doc.line(ox, yDim, ox + dw, yDim)
  pdfArrow(doc, ox, yDim, 'w', arrowMm)
  pdfArrow(doc, ox + dw, yDim, 'e', arrowMm)

  doc.setFontSize(7.5)
  doc.setTextColor(32, 32, 36)
  doc.text(formatSketchDimMm(widthMm), ox + dw / 2, labelY, { align: 'center' })
}

export function pdfDrawMainHeightDim(
  doc: jsPDF,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
  heightMm: number,
  pos: 'left' | 'right',
  sketchHeightMm: number,
): void {
  const gapX = px(sketchHeightMm, DIM_GAP_X_PX)
  const labelGap = px(sketchHeightMm, LABEL_GAP_PX)
  const vtrack = px(sketchHeightMm, VTRACK_PX)
  const arrowMm = px(sketchHeightMm, 7)
  const xDim = pos === 'left' ? ox - gapX : ox + dw + gapX
  const vCenterX = pos === 'left' ? xDim + 2 + 2 : xDim - 2 - 2
  const labelX = pos === 'left' ? vCenterX - labelGap - 2 : vCenterX + labelGap + 2

  setWitnessDashed(doc)
  if (pos === 'left') {
    doc.line(ox, oy, xDim - vtrack, oy)
    doc.line(ox, oy + dh, xDim - vtrack, oy + dh)
  } else {
    doc.line(ox + dw, oy, xDim + vtrack, oy)
    doc.line(ox + dw, oy + dh, xDim + vtrack, oy + dh)
  }

  setDimSolid(doc)
  doc.line(vCenterX, oy, vCenterX, oy + dh)
  pdfArrow(doc, vCenterX, oy, 'n', arrowMm)
  pdfArrow(doc, vCenterX, oy + dh, 's', arrowMm)

  doc.setFontSize(7.5)
  doc.setTextColor(32, 32, 36)
  doc.text(formatSketchDimMm(heightMm), labelX, oy + dh / 2, {
    angle: pos === 'left' ? 90 : -90,
    align: 'center',
  })
}

function pdfDrawVertChain(
  doc: jsPDF,
  segments: HingeChainDimSegmentLayout[],
  edge: 'left' | 'right',
  ox: number,
  oy: number,
  dw: number,
  dh: number,
  sketchHeightMm: number,
): void {
  if (segments.length === 0) return
  const flip = edge === 'left'
  const arrowMm = px(sketchHeightMm, 6)
  const mmPerPx = pdfSketchMmPerPx(sketchHeightMm)

  for (const seg of segments) {
    const y1 = oy + (seg.trackTopPct / 100) * dh
    const y2 = oy + ((seg.trackTopPct + seg.trackSpanPct) / 100) * dh
    const nudgeOut = (flip ? -seg.nudgeX : seg.nudgeX) * mmPerPx
    const base =
      px(sketchHeightMm, CHAIN_GAP_PX) + pdfTrackOffsetMm(seg.trackOffsetPx, sketchHeightMm) + Math.abs(nudgeOut)
    const narrow = seg.trackSpanPct < HINGE_DIM_NARROW_SPAN_PCT
    const xDim = flip ? ox - base : ox + dw + base
    const edgeX = flip ? ox : ox + dw

    setWitnessDashed(doc)
    doc.line(edgeX, y1, xDim, y1)
    doc.line(edgeX, y2, xDim, y2)

    setDimSolid(doc)
    doc.line(xDim, y1, xDim, y2)
    if (!narrow) {
      pdfArrow(doc, xDim, y1, 'n', arrowMm)
      pdfArrow(doc, xDim, y2, 's', arrowMm)
    }

    const labelGap = px(sketchHeightMm, LABEL_GAP_PX)
    const lx = flip ? xDim - labelGap - 2 : xDim + labelGap + 2
    doc.setFontSize(6.8)
    doc.setTextColor(32, 32, 36)
    doc.text(formatSketchDimMm(seg.valueMm), lx, (y1 + y2) / 2, {
      angle: flip ? 90 : -90,
      align: 'center',
    })
  }
}

function pdfDrawHorizChain(
  doc: jsPDF,
  segments: HingeChainDimSegmentLayout[],
  edge: 'top' | 'bottom',
  ox: number,
  oy: number,
  dw: number,
  dh: number,
  sketchHeightMm: number,
): void {
  if (segments.length === 0) return
  const flip = edge === 'top'
  const arrowMm = px(sketchHeightMm, 6)
  const mmPerPx = pdfSketchMmPerPx(sketchHeightMm)

  for (const seg of segments) {
    const x1 = ox + (seg.trackTopPct / 100) * dw
    const x2 = ox + ((seg.trackTopPct + seg.trackSpanPct) / 100) * dw
    const nudgeOut = (flip ? -seg.nudgeY : seg.nudgeY) * mmPerPx
    const base =
      px(sketchHeightMm, CHAIN_GAP_PX) + pdfTrackOffsetMm(seg.trackOffsetPx, sketchHeightMm) + Math.abs(nudgeOut)
    const narrow = seg.trackSpanPct < HINGE_DIM_NARROW_SPAN_PCT
    const yDim = flip ? oy - base : oy + dh + base
    const edgeY = flip ? oy : oy + dh

    setWitnessDashed(doc)
    doc.line(x1, edgeY, x1, yDim)
    doc.line(x2, edgeY, x2, yDim)

    setDimSolid(doc)
    doc.line(x1, yDim, x2, yDim)
    if (!narrow) {
      pdfArrow(doc, x1, yDim, 'w', arrowMm)
      pdfArrow(doc, x2, yDim, 'e', arrowMm)
    }

    const labelGap = px(sketchHeightMm, LABEL_GAP_PX)
    const ly = flip ? yDim - labelGap - 2 : yDim + labelGap + 2
    doc.setFontSize(6.8)
    doc.setTextColor(32, 32, 36)
    doc.text(formatSketchDimMm(seg.valueMm), (x1 + x2) / 2, ly, { align: 'center' })
  }
}

export function pdfDrawHingeChainDims(
  doc: jsPDF,
  segments: HingeChainDimSegmentLayout[],
  side: 'left' | 'right' | 'top' | 'bottom',
  ox: number,
  oy: number,
  dw: number,
  dh: number,
  sketchHeightMm: number,
): void {
  if (side === 'left' || side === 'right') pdfDrawVertChain(doc, segments, side, ox, oy, dw, dh, sketchHeightMm)
  else pdfDrawHorizChain(doc, segments, side, ox, oy, dw, dh, sketchHeightMm)
}
