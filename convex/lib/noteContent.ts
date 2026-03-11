import { v, type Infer } from "convex/values"

export const verseRefValue = v.object({
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
})

export const noteBodySegmentValue = v.union(
  v.object({
    type: v.literal("text"),
    text: v.string(),
  }),
  v.object({
    type: v.literal("lineBreak"),
  }),
  v.object({
    type: v.literal("verseRef"),
    label: v.string(),
    ref: verseRefValue,
  })
)

export const noteBodyValue = v.object({
  version: v.literal(1),
  segments: v.array(noteBodySegmentValue),
})

export type VerseRefInput = Infer<typeof verseRefValue>
export type NoteBodyInput = Infer<typeof noteBodyValue>

export function noteBodyToPlainText(body: NoteBodyInput): string {
  return body.segments
    .map((segment) => {
      if (segment.type === "text") return segment.text
      if (segment.type === "lineBreak") return "\n"
      return segment.label
    })
    .join("")
}

export function extractVerseRefsFromNoteBody(body: NoteBodyInput): VerseRefInput[] {
  const refs = new Map<string, VerseRefInput>()
  for (const segment of body.segments) {
    if (segment.type !== "verseRef") continue
    const key = [
      segment.ref.book,
      segment.ref.chapter,
      segment.ref.startVerse,
      segment.ref.endVerse,
    ].join("|")
    if (!refs.has(key)) {
      refs.set(key, segment.ref)
    }
  }
  return Array.from(refs.values())
}
