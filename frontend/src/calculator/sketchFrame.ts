import type { CSSProperties } from 'react'

import { API_ORIGIN, apiUrl } from '../apiBase'

/** URL медиа: production — префикс бэкенда (`VITE_API_ORIGIN`); dev на :5173 — прокси или прямой :8000. */
export function resolveMediaUrl(url: string) {
  const u = url.trim()
  if (!u) return ''
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  if (u.startsWith('data:')) return u
  if (u.startsWith('/media/')) {
    if (API_ORIGIN) return apiUrl(u)
    if (typeof window !== 'undefined' && window.location.origin.includes(':5173')) {
      return `http://127.0.0.1:8000${u}`
    }
  }
  return u
}

/** Стиль периметра эскиза (как в шаге 2): цвет и/или текстура материала. */
export type SketchTextureMaterial = {
  texture_color?: string | null
  texture_image?: string | null
  tex_offset_x?: string | number | null
  tex_offset_y?: string | number | null
  tex_step_x?: string | number | null
  tex_step_y?: string | number | null
  tex_opacity?: string | number | null
  tex_mirror?: boolean | null
  tex_rotation_deg?: string | number | null
}

function asNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = String(v).trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** Прозрачность текстуры наполнения в эскизе: ~18% видимости. */
export const SKETCH_FILLING_TEXTURE_OPACITY = 0.18

export type MaterialTextureLayerOptions = {
  /** Перекрывает `tex_opacity` материала в эскизе. */
  sketchOpacity?: number
}

/** Непрозрачность слоя текстуры (как в `materialTextureLayerStyle`). */
export function sketchMaterialOpacity(
  material: SketchTextureMaterial | null | undefined,
  options?: MaterialTextureLayerOptions,
): number {
  if (!material) return 1
  const opacityRaw = asNum(material.tex_opacity)
  return options?.sketchOpacity != null
    ? clamp(options.sketchOpacity, 0, 1)
    : opacityRaw == null
      ? 1
      : clamp(opacityRaw, 0, 1)
}

/**
 * Унифицированный стиль текстуры материала (рамка/наполнение): учитывает параметры из базы:
 * offset/step/opacity/rotate/mirror.
 *
 * Возвращаем стиль именно для "texture layer" (внутреннего div), чтобы opacity не влияла
 * на пунктир/уголки чертежа у `.sketch-paper`.
 */
export function materialTextureLayerStyle(
  material: SketchTextureMaterial | null | undefined,
  options?: MaterialTextureLayerOptions,
): CSSProperties | undefined {
  if (!material) return undefined

  const color = (material.texture_color ?? '').trim()
  const img = resolveMediaUrl((material.texture_image ?? '').trim())
  const hasAny = Boolean(color) || Boolean(img)
  if (!hasAny) return undefined

  // В режиме эскиза используем "растянуть по области" (как просили): cover + no-repeat + center.
  // Это даёт предсказуемую визуализацию на всех шагах и не зависит от шагов тайлинга.
  // Параметры step/offset оставляем на будущее (если потребуется вернуть тайлинг).
  const opacity = sketchMaterialOpacity(material, options)
  const mirror = Boolean(material.tex_mirror)

  // В режиме эскиза всегда заполняем прямоугольник без "дыр":
  // - текстура растягивается на 100%×100%
  // - поворот игнорируем (иначе появляются пустые углы при rotate)
  const transformParts: string[] = []
  if (mirror) transformParts.push('scaleX(-1)')

  return {
    backgroundColor: color || undefined,
    backgroundImage: img ? `url(${img})` : undefined,
    backgroundRepeat: img ? 'no-repeat' : undefined,
    backgroundSize: img ? '100% 100%' : undefined,
    backgroundPosition: img ? 'center' : undefined,
    opacity,
    transform: transformParts.length ? transformParts.join(' ') : undefined,
  }
}

/** Текстура наполнения в эскизе — фиксированная низкая непрозрачность (см. SKETCH_FILLING_TEXTURE_OPACITY). */
export function materialFillingTextureLayerStyle(
  material: SketchTextureMaterial | null | undefined,
): CSSProperties | undefined {
  return materialTextureLayerStyle(material, { sketchOpacity: SKETCH_FILLING_TEXTURE_OPACITY })
}

