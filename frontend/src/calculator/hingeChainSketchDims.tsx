import { useMemo, type CSSProperties } from 'react'
import { hingeMeasuresFromEdgeStart, type HingeMountSide } from './frameCalcSession'

/** Участок короче этого % длины стороны — чаще даёт наложение подписей. */
export const HINGE_DIM_THIN_SPAN_PCT = 10
export const HINGE_DIM_NUDGE_STEP_PX = 12
/** Узкий участок: стрелки не помещаются — вертикаль на всю высоту от выноски до выноски. */
export const HINGE_DIM_NARROW_SPAN_PCT = 6

const HINGE_TRACK_STEP_PX = 26

export type HingeChainDimSegment = {
  key: string
  hingeIndex: number
  fromStart: boolean
  trackTopPct: number
  trackSpanPct: number
  valueMm: number
  trackOffsetPx: number
}

export type HingeChainDimSegmentLayout = HingeChainDimSegment & {
  nudgeX: number
  nudgeY: number
}

export function formatSketchDimMm(v: number) {
  return `${Math.round(v)} мм`
}

export function hingeLabelNudgeStyle(nudgeX: number, nudgeY: number): CSSProperties {
  return {
    ['--hinge-label-nudge-x' as string]: `${nudgeX}px`,
    ['--hinge-label-nudge-y' as string]: `${nudgeY}px`,
  }
}

export function sketchMainDimPlacement(chainSides: Iterable<HingeMountSide>): {
  widthPos: 'top' | 'bottom'
  heightPos: 'left' | 'right'
} {
  const sides = new Set(chainSides)
  if (sides.size === 0) {
    return { widthPos: 'top', heightPos: 'left' }
  }
  const widthPos: 'top' | 'bottom' = sides.has('top') ? 'bottom' : sides.has('bottom') ? 'top' : 'top'
  const heightPos: 'left' | 'right' = sides.has('left') ? 'right' : sides.has('right') ? 'left' : 'left'
  return { widthPos, heightPos }
}

/** Размеры петель / отверстий: №1 от начального края, остальные — от противоположного края. */
export function computeHingeChainDims(
  edgeL: number,
  positionsMm: number[],
  keyPrefix = 'hinge-dim',
): HingeChainDimSegment[] {
  const L = edgeL
  const nums = positionsMm
  const out: HingeChainDimSegment[] = []
  const endHingeIndices: number[] = []
  for (let k = 0; k < nums.length; k++) {
    if (!hingeMeasuresFromEdgeStart(k, nums.length)) endHingeIndices.push(k)
  }
  const endCount = endHingeIndices.length
  endHingeIndices.sort((a, b) => nums[a] - nums[b])
  const endTrackRank = new Map(endHingeIndices.map((k, i) => [k, endCount - 1 - i]))
  for (let k = 0; k < nums.length; k++) {
    const fromStart = hingeMeasuresFromEdgeStart(k, nums.length)
    const pos = nums[k]
    const valueMm = fromStart ? pos : L - pos
    if (valueMm > 0.001) {
      const hingePct = (pos / L) * 100
      const endTrackIndex = fromStart ? 0 : (endTrackRank.get(k) ?? 0)
      out.push({
        key: `${keyPrefix}-${k}`,
        hingeIndex: k,
        fromStart,
        trackTopPct: fromStart ? 0 : hingePct,
        trackSpanPct: fromStart ? hingePct : 100 - hingePct,
        valueMm,
        trackOffsetPx: endTrackIndex * HINGE_TRACK_STEP_PX,
      })
    }
  }
  return out
}

export function layoutHingeChainDimsWithNudge(
  segments: HingeChainDimSegment[],
  side: HingeMountSide,
): HingeChainDimSegmentLayout[] {
  const vertical = side === 'left' || side === 'right'
  let run = 0
  return segments.map((seg) => {
    const span = seg.trackSpanPct
    let nudgeX = 0
    let nudgeY = 0
    if (span < HINGE_DIM_THIN_SPAN_PCT) {
      const off = run * HINGE_DIM_NUDGE_STEP_PX
      if (vertical) {
        nudgeY = -off
        nudgeX = side === 'left' ? -off * 0.85 : off * 0.85
      } else if (side === 'top') {
        nudgeX = -off
        nudgeY = -off * 0.65
      } else {
        nudgeX = off
        nudgeY = off * 0.65
      }
      run += 1
    } else {
      run = 0
    }
    return { ...seg, nudgeX, nudgeY }
  })
}

