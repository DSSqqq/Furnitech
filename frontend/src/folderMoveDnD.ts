import type { DragEvent } from 'react'

export const DND_FOLDER = 'application/x-furnitech-folder-move'
export const DND_MATERIAL = 'application/x-furnitech-material-move'
export const DND_TEXTURE_ITEM = 'application/x-furnitech-texture-item-move'

export function isFolderDrag(e: DragEvent) {
  return e.dataTransfer.types.includes(DND_FOLDER)
}

export function isMaterialDrag(e: DragEvent) {
  return e.dataTransfer.types.includes(DND_MATERIAL)
}

export function isTextureItemDrag(e: DragEvent) {
  return e.dataTransfer.types.includes(DND_TEXTURE_ITEM)
}
