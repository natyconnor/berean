import type { MutationCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import type { VerseRefInput } from "./noteContent"

export async function findOrCreateVerseRefId(
  ctx: MutationCtx,
  userId: Id<"users">,
  ref: VerseRefInput
): Promise<Id<"verseRefs">> {
  const existing = await ctx.db
    .query("verseRefs")
    .withIndex("by_userId_book_chapter_verses", (q) =>
      q
        .eq("userId", userId)
        .eq("book", ref.book)
        .eq("chapter", ref.chapter)
        .eq("startVerse", ref.startVerse)
        .eq("endVerse", ref.endVerse)
    )
    .unique()

  if (existing) {
    return existing._id
  }

  return await ctx.db.insert("verseRefs", {
    userId,
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
  })
}
