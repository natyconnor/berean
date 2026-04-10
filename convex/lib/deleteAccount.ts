import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Permanently removes all app data and Convex Auth records for a user.
 * Call only from a mutation that has verified the acting user is `userId`.
 */
export async function deleteAllDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  for (const row of await ctx.db
    .query("noteInlineVerseLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("noteVerseLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("verseLinks")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("notes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("savedVerses")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("verseRefs")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("userTags")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("userSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  for (const row of await ctx.db
    .query("highlights")
    .withIndex("by_userId_book_chapter", (q) => q.eq("userId", userId))
    .collect()) {
    await ctx.db.delete(row._id);
  }

  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  const sessionIds = new Set(sessions.map((s) => s._id));
  if (sessionIds.size > 0) {
    for (const verifier of await ctx.db.query("authVerifiers").collect()) {
      if (
        verifier.sessionId !== undefined &&
        sessionIds.has(verifier.sessionId)
      ) {
        await ctx.db.delete(verifier._id);
      }
    }
  }

  for (const session of sessions) {
    await ctx.db.delete(session._id);
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionIdAndParentRefreshTokenId", (q) =>
        q.eq("sessionId", session._id),
      )
      .collect();
    for (const rt of refreshTokens) {
      await ctx.db.delete(rt._id);
    }
  }

  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();

  for (const account of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) {
      await ctx.db.delete(code._id);
    }
    await ctx.db.delete(account._id);
  }

  await ctx.db.delete(userId);
}
