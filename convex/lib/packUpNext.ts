import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { loadInMemoryMembers, type PackMember } from "./packs";
import { loadPassagePackIds } from "./passageDue";
import {
  packUpNextAcrossPacks,
  type PackUpNext,
  type PacingPack,
} from "../../src/lib/pack-pacing";

export type PackUpNextResult = PackUpNext<Id<"packs">, PackMember>;

/**
 * Pack Up-next verses that join today's learning (pack pacing). Every custom
 * pack paces its in-Memory members in `packVerses` order; passages pace their
 * own pieces. A verse in two packs is listed once.
 */
export async function loadPackUpNext(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<PackUpNextResult> {
  const [packs, passagePackIds] = await Promise.all([
    ctx.db
      .query("packs")
      .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
      .collect(),
    loadPassagePackIds(ctx, userId),
  ]);

  const pacedPacks = packs.filter(
    (pack) => pack.kind === "custom" && !passagePackIds.has(pack._id),
  );
  if (pacedPacks.length === 0) return { members: [], byPackId: new Map() };

  const inMemory = await loadInMemoryMembers(ctx, userId);
  const memberByRef = new Map(
    inMemory.map((member) => [member.verseRefId, member]),
  );

  const pacing = await Promise.all(
    pacedPacks.map(
      async (pack): Promise<PacingPack<Id<"packs">, PackMember>> => {
        const rows = await ctx.db
          .query("packVerses")
          .withIndex("by_userId_packId_order", (q) =>
            q.eq("userId", userId).eq("packId", pack._id),
          )
          .order("asc")
          .collect();
        return {
          packId: pack._id,
          kind: "custom",
          members: rows.flatMap((row) => {
            const member = memberByRef.get(row.verseRefId);
            return member ? [member] : [];
          }),
        };
      },
    ),
  );

  return packUpNextAcrossPacks(pacing);
}
