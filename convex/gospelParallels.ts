import { query } from "./_generated/server";
import { v } from "convex/values";

export const findParallels = query({
  args: {
    book: v.string(),
    chapter: v.number(),
  },
  handler: async (ctx, args) => {
    // Small static dataset, collecting all is fine
    const all = await ctx.db.query("gospelParallels").collect();
    return all.filter((p) =>
      p.passages.some(
        (passage) =>
          passage.book === args.book && passage.chapter === args.chapter,
      ),
    );
  },
});
