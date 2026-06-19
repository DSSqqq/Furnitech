import { resolveMediaUrl } from './sketchFrame'

type Tex = {
  texture_color?: string
  texture_image?: string | null
}

/** Квадратик превью текстуры/цвета для строк чеклиста (шаги 2 и 4). */
export function MaterialCheckSwatch({
  name,
  material,
  texExtra,
}: {
  name: string
  material: Tex
  texExtra?: Tex | null
}) {
  const texture_image = (material.texture_image ?? texExtra?.texture_image ?? '') || ''
  const texture_color = (material.texture_color ?? texExtra?.texture_color ?? '').trim()
  const img = resolveMediaUrl(String(texture_image))
  if (img) {
    return (
      <div className="frame2-check-swatch" title={name} aria-hidden>
        <img className="frame2-check-swatch-img" src={img} alt="" loading="lazy" decoding="async" />
      </div>
    )
  }
  return (
    <div
      className="frame2-check-swatch"
      title={name}
      aria-hidden
      style={texture_color ? { backgroundColor: texture_color } : undefined}
    />
  )
}
