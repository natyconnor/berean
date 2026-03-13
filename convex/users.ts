import { query } from "./_generated/server";
import { getCurrentUserIdOrNull } from "./lib/auth";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