function blendAspect(defaultAspect: number, targetAspect: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultAspect + (targetAspect - defaultAspect) * k
}

function blendScale(defaultScale: number, targetScale: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultScale + (targetScale - defaultScale) * k
}

/** Выше этой высоты фасада (мм) эскиз по вертикали не увеличивается. */
export const SKETCH_SCALE_HEIGHT_CAP_MM = 1700

export function facadeSketchScaleY(heightMm: number): number {
  const cappedHeight = Math.min(heightMm, SKETCH_SCALE_HEIGHT_CAP_MM)
  const targetScale = cappedHeight / 2000
  const softenedScale = blendScale(1, targetScale, 0.22)
  return clamp(softenedScale, 0.9, 1.1)
}

export function facadeSketchAspectRatio(widthMm: number, heightMm: number): number {
  const target = widthMm / heightMm
  const softened = blendAspect(3 / 4.2, target, 0.28)
  return clamp(softened, 0.56, 0.92)
}

/**
 * Пропорции и вертикальный масштаб блока `.sketch` по габаритам фасада (мм), как на шаге 3.
 * W/H смягчённо подмешивается к базе 3/4.2; масштаб по высоте — от базы 2000 мм.
 */
export function facadeSketchBoxStyle(heightMm: number, widthMm: number): CSSProperties | undefined {
  if (!Number.isFinite(heightMm) || !Number.isFinite(widthMm) || heightMm <= 0 || widthMm <= 0) {
    return undefined
  }
  return {
    aspectRatio: facadeSketchAspectRatio(widthMm, heightMm),
    ['--sketch-scale-y' as string]: facadeSketchScaleY(heightMm),
  } as CSSProperties
}

/** Соответствует `.sketch { --sketch-size-factor: 0.85 }` и `min(68dvh, 520px)`. */
export const SKETCH_CSS_MAX_HEIGHT_PX = 520
export const SKETCH_CSS_SIZE_FACTOR = 0.85
/** `.sketch-paper { inset: 12px }` */
export const SKETCH_PAPER_INSET_PX = 12
/** `.sketch-paper::before { inset: 4.5% }` */
export const SKETCH_PAPER_DASH_INSET_FRAC = 0.045
/** Позиция уголков `.sketch-paper::after` */
export const SKETCH_CORNER_INSET_FRAC = 0.043
export const SKETCH_CORNER_MARK_PX = 18
/** `.sketch-sheet { inset: 16% 10% }` */
export const SKETCH_SHEET_INSET_Y_FRAC = 0.16
export const SKETCH_SHEET_INSET_X_FRAC = 0.1

/** Высота блока `.sketch` в CSS (px), с учётом `--sketch-scale-y` и size-factor. */
export function facadeSketchCssHeightPx(
  heightMm: number,
  sizeFactor = SKETCH_CSS_SIZE_FACTOR,
): number {
  return SKETCH_CSS_MAX_HEIGHT_PX * facadeSketchScaleY(heightMm) * sizeFactor
}

/** Масштаб px-макета → мм на PDF-эскизе заданной высоты `sketchHeightMm`. */
export function facadeSketchPxToMm(
  px: number,
  sketchHeightMm: number,
  heightMm: number,
  sizeFactor = SKETCH_CSS_SIZE_FACTOR,
): number {
  const cssH = facadeSketchCssHeightPx(heightMm, sizeFactor)
  if (!(cssH > 0 && sketchHeightMm > 0)) return 0
  return (px / cssH) * sketchHeightMm
}

/** Толщина видимой рамки (полоса профиля) как `inset: 12px` у `.sketch-paper`. */
export function facadeSketchPaperInsetMm(
  sketchHeightMm: number,
  heightMm: number,
  sizeFactor = SKETCH_CSS_SIZE_FACTOR,
): number {
  return facadeSketchPxToMm(SKETCH_PAPER_INSET_PX, sketchHeightMm, heightMm, sizeFactor)
}

/** Backward-compat: старый хелпер (используйте materialTextureLayerStyle). */
export function sketchFrameInlineStyle(
  material: { texture_color?: string | null; texture_image?: string | null } | null | undefined
): CSSProperties | undefined {
  return materialTextureLayerStyle(material as any)
}
