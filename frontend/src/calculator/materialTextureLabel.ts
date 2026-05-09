import type { Material } from '../types'

/** Поля для подписи «текстуры»; name может быть неполным у вложенных DTO. */
export type MaterialTextureFields = Pick<Material, 'texture_mode' | 'texture_color' | 'texture_image'> & {
  name?: string | null
}

function mediaBasename(path: string): string {
  const s = path.replace(/\\/g, '/').trim()
  if (!s) return ''
  const cut = s.split('?')[0] ?? s
  const i = cut.lastIndexOf('/')
  const base = i >= 0 ? cut.slice(i + 1) : cut
  try {
    return decodeURIComponent(base)
  } catch {
    return base
  }
}

/**
 * Подпись визуала материала в калькуляторе: не название записи в справочнике, а «текстура» —
 * HEX для режима color, имя файла (без расширения) для texture; если не задано — fallback на name.
 */
export function materialTextureLabel(m: MaterialTextureFields | null | undefined): string {
  if (!m) return '—'
  const mode = String(m.texture_mode ?? 'texture').toLowerCase()
  if (mode === 'color') {
    const c = (m.texture_color ?? '').trim()
    if (c) return c
  }
  const img = String(m.texture_image ?? '').trim()
  if (img) {
    const base = mediaBasename(img)
    if (base) {
      const noExt = base.replace(/\.[^.]+$/, '')
      const label = (noExt || base).trim()
      if (label) return label
    }
  }
  const n = String(m.name ?? '').trim()
  return n || '—'
}

/** Как строка наполнения на эскизах: «тип — подпись текстуры материала». */
export function sketchFillingLine(
  typeName: string | null | undefined,
  mat: MaterialTextureFields | null | undefined,
): string {
  const t = (typeName ?? '').trim()
  const tex = mat ? materialTextureLabel(mat) : ''
  if (t && tex && tex !== '—') return `${t} — ${tex}`
  if (t) return t
  if (mat) return tex
  return '—'
}

const TEXTURE_DISPLAY_CHARS_PER_LINE = 15
const TEXTURE_DISPLAY_MAX_LINES = 2

/**
 * Для плиток и эскиза: не больше двух строк по ~15 символов; длиннее — обрезка с «…».
 * Возвращает строку с `\n` между строками (нужен CSS `white-space: pre-line`).
 */
export function textureLabelDisplayWrap(
  raw: string,
  charsPerLine: number = TEXTURE_DISPLAY_CHARS_PER_LINE,
  maxLines: number = TEXTURE_DISPLAY_MAX_LINES,
): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t === '—') return '—'
  const maxChars = charsPerLine * maxLines
  const body = t.length > maxChars ? `${t.slice(0, maxChars - 1)}…` : t
  const lines: string[] = []
  for (let i = 0; i < body.length && lines.length < maxLines; i += charsPerLine) {
    lines.push(body.slice(i, i + charsPerLine))
  }
  return lines.join('\n')
}
