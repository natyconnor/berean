import type { VerseRef } from "@/lib/verse-ref-utils"

export interface NoteTextSegment {
  type: "text"
  text: string
}

export interface NoteLineBreakSegment {
  type: "lineBreak"
}

export interface NoteVerseRefSegment {
  type: "verseRef"
  label: string
  ref: VerseRef
}

export type NoteBodySegment = NoteTextSegment | NoteLineBreakSegment | NoteVerseRefSegment

export interface NoteBody {
  version: 1
  segments: NoteBodySegment[]
}

export const EMPTY_NOTE_BODY: NoteBody = {
  version: 1,
  segments: [],
}

export function createVerseRefSegment(ref: VerseRef, label: string): NoteVerseRefSegment {
  return {
    type: "verseRef",
    label,
    ref,
  }
}

export function createPlainTextNoteBody(text: string): NoteBody {
  if (text.length === 0) {
    return EMPTY_NOTE_BODY
  }

  const lines = text.split("\n")
  const segments: NoteBodySegment[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].length > 0) {
      segments.push({ type: "text", text: lines[index] })
    }
    if (index < lines.length - 1) {
      segments.push({ type: "lineBreak" })
    }
  }

  return normalizeNoteBody({
    version: 1,
    segments,
  })
}

export function isNoteBody(value: unknown): value is NoteBody {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<NoteBody>
  return candidate.version === 1 && Array.isArray(candidate.segments)
}

export function normalizeNoteBody(body: NoteBody | null | undefined, fallbackText = ""): NoteBody {
  if (!body || body.version !== 1 || !Array.isArray(body.segments)) {
    return createPlainTextNoteBody(fallbackText)
  }

  const normalizedSegments: NoteBodySegment[] = []
  for (const segment of body.segments) {
    if (!segment || typeof segment !== "object" || !("type" in segment)) {
      continue
    }

    if (segment.type === "text") {
      if (segment.text.length === 0) continue
      const previous = normalizedSegments[normalizedSegments.length - 1]
      if (previous?.type === "text") {
        previous.text += segment.text
      } else {
        normalizedSegments.push({ type: "text", text: segment.text })
      }
      continue
    }

    if (segment.type === "lineBreak") {
      const previous = normalizedSegments[normalizedSegments.length - 1]
      if (previous?.type === "lineBreak") {
        continue
      }
      normalizedSegments.push({ type: "lineBreak" })
      continue
    }

    if (
      segment.type === "verseRef" &&
      typeof segment.label === "string" &&
      typeof segment.ref?.book === "string" &&
      typeof segment.ref.chapter === "number" &&
      typeof segment.ref.startVerse === "number" &&
      typeof segment.ref.endVerse === "number"
    ) {
      normalizedSegments.push({
        type: "verseRef",
        label: segment.label,
        ref: {
          book: segment.ref.book,
          chapter: segment.ref.chapter,
          startVerse: segment.ref.startVerse,
          endVerse: segment.ref.endVerse,
        },
      })
    }
  }

  return {
    version: 1,
    segments: normalizedSegments,
  }
}

export function noteBodyToPlainText(body: NoteBody | null | undefined, fallbackText = ""): string {
  const normalized = normalizeNoteBody(body, fallbackText)
  return normalized.segments
    .map((segment) => {
      if (segment.type === "text") return segment.text
      if (segment.type === "lineBreak") return "\n"
      return segment.label
    })
    .join("")
}

export function extractVerseRefsFromNoteBody(body: NoteBody | null | undefined): VerseRef[] {
  const normalized = normalizeNoteBody(body)
  const deduped = new Map<string, VerseRef>()
  for (const segment of normalized.segments) {
    if (segment.type !== "verseRef") continue
    const key = [
      segment.ref.book,
      segment.ref.chapter,
      segment.ref.startVerse,
      segment.ref.endVerse,
    ].join("|")
    if (!deduped.has(key)) {
      deduped.set(key, segment.ref)
    }
  }
  return Array.from(deduped.values())
}

export function truncatePlainTextContent(text: string, limit: number): string {
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, limit)}...`
}
