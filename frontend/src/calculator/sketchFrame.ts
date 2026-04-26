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
export function sketchFrameInlineStyle(
  material: { texture_color?: string | null; texture_image?: string | null } | null | undefined
): CSSProperties | undefined {
  if (!material) return undefined
  return {
    backgroundColor: material.texture_color?.trim() || undefined,
    backgroundImage: material.texture_image
      ? `url(${resolveMediaUrl(material.texture_image)})`
      : undefined,
  }
}
