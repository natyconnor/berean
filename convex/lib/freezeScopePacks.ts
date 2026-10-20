import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  packAllowsPassageMode,
  rangeAllowsPassageMode,
} from "../../src/lib/passage-eligibility";
import { filterScopeMembers, loadInMemoryMembers } from "./packs";
import { loadPassagePackIds } from "./passageDue";

export interface FreezeScopePacksCounts {
  packsFrozen: number;
  packsKept: number;
  versesListed: number;
}

/** An unstarted scope pack with nothing in it can still be learned as a passage. */
function waitingToBecomePassage(
  pack: Doc<"packs">,
  memberCount: number,
): boolean {
  return (
    memberCount === 0 &&
    pack.scope !== undefined &&
    packAllowsPassageMode(pack.scope) &&
    (pack.passageRange === undefined ||
      rangeAllowsPassageMode(pack.passageRange))
  );
}

/**
 * Turn each of the user's scope packs that isn't a passage into a custom pack
 * that lists the in-Memory verses its scope holds right now, so it stops
 * picking up new ones. Empty packs that can still be learned as a passage
 * keep their scope. Idempotent: a frozen pack is custom and is skipped.
 */
export async function freezeScopePacksForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
): Promise<FreezeScopePacksCounts> {
  const counts: FreezeScopePacksCounts = {
    packsFrozen: 0,
    packsKept: 0,
    versesListed: 0,
  };
  const [packs, passagePackIds] = await Promise.all([
    ctx.db
      .query("packs")
      .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
      .collect(),
    loadPassagePackIds(ctx, userId),
  ]);
  const legacy = packs.filter(
    (pack) => pack.kind === "scope" && !passagePackIds.has(pack._id),
  );
  if (legacy.length === 0) return counts;

  const inMemory = await loadInMemoryMembers(ctx, userId);
  for (const pack of legacy) {
    const members = pack.scope
      ? filterScopeMembers(inMemory, pack.scope, pack.passageRange)
      : [];
    if (waitingToBecomePassage(pack, members.length)) {
      counts.packsKept += 1;
      continue;
    }

    const existing = await ctx.db
      .query("packVerses")
      .withIndex("by_userId_packId_order", (q) =>
        q.eq("userId", userId).eq("packId", pack._id),
      )
      .collect();
    const listed = new Set(existing.map((row) => row.verseRefId));
    let order = existing.length;
    for (const member of members) {
      if (listed.has(member.verseRefId)) continue;
      await ctx.db.insert("packVerses", {
        userId,
        packId: pack._id,
        verseRefId: member.verseRefId,
        order,
        createdAt: now,
      });
      order += 1;
      counts.versesListed += 1;
    }

    // Unified review is scope-only, and a chapter preset reuses its pack by
    // `presetId` to start it as a passage.
    await ctx.db.patch(pack._id, {
      kind: "custom",
      scope: undefined,
      passageRange: undefined,
      presetId: undefined,
      unifiedReviewEnabled: undefined,
    });
    counts.packsFrozen += 1;
  }
  return counts;
}
