import { useEffect, useMemo, useState, type ChangeEvent, type RefObject } from 'react'
import { resolveMediaUrl } from './sketchFrame'

export const CALC_CARD_IMAGE_SLOT_COUNT = 4 as const
export const PROFILE_CARD_IMAGE_SLOT_COUNT = 6 as const

export type CalcCardImageFiles = [File | null, File | null, File | null, File | null]
export type ProfileCardImageFiles = [
  File | null,
  File | null,
  File | null,
  File | null,
  File | null,
  File | null,
]

export type CalcCardImageUrls = [string, string, string, string]
export type ProfileCardImageUrls = [string, string, string, string, string, string]
export type CalcCardTextureIds = [number | null, number | null, number | null, number | null]
export type ProfileCardTextureIds = [number | null, number | null, number | null, number | null, number | null, number | null]

export const CALC_CARD_IMAGE_FIELD_NAMES = [
  'card_image',
  'card_image_2',
  'card_image_3',
  'card_image_4',
] as const

export const PROFILE_CARD_IMAGE_FIELD_NAMES = [
  'card_image',
  'card_image_2',
  'card_image_3',
  'card_image_4',
  'card_image_5',
  'card_image_6',
] as const

export const CALC_CARD_TEXTURE_FIELD_NAMES = [
  'card_texture',
  'card_texture_2',
  'card_texture_3',
  'card_texture_4',
] as const

export const PROFILE_CARD_TEXTURE_FIELD_NAMES = [
  'card_texture',
  'card_texture_2',
  'card_texture_3',
  'card_texture_4',
  'card_texture_5',
  'card_texture_6',
] as const

export function emptyCalcCardImageFiles(): CalcCardImageFiles {
  return [null, null, null, null]
}

export function emptyProfileCardImageFiles(): ProfileCardImageFiles {
  return [null, null, null, null, null, null]
}

export function emptyCalcCardTextureIds(): CalcCardTextureIds {
  return [null, null, null, null]
}

export function emptyProfileCardTextureIds(): ProfileCardTextureIds {
  return [null, null, null, null, null, null]
}

export function emptyCardImageUrls(count: number): string[] {
  return Array.from({ length: count }, () => '')
}

export function appendCalcCardImagesToFormData(fd: FormData, files: readonly (File | null)[]) {
  files.forEach((file, i) => {
    if (file && i < CALC_CARD_IMAGE_FIELD_NAMES.length) {
      fd.append(CALC_CARD_IMAGE_FIELD_NAMES[i], file)
    }
  })
}

export function appendProfileCardImagesToFormData(fd: FormData, files: readonly (File | null)[]) {
  files.forEach((file, i) => {
    if (file && i < PROFILE_CARD_IMAGE_FIELD_NAMES.length) {
      fd.append(PROFILE_CARD_IMAGE_FIELD_NAMES[i], file)
    }
  })
}

export function appendCalcCardTexturesToFormData(fd: FormData, textures: readonly (number | null)[]) {
  textures.forEach((id, i) => {
    if (id != null && i < CALC_CARD_TEXTURE_FIELD_NAMES.length) {
      fd.append(CALC_CARD_TEXTURE_FIELD_NAMES[i], String(id))
    }
  })
}

export function appendProfileCardTexturesToFormData(fd: FormData, textures: readonly (number | null)[]) {
  textures.forEach((id, i) => {
    if (id != null && i < PROFILE_CARD_TEXTURE_FIELD_NAMES.length) {
      fd.append(PROFILE_CARD_TEXTURE_FIELD_NAMES[i], String(id))
    }
  })
}

export type CalcCardImageEntity = {
  card_image?: string | null
  image_url?: string | null
  card_image_2?: string | null
  card_image_3?: string | null
  card_image_4?: string | null
  card_image_5?: string | null
  card_image_6?: string | null
  card_texture?: number | null
  card_texture_2?: number | null
  card_texture_3?: number | null
  card_texture_4?: number | null
  card_texture_5?: number | null
  card_texture_6?: number | null
  card_texture_image?: string | null
  card_texture_2_image?: string | null
  card_texture_3_image?: string | null
  card_texture_4_image?: string | null
  card_texture_5_image?: string | null
  card_texture_6_image?: string | null
}

function rawCardImageSlotsFromEntity(entity: CalcCardImageEntity, slotCount: number): string[] {
  const pairs: [string | null | undefined, string | null | undefined][] = [
    [entity.card_texture_image, (entity.card_image ?? '') || (entity.image_url ?? '')],
    [entity.card_texture_2_image, entity.card_image_2],
    [entity.card_texture_3_image, entity.card_image_3],
    [entity.card_texture_4_image, entity.card_image_4],
    [entity.card_texture_5_image, entity.card_image_5],
    [entity.card_texture_6_image, entity.card_image_6],
  ]
  return pairs.slice(0, slotCount).map(([tex, img]) => ((tex ?? '') || (img ?? '')).trim())
}

export function calcCardImageUrlsFromEntity(
  entity: CalcCardImageEntity,
  slotCount: number = CALC_CARD_IMAGE_SLOT_COUNT,
): string[] {
  return rawCardImageSlotsFromEntity(entity, slotCount).map((s) => (s ? resolveMediaUrl(s) : ''))
}

