import { useEffect, useMemo, useState, type RefObject } from 'react'
import { resolveMediaUrl } from './sketchFrame'

export const CALC_CARD_IMAGE_SLOT_COUNT = 4 as const

export type CalcCardImageFiles = [File | null, File | null, File | null, File | null]

export type CalcCardImageUrls = [string, string, string, string]
export type CalcCardTextureIds = [number | null, number | null, number | null, number | null]

export const CALC_CARD_IMAGE_FIELD_NAMES = [
  'card_image',
  'card_image_2',
  'card_image_3',
  'card_image_4',
] as const

export function emptyCalcCardImageFiles(): CalcCardImageFiles {
  return [null, null, null, null]
}

export function emptyCalcCardTextureIds(): CalcCardTextureIds {
  return [null, null, null, null]
}

export function appendCalcCardImagesToFormData(fd: FormData, files: CalcCardImageFiles) {
  files.forEach((file, i) => {
    if (file) fd.append(CALC_CARD_IMAGE_FIELD_NAMES[i], file)
  })
}

export const CALC_CARD_TEXTURE_FIELD_NAMES = [
  'card_texture',
  'card_texture_2',
  'card_texture_3',
  'card_texture_4',
] as const

export function appendCalcCardTexturesToFormData(fd: FormData, textures: CalcCardTextureIds) {
  textures.forEach((id, i) => {
    if (id != null) fd.append(CALC_CARD_TEXTURE_FIELD_NAMES[i], String(id))
  })
}

export type CalcCardImageEntity = {
  card_image?: string | null
  image_url?: string | null
  card_image_2?: string | null
  card_image_3?: string | null
  card_image_4?: string | null
  card_texture?: number | null
  card_texture_2?: number | null
  card_texture_3?: number | null
  card_texture_4?: number | null
  card_texture_image?: string | null
  card_texture_2_image?: string | null
  card_texture_3_image?: string | null
  card_texture_4_image?: string | null
}

export function calcCardImageUrlsFromEntity(entity: CalcCardImageEntity): CalcCardImageUrls {
  const slots = [
    ((entity.card_texture_image ?? '') || (entity.card_image ?? '') || (entity.image_url ?? '')).trim(),
    ((entity.card_texture_2_image ?? '') || (entity.card_image_2 ?? '')).trim(),
    ((entity.card_texture_3_image ?? '') || (entity.card_image_3 ?? '')).trim(),
    ((entity.card_texture_4_image ?? '') || (entity.card_image_4 ?? '')).trim(),
  ]
  return slots.map((s) => (s ? resolveMediaUrl(s) : '')) as CalcCardImageUrls
}

export function calcCardImageTileUrls(
  files: CalcCardImageFiles,
  filePreviewUrls: CalcCardImageUrls,
  existingUrls: CalcCardImageUrls,
  texturePreviewUrls: CalcCardImageUrls = ['', '', '', ''],
): CalcCardImageUrls {
  return files.map((file, i) =>
    file ? filePreviewUrls[i] : texturePreviewUrls[i] || existingUrls[i] || '',
  ) as CalcCardImageUrls
}

export function calcCardImageGridSlots(entity: CalcCardImageEntity) {
  const u = calcCardImageUrlsFromEntity(entity)
  return {
    slot0: u[0],
    slot1: u[1],
    slot2: u[2],
    slot3: u[3],
  }
}

/** Плитка в сетке калькулятора: превью + полоски при нескольких кадрах (шаги 2, 4, 5). */
export function CalculatorCardTileStriped({
  title,
  versionKey,
  slot0,
  slot1,
  slot2,
  slot3,
}: {
  title: string
  versionKey: number
  slot0: string
  slot1: string
  slot2: string
  slot3: string
}) {
  const srcs = useMemo(() => {
    const out: string[] = []
    for (const s of [slot0, slot1, slot2, slot3]) {
      const t = (s ?? '').trim()
      if (t) out.push(resolveMediaUrl(t))
    }
    return out.filter(Boolean)
  }, [versionKey, slot0, slot1, slot2, slot3])
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
        {src ? (
          <img className="tile-thumb-img" src={src} alt={title} loading="lazy" decoding="async" />
        ) : null}
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
  onPickSlot,
  groupAriaLabel = 'Фото карточки, до четырёх',
}: {
  urls: CalcCardImageUrls
  inputRefs?: readonly [
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
  ]
  onPickSlot?: (slot: number) => void
  groupAriaLabel?: string
}) {
  return (
    <div className="frame2-card-image-tile-row" role="group" aria-label={groupAriaLabel}>
      {([0, 1, 2, 3] as const).map((slot) => (
        <button
          key={slot}
          type="button"
          className={[
            'frame2-card-image-tile',
            urls[slot] ? 'frame2-card-image-tile--filled' : 'frame2-card-image-tile--empty',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => (onPickSlot ? onPickSlot(slot) : inputRefs?.[slot].current?.click())}
          aria-label={
            urls[slot]
              ? `Фото ${slot + 1}: нажмите, чтобы заменить изображение`
              : `Фото ${slot + 1}: нажмите, чтобы выбрать изображение`
          }
        >
          {urls[slot] ? (
            <img
              className="frame2-card-image-tile-img"
              src={urls[slot]}
              alt=""
              loading="lazy"
              decoding="async"
            />
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