export function useHingeChainSketchDims(
  side: HingeMountSide | null | undefined,
  edgeL: number | null,
  positionsMm: number[] | null,
  keyPrefix = 'hinge-dim',
) {
  const segments = useMemo(() => {
    if (side == null || edgeL == null || positionsMm == null) return []
    return computeHingeChainDims(edgeL, positionsMm, keyPrefix)
  }, [edgeL, keyPrefix, positionsMm, side])

  const layout = useMemo(() => {
    if (side == null) return []
    return layoutHingeChainDimsWithNudge(segments, side)
  }, [segments, side])

  return { segments, layout }
}

export function HingeChainDimLayer({
  side,
  segments,
}: {
  side: HingeMountSide
  segments: HingeChainDimSegmentLayout[]
}) {
  if (segments.length === 0) return null

  return (
    <div className="frame3-hinge-dim-layer" aria-hidden>
      {segments.map((seg) => {
        const vLabel = formatSketchDimMm(seg.valueMm)
        if (side === 'left' || side === 'right') {
          const spanPct = seg.trackSpanPct
          const narrow = spanPct < HINGE_DIM_NARROW_SPAN_PCT
          const labelStyle = hingeLabelNudgeStyle(seg.nudgeX, seg.nudgeY)
          const spanHeightPct = Math.max(spanPct, 0.8)
          const trackShift =
            side === 'left'
              ? `translateX(calc(-100% - var(--hinge-chain-sketch-gap, 30px) - ${seg.trackOffsetPx}px))`
              : `translateX(calc(100% + var(--hinge-chain-sketch-gap, 30px) + ${seg.trackOffsetPx}px))`
          const outer: CSSProperties =
            side === 'left'
              ? {
                  left: 0,
                  top: `${seg.trackTopPct}%`,
                  height: `${spanHeightPct}%`,
                  width: '1.35rem',
                  ['--hinge-chain-track-offset' as string]: `${seg.trackOffsetPx}px`,
                  transform: trackShift,
                }
              : {
                  right: 0,
                  top: `${seg.trackTopPct}%`,
                  height: `${spanHeightPct}%`,
                  width: '1.35rem',
                  ['--hinge-chain-track-offset' as string]: `${seg.trackOffsetPx}px`,
                  transform: trackShift,
                }
          return (
            <div
              key={seg.key}
              className={[
                'hinge-chain-dim hinge-chain-dim--v',
                `hinge-chain-dim--${side}`,
                seg.trackOffsetPx > 0 ? 'hinge-chain-dim--tracked' : '',
                narrow ? 'hinge-chain-dim--narrow' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={outer}
            >
              <span className="hinge-chain-dim__wit hinge-chain-dim__wit--start" />
              <span className="hinge-chain-dim__wit hinge-chain-dim__wit--end" />
              <div className="hinge-chain-dim__body">
                <div className="hinge-chain-dim__val" style={labelStyle}>
                  {vLabel}
                </div>
                <div className="hinge-chain-dim__v">
                  <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--n" />
                  <span className="hinge-chain-dim__v-line" />
                  <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--s" />
                </div>
              </div>
            </div>
          )
        }
        const hLabelStyle = hingeLabelNudgeStyle(seg.nudgeX, seg.nudgeY)
        const hSpanPct = Math.max(seg.trackSpanPct, 0.8)
        const outer: CSSProperties =
          side === 'top'
            ? {
                top: 0,
                left: `${seg.trackTopPct}%`,
                width: `${hSpanPct}%`,
                height: '1.65rem',
                ['--hinge-chain-track-offset' as string]: `${seg.trackOffsetPx}px`,
                transform: `translateY(calc(-100% - var(--hinge-chain-sketch-gap, 30px) - ${seg.trackOffsetPx}px))`,
              }
            : {
                bottom: 0,
                left: `${seg.trackTopPct}%`,
                width: `${hSpanPct}%`,
                height: '1.65rem',
                ['--hinge-chain-track-offset' as string]: `${seg.trackOffsetPx}px`,
                transform: `translateY(calc(100% + var(--hinge-chain-sketch-gap, 30px) + ${seg.trackOffsetPx}px))`,
              }
        return (
          <div key={seg.key} className={`hinge-chain-dim hinge-chain-dim--h hinge-chain-dim--${side}`} style={outer}>
            <span className="hinge-chain-dim__wit hinge-chain-dim__wit--start" />
            <span className="hinge-chain-dim__wit hinge-chain-dim__wit--end" />
            <div className="hinge-chain-dim__body hinge-chain-dim__body--h">
              <div className="hinge-chain-dim__val hinge-chain-dim__val--h" style={hLabelStyle}>
                {vLabel}
              </div>
              <div className="hinge-chain-dim__h">
                <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--w" />
                <span className="hinge-chain-dim__h-line" />
                <span className="frame3-dim-drawing__arrow frame3-dim-drawing__arrow--e" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
