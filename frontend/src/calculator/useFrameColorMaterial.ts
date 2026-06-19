import { useEffect, useState } from 'react'

import { fetchCalculatorProfileTypes, fetchMaterial } from '../api'
import type { Material } from '../types'
import type { SketchTextureMaterial } from './sketchFrame'

function lsFrameId(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function pickTextureField(a?: string | null, b?: string | null): string | undefined {
  const left = String(a ?? '').trim()
  if (left) return left
  const right = String(b ?? '').trim()
  return right || undefined
}

type FrameColorMaterialSource = (Partial<Material> & SketchTextureMaterial & { id?: number; name?: string }) | null | undefined

/**
 * Как на шаге 2: embedded `color_material` из типа профиля + полный материал из API.
 * Summary нужен, если детальный GET не удался или пришёл без texture_* (на проде чаще, чем локально).
 */
export function mergeFrameColorMaterial(
  summary: FrameColorMaterialSource,
  full: FrameColorMaterialSource,
): Material | null {
  if (!summary && !full) return null
  if (!summary) return full as Material
  if (!full) return summary as Material
  return {
    ...full,
    texture_mode: full.texture_mode ?? summary.texture_mode,
    texture_color: pickTextureField(summary.texture_color, full.texture_color) ?? full.texture_color,
    texture_image: pickTextureField(summary.texture_image, full.texture_image) ?? full.texture_image,
    texture_library_item_name:
      summary.texture_library_item_name ?? full.texture_library_item_name ?? null,
    name: full.name || summary.name,
  } as Material
}

export function useFrameColorMaterial(): {
  frameColorMaterial: Material | null
  frameTypeName: string
} {
  const [frameColorMaterial, setFrameColorMaterial] = useState<Material | null>(null)
  const [frameTypeName, setFrameTypeName] = useState('—')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      const typeId = lsFrameId('calc_frame_type_id')
      const colorId = lsFrameId('calc_frame_color_id')
      let summary: Material | null = null

      try {
        const r = await fetchCalculatorProfileTypes()
        const t = typeId != null ? (r.results ?? []).find((x) => x.id === typeId) ?? null : null
        if (!cancel && t) {
          setFrameTypeName(t.name)
          if (colorId != null) {
            const row = (t.colors ?? []).find((c) => c.color_material_id === colorId)
            summary = (row?.color_material as Material | undefined) ?? null
          }
        }
      } catch {
        /* не блокируем эскиз */
      }

      let full: Material | null = null
      if (colorId != null) {
        try {
          full = await fetchMaterial(colorId)
        } catch {
          /* fallback на summary из типа профиля */
        }
      }

      if (!cancel) setFrameColorMaterial(mergeFrameColorMaterial(summary, full))
    })()
    return () => {
      cancel = true
    }
  }, [])

  return { frameColorMaterial, frameTypeName }
}
