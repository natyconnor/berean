import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserIdOrNull } from "./lib/auth";
import { loadPassageForPack, toPassageView } from "./lib/passageMemory";
import { passageViewValidator } from "./lib/passageValues";

/**
 * Passage-mode overlay on a pack. Returns `null` when the caller is
 * unauthenticated, the pack is missing or unowned, or no passage row exists.
 */
export const getForPack = query({
  args: {
    packId: v.id("packs"),
    now: v.number(),
    tzOffsetMinutes: v.number(),
  },
  returns: v.union(passageViewValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const row = await loadPassageForPack(ctx, args.packId, userId);
    if (!row) return null;

    return toPassageView(row, args.now, args.tzOffsetMinutes);
  },
});
