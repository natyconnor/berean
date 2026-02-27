import { useState, useCallback } from "react"

interface VerseSelection {
  startVerse: number
  endVerse: number
}

export function useVerseSelection(onSelectionComplete: (selection: VerseSelection) => void) {
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((verseNumber: number) => {
    setIsDragging(true)
    setSelectionStart(verseNumber)
    setSelectionEnd(verseNumber)
  }, [])

  const handleMouseEnter = useCallback((verseNumber: number) => {
    if (isDragging && selectionStart !== null) {
      setSelectionEnd(verseNumber)
    }
  }, [isDragging, selectionStart])

  const handleMouseUp = useCallback(() => {
    if (isDragging && selectionStart !== null && selectionEnd !== null) {
      const start = Math.min(selectionStart, selectionEnd)
      const end = Math.max(selectionStart, selectionEnd)
      onSelectionComplete({ startVerse: start, endVerse: end })
    }
    setIsDragging(false)
    setSelectionStart(null)
    setSelectionEnd(null)
  }, [isDragging, selectionStart, selectionEnd, onSelectionComplete])

  const clearSelection = useCallback(() => {
    setSelectionStart(null)
    setSelectionEnd(null)
    setIsDragging(false)
  }, [])

  const isInSelection = useCallback(
    (verseNumber: number) => {
      if (selectionStart === null || selectionEnd === null) return false
      const start = Math.min(selectionStart, selectionEnd)
      const end = Math.max(selectionStart, selectionEnd)
      return verseNumber >= start && verseNumber <= end
    },
    [selectionStart, selectionEnd]
  )

  const isSelecting = isDragging && selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd

  return {
    selectionStart,
    selectionEnd,
    isSelecting,
    isInSelection,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    clearSelection,
  }
}
