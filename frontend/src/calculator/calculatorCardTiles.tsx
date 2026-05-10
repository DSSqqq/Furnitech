import { useEffect, useMemo, useState, type RefObject } from 'react'
import { resolveMediaUrl } from './sketchFrame'

/** Плитка в сетке калькулятора: превью + полоски при нескольких кадрах (шаги 2 и 4). */
export function CalculatorCardTileStriped({
  title,
  versionKey,
  slot0,
  slot1,
  slot2,
}: {
  title: string
  versionKey: number
  slot0: string
  slot1: string
  slot2: string
}) {
  const srcs = useMemo(() => {
    const out: string[] = []
    for (const s of [slot0, slot1, slot2]) {
      const t = (s ?? '').trim()
      if (t) out.push(resolveMediaUrl(t))
    }
    return out.filter(Boolean)
  }, [versionKey, slot0, slot1, slot2])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    setActiveIdx(0)
  }, [versionKey])

  const idx = useMemo(() => {
    if (srcs.length === 0) return 0
    return Math.min(activeIdx, srcs.length - 1)
  }, [activeIdx, srcs.length])

  const src = srcs[idx] ?? ''
  const showStripes = srcs.length > 1
  return (
    <div className="tile-thumb-stack">
      <div className="tile-thumb tile-thumb--profile-type">
        {src ? <img className="tile-thumb-img" src={src} alt={title} /> : null}
      </div>
      {showStripes && (
        <div className="tile-card-stripes" role="presentation" aria-hidden>
          {srcs.map((_, i) => (
            <span
              key={i}
              className={[
                'tile-card-stripe',
                i === idx ? 'tile-card-stripe--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setActiveIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProfileCardImageTileRow({
  urls,
  inputRefs,
  groupAriaLabel = 'Фото карточки, до трёх',
}: {
  urls: readonly [string, string, string]
  inputRefs: readonly [RefObject<HTMLInputElement | null>, RefObject<HTMLInputElement | null>, RefObject<HTMLInputElement | null>]
  groupAriaLabel?: string
}) {
  return (
    <div className="frame2-card-image-tile-row" role="group" aria-label={groupAriaLabel}>
      {([0, 1, 2] as const).map((slot) => (
        <button
          key={slot}
          type="button"
          className={[
            'frame2-card-image-tile',
            urls[slot] ? 'frame2-card-image-tile--filled' : 'frame2-card-image-tile--empty',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => inputRefs[slot].current?.click()}
          aria-label={
            urls[slot]
              ? `Фото ${slot + 1}: нажмите, чтобы заменить файл`
              : `Фото ${slot + 1}: нажмите, чтобы выбрать файл`
          }
        >
          {urls[slot] ? (
            <img className="frame2-card-image-tile-img" src={urls[slot]} alt="" />
          ) : (
            <span className="frame2-card-image-tile-placeholder" aria-hidden>
              +
            </span>
          )}
          <span className="frame2-card-image-tile-badge" aria-hidden>
            {slot + 1}
          </span>
        </button>
      ))}
    </div>
  )
}
