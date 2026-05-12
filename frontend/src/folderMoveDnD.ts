import type { DragEvent } from 'react'

export const DND_FOLDER = 'application/x-furnitech-folder-move'
export const DND_MATERIAL = 'application/x-furnitech-material-move'

export function isFolderDrag(e: DragEvent) {
  return e.dataTransfer.types.includes(DND_FOLDER)
}

export function isMaterialDrag(e: DragEvent) {
  return e.dataTransfer.types.includes(DND_MATERIAL)
}
