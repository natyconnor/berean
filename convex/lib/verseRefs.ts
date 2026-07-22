import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { VerseRefInput } from "./noteContent";

/** Look up an existing verse ref for the user; does not create. */
export async function findVerseRefId(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  ref: VerseRefInput,
): Promise<Id<"verseRefs"> | null> {
  const existing = await ctx.db
    .query("verseRefs")
    .withIndex("by_userId_book_chapter_verses", (q) =>
      q
        .eq("userId", userId)
        .eq("book", ref.book)
        .eq("chapter", ref.chapter)
        .eq("startVerse", ref.startVerse)
        .eq("endVerse", ref.endVerse),
    )
    .unique();
  return existing?._id ?? null;
}

export async function findOrCreateVerseRefId(
  ctx: MutationCtx,
  userId: Id<"users">,
  ref: VerseRefInput,
): Promise<Id<"verseRefs">> {
  // Chapter-scoped note links still index as verse 1 for chapter association.
  const indexedRef = {
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
  };
  const existingId = await findVerseRefId(ctx, userId, indexedRef);
  if (existingId) {
    return existingId;
  }

  return await ctx.db.insert("verseRefs", {
    userId,
    ...indexedRef,
  });
}
