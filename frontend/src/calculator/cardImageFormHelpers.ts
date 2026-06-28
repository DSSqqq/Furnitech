import { useCallback, useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import {
  CALC_CARD_IMAGE_SLOT_COUNT,
  compactCardImageSlots,
  emptyCardImageUrls,
  firstEmptyCardImageSlot,
} from './calculatorCardTiles'

type CardImageFormHandlersOptions = {
  maxSlots: number
  tileUrls: readonly string[]
  setFiles: Dispatch<SetStateAction<(File | null)[]>>
  setTextures: Dispatch<SetStateAction<(number | null)[]>>
  setTextureUrls: Dispatch<SetStateAction<string[]>>
  onOpenTexturePicker: (slot: number) => void
}

export function useCardImageFormHandlers({
  maxSlots,
  tileUrls,
  setFiles,
  setTextures,
  setTextureUrls,
  onOpenTexturePicker,
}: CardImageFormHandlersOptions) {
  const cardFileInputRef = useRef<HTMLInputElement>(null)
  const pendingFileSlotRef = useRef<number | null>(null)

  const onAddCardImage = useCallback(() => {
    const slot = firstEmptyCardImageSlot(tileUrls, maxSlots)
    if (slot == null) return
    onOpenTexturePicker(slot)
  }, [maxSlots, onOpenTexturePicker, tileUrls])

  const onReplaceCardImage = useCallback(
    (slot: number) => {
      onOpenTexturePicker(slot)
    },
    [onOpenTexturePicker],
  )

  const onRemoveCardImage = useCallback(
    (slot: number) => {
      setFiles((prev) => {
        const next = [...prev]
        next[slot] = null
        return compactCardImageSlots(next, maxSlots, null, (f) => f != null)
      })
      setTextures((prev) => {
        const next = [...prev]
        next[slot] = null
        return compactCardImageSlots(next, maxSlots, null, (t) => t != null)
      })
      setTextureUrls((prev) => {
        const next = [...prev]
        next[slot] = ''
        return compactCardImageSlots(next, maxSlots, '', (u) => !!u.trim())
      })
      if (cardFileInputRef.current) cardFileInputRef.current.value = ''
    },
    [maxSlots, setFiles, setTextures, setTextureUrls],
  )

  const onCardFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null
      const slot = pendingFileSlotRef.current
      if (slot == null) return
      setFiles((prev) => {
        const next = [...prev]
        next[slot] = file
        return next
      })
      setTextures((prev) => {
        const next = [...prev]
        next[slot] = null
        return next
      })
      setTextureUrls((prev) => {
        const next = [...prev]
        next[slot] = ''
        return next
      })
      pendingFileSlotRef.current = null
      e.target.value = ''
    },
    [setFiles, setTextures, setTextureUrls],
  )

  const resetCardFileInput = useCallback(() => {
    pendingFileSlotRef.current = null
    if (cardFileInputRef.current) cardFileInputRef.current.value = ''
  }, [])

  return {
    cardFileInputRef,
    onAddCardImage,
    onReplaceCardImage,
    onRemoveCardImage,
    onCardFileInputChange,
    resetCardFileInput,
  }
}

export function useCardFilePreviewUrls(files: readonly (File | null)[]): string[] {
  const fileKey = files.map((f) => (f ? `${f.name}-${f.size}-${f.lastModified}` : '')).join('|')
  const [urls, setUrls] = useState<string[]>(() => files.map(() => ''))

  useEffect(() => {
    const next = files.map((f) => (f ? URL.createObjectURL(f) : ''))
    setUrls(next)
    return () => {
      for (const u of next) {
        if (u) URL.revokeObjectURL(u)
      }
    }
  }, [fileKey, files.length])

  return urls
}

export function resetCardImageArrays(
  maxSlots: number,
  setFiles: Dispatch<SetStateAction<(File | null)[]>>,
  setTextures: Dispatch<SetStateAction<(number | null)[]>>,
  setTextureUrls: Dispatch<SetStateAction<string[]>>,
  emptyFiles: () => (File | null)[],
  emptyTextures: () => (number | null)[],
) {
  setFiles(emptyFiles())
  setTextures(emptyTextures())
  setTextureUrls(emptyCardImageUrls(maxSlots))
}

export { CALC_CARD_IMAGE_SLOT_COUNT, emptyCardImageUrls, firstEmptyCardImageSlot }
