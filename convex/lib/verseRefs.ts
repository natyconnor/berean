import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { VerseRefInput } from "./noteContent";

function normalizeVerseRefInput(ref: VerseRefInput): VerseRefInput {
  if (ref.scope === "chapter") {
    return {
      book: ref.book,
      chapter: ref.chapter,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    };
  }
  return {
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
  };
}

function sameScope(
  stored: { scope?: "chapter" } | null | undefined,
  wanted: VerseRefInput,
): boolean {
  return (stored?.scope === "chapter") === (wanted.scope === "chapter");
}

/** Look up an existing verse ref for the user; does not create. */
export async function findVerseRefId(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  ref: VerseRefInput,
): Promise<Id<"verseRefs"> | null> {
  const normalized = normalizeVerseRefInput(ref);
  const matches = await ctx.db
    .query("verseRefs")
    .withIndex("by_userId_book_chapter_verses", (q) =>
      q
        .eq("userId", userId)
        .eq("book", normalized.book)
        .eq("chapter", normalized.chapter)
        .eq("startVerse", normalized.startVerse)
        .eq("endVerse", normalized.endVerse),
    )
    .collect();
  const existing = matches.find((row) => sameScope(row, normalized));
  return existing?._id ?? null;
}

export async function findOrCreateVerseRefId(
  ctx: MutationCtx,
  userId: Id<"users">,
  ref: VerseRefInput,
): Promise<Id<"verseRefs">> {
  const normalized = normalizeVerseRefInput(ref);
  const existingId = await findVerseRefId(ctx, userId, normalized);
  if (existingId) {
    return existingId;
  }

  return await ctx.db.insert("verseRefs", {
    userId,
    book: normalized.book,
    chapter: normalized.chapter,
    startVerse: normalized.startVerse,
    endVerse: normalized.endVerse,
    ...(normalized.scope === "chapter" ? { scope: "chapter" as const } : {}),
  });
}
