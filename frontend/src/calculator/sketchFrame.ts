import type { CSSProperties } from 'react'

/** URL медиа с учётом dev (Vite :5173 → backend :8000 для /media/). */
export function resolveMediaUrl(url: string) {
  const u = url.trim()
  if (!u) return ''
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  if (u.startsWith('data:')) return u
  if (u.startsWith('/media/') && window.location.origin.includes(':5173')) {
    return `http://127.0.0.1:8000${u}`
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

/**
 * Унифицированный стиль текстуры материала (рамка/наполнение): учитывает параметры из базы:
 * offset/step/opacity/rotate/mirror.
 *
 * Возвращаем стиль именно для "texture layer" (внутреннего div), чтобы opacity не влияла
 * на пунктир/уголки чертежа у `.sketch-paper`.
 */
export function materialTextureLayerStyle(material: SketchTextureMaterial | null | undefined): CSSProperties | undefined {
  if (!material) return undefined

  const color = (material.texture_color ?? '').trim()
  const img = resolveMediaUrl((material.texture_image ?? '').trim())
  const hasAny = Boolean(color) || Boolean(img)
  if (!hasAny) return undefined

  // В режиме эскиза используем "растянуть по области" (как просили): cover + no-repeat + center.
  // Это даёт предсказуемую визуализацию на всех шагах и не зависит от шагов тайлинга.
  // Параметры step/offset оставляем на будущее (если потребуется вернуть тайлинг).
  const opacityRaw = asNum(material.tex_opacity)
  const opacity = opacityRaw == null ? 1 : clamp(opacityRaw, 0, 1)
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

function blendAspect(defaultAspect: number, targetAspect: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultAspect + (targetAspect - defaultAspect) * k
}

function blendScale(defaultScale: number, targetScale: number, strength: number) {
  const k = clamp(strength, 0, 1)
  return defaultScale + (targetScale - defaultScale) * k
}

/**
 * Пропорции и вертикальный масштаб блока `.sketch` по габаритам фасада (мм), как на шаге 3.
 * W/H смягчённо подмешивается к базе 3/4.2; масштаб по высоте — от базы 2000 мм.
 */
export function facadeSketchBoxStyle(heightMm: number, widthMm: number): CSSProperties | undefined {
  if (!Number.isFinite(heightMm) || !Number.isFinite(widthMm) || heightMm <= 0 || widthMm <= 0) {
    return undefined
  }
  const target = widthMm / heightMm
  const softened = blendAspect(3 / 4.2, target, 0.28)
  const aspect = clamp(softened, 0.56, 0.92)
  const targetScale = heightMm / 2000
  const softenedScale = blendScale(1, targetScale, 0.22)
  const scaleY = clamp(softenedScale, 0.9, 1.1)
  return {
    aspectRatio: aspect,
    ['--sketch-scale-y' as string]: scaleY,
  } as CSSProperties
}

/** Backward-compat: старый хелпер (используйте materialTextureLayerStyle). */
export function sketchFrameInlineStyle(
  material: { texture_color?: string | null; texture_image?: string | null } | null | undefined
): CSSProperties | undefined {
  return materialTextureLayerStyle(material as any)
}
