import { getAuthUserId } from "@convex-dev/auth/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function getCurrentUserOrNull(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }

  return await ctx.db.get(userId);
}

export async function getCurrentUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

export async function getCurrentUserIdOrNull(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

type AuthenticatedActionIdentity = NonNullable<
  Awaited<ReturnType<ActionCtx["auth"]["getUserIdentity"]>>
>;

export async function requireActionIdentity(
  ctx: ActionCtx,
): Promise<AuthenticatedActionIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}