export function calcCardImageTileUrls(
  files: readonly (File | null)[],
  filePreviewUrls: readonly string[],
  existingUrls: readonly string[],
  texturePreviewUrls: readonly string[] = [],
): string[] {
  return files.map((file, i) =>
    file ? (filePreviewUrls[i] ?? '') : (texturePreviewUrls[i] ?? '') || (existingUrls[i] ?? '') || '',
  )
}

export function calcCardImageGridSlots(
  entity: CalcCardImageEntity,
  slotCount: number = CALC_CARD_IMAGE_SLOT_COUNT,
) {
  return { slots: calcCardImageUrlsFromEntity(entity, slotCount).filter((s) => s.trim()) }
}

export function filledCardImageSlots(urls: readonly string[], maxSlots: number): number[] {
  const out: number[] = []
  for (let i = 0; i < maxSlots; i++) {
    if ((urls[i] ?? '').trim()) out.push(i)
  }
  return out
}

export function firstEmptyCardImageSlot(urls: readonly string[], maxSlots: number): number | null {
  for (let i = 0; i < maxSlots; i++) {
    if (!(urls[i] ?? '').trim()) return i
  }
  return null
}

export function compactCardImageSlots<T>(items: readonly T[], maxSlots: number, empty: T, isFilled: (item: T) => boolean): T[] {
  const filled = items.filter((item) => isFilled(item))
  const next = [...filled]
  while (next.length < maxSlots) next.push(empty)
  return next.slice(0, maxSlots)
}

/** Список изображений карточки в форме типа (как checklist материалов). */
export function CardImageChecklist({
  idPrefix,
  label,
  urls,
  maxSlots,
  onAdd,
  onRemove,
  onReplace,
  fileInputRef,
  onFileInputChange,
}: {
  idPrefix: string
  label: string
  urls: readonly string[]
  maxSlots: number
  onAdd: () => void
  onRemove: (slot: number) => void
  onReplace: (slot: number) => void
  fileInputRef?: RefObject<HTMLInputElement | null>
  onFileInputChange?: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  const filledSlots = useMemo(() => filledCardImageSlots(urls, maxSlots), [urls, maxSlots])
  const atMax = filledSlots.length >= maxSlots

  return (
    <>
      <div className="calculator-type-form-card-images-toolbar">
        <div className="frame2-file-row frame2-colors-for-card-label">
          <div className="frame2-file-label-row">
            <span className="frame2-file-label">{label}</span>
          </div>
        </div>
        <div className="frame2-material-search-row">
          <button
            type="button"
            className="admin-secondary frame2-material-tree-search-btn"
            onClick={onAdd}
            disabled={atMax}
          >
            Добавить
          </button>
        </div>
      </div>
      {fileInputRef && onFileInputChange ? (
        <input
          id={`${idPrefix}-card-image-file`}
          ref={fileInputRef}
          className="frame2-file-input frame2-file-input--sr"
          type="file"
          accept="image/*"
          onChange={onFileInputChange}
        />
      ) : null}
      {filledSlots.length > 0 ? (
        <ul className="frame2-checklist calculator-type-form-card-images-list">
          {filledSlots.map((slot, listIdx) => (
            <li key={slot}>
              <div className="frame2-checkrow frame2-checkrow--checked calculator-type-form-card-image-row">
                <span className="frame2-check-article">{String(listIdx + 1).padStart(2, '0')}</span>
                <span className="frame2-check-swatch">
                  <img className="frame2-check-swatch-img" src={urls[slot]} alt="" loading="lazy" decoding="async" />
                </span>
                <button
                  type="button"
                  className="frame2-check-name-wrap calculator-type-form-card-image-replace"
                  onClick={() => onReplace(slot)}
                  title="Заменить изображение"
                >
                  <span className="frame2-check-name">Фото {listIdx + 1}</span>
                </button>
                <button
                  type="button"
                  className="calculator-type-form-card-image-remove admin-primary"
                  aria-label={`Удалить фото ${listIdx + 1}`}
                  title={`Удалить фото ${listIdx + 1}`}
                  onClick={() => onRemove(slot)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {filledSlots.length > 0 ? (
        <div className="admin-muted">
          Добавлено изображений: {filledSlots.length} из {maxSlots}
        </div>
      ) : null}
    </>
  )
}

/** Плитка в сетке калькулятора: превью + полоски при нескольких кадрах (шаги 2, 4, 5). */
export function CalculatorCardTileStriped({
  title,
  versionKey,
  slots,
}: {
  title: string
  versionKey: number
  slots: readonly string[]
}) {
  const srcs = useMemo(() => {
    const out: string[] = []
    for (const s of slots) {
      const t = (s ?? '').trim()
      if (t) out.push(resolveMediaUrl(t))
    }
    return out.filter(Boolean)
  }, [versionKey, slots])
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
              className={['tile-card-stripe', i === idx ? 'tile-card-stripe--active' : ''].filter(Boolean).join(' ')}
              onMouseEnter={() => setActiveIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
