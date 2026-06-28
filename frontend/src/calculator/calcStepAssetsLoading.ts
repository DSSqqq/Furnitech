import { useEffect, useMemo, useState } from 'react'
import { calcCardImageUrlsFromEntity, PROFILE_CARD_IMAGE_SLOT_COUNT, type CalcCardImageEntity } from './calculatorCardTiles'
import { resolveMediaUrl } from './sketchFrame'

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const t = (url ?? '').trim()
    if (!t) {
      resolve()
      return
    }
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = t
  })
}

export function collectCalcCardImageUrls(entities: readonly CalcCardImageEntity[]): string[] {
  const out = new Set<string>()
  for (const entity of entities) {
    for (const u of calcCardImageUrlsFromEntity(entity, PROFILE_CARD_IMAGE_SLOT_COUNT)) {
      const t = (u ?? '').trim()
      if (t) out.add(t)
    }
  }
  return [...out]
}

export function collectMaterialTextureImageUrls(
  materials: readonly { texture_image?: string | null }[] | undefined,
): string[] {
  const out = new Set<string>()
  for (const m of materials ?? []) {
    const img = resolveMediaUrl((m.texture_image ?? '').trim())
    if (img) out.add(img)
  }
  return [...out]
}

/** true — пока изображения предзагружаются (держим оверлей панели). */
export function useCalcImagesPreload(urls: readonly string[], enabled: boolean): boolean {
  const key = urls.join('\0')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const unique = [...new Set(urls.map((u) => (u ?? '').trim()).filter(Boolean))]
    if (unique.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void Promise.all(unique.map(preloadImage)).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, key, urls])

  return loading
}

/** API-загрузка материала + предзагрузка texture_image для эскиза. */
export function useCalcMaterialTexturePreload(
  material: { texture_image?: string | null } | null | undefined,
  materialLoading: boolean,
): boolean {
  const urls = useMemo(
    () => collectMaterialTextureImageUrls(material ? [material] : []),
    [material],
  )
  const imagesLoading = useCalcImagesPreload(urls, !materialLoading && material != null)
  return materialLoading || imagesLoading
}
