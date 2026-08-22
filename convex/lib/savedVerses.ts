import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { VerseSpan } from "../../src/lib/hearted-verse-coverage";
import { findOrCreateVerseRefId } from "./verseRefs";
import { findSavedVerse, seedVerseMemory } from "./verseMemory";

/**
 * Insert a heart for this exact span if the user does not already have one.
 * Seeds verse memory the same way as the reader toggle add-path.
 * Never deletes or patches an existing `savedVerses` row.
 */
export async function heartSpanIfAbsent(
  ctx: MutationCtx,
  userId: Id<"users">,
  span: VerseSpan,
  now: number,
): Promise<"added" | "exists"> {
  const verseRefId = await findOrCreateVerseRefId(ctx, userId, span);
  const existing = await findSavedVerse(ctx, userId, verseRefId);
  if (existing) {
    return "exists";
  }

  await ctx.db.insert("savedVerses", {
    userId,
    verseRefId,
    book: span.book,
    chapter: span.chapter,
    createdAt: now,
  });
  await seedVerseMemory(ctx, userId, verseRefId, now);
  return "added";
}

/** Join saved rows to their verse refs as `VerseSpan`s for overlap checks. */
export async function loadUserHeartSpans(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<VerseSpan[]> {
  const rows = await ctx.db
    .query("savedVerses")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .collect();

  const spans: VerseSpan[] = [];
  for (const row of rows) {
    const ref = await ctx.db.get(row.verseRefId);
    if (!ref || ref.userId !== userId) {
      continue;
    }
    spans.push({
      book: ref.book,
      chapter: ref.chapter,
      startVerse: ref.startVerse,
      endVerse: ref.endVerse,
    });
  }
  return spans;
}
