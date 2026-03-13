import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type TagMatchMode = "any" | "all";

export const MAX_TAG_LENGTH = 48;

export function normalizeTag(rawTag: string): string {
  return rawTag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, MAX_TAG_LENGTH);
}

export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawTag of rawTags) {
    const tag = normalizeTag(rawTag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}

export function matchesTagFilters(
  noteTags: string[],
  selectedTags: string[],
  matchMode: TagMatchMode,
): boolean {
  if (selectedTags.length === 0) return true;
  if (noteTags.length === 0) return false;

  const noteTagSet = new Set(normalizeTags(noteTags));
  if (matchMode === "all") {
    return selectedTags.every((tag) => noteTagSet.has(tag));
  }
  return selectedTags.some((tag) => noteTagSet.has(tag));
}

export async function syncUserTagsFromNote(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  tags: string[],
  now: number,
): Promise<void> {
  const normalizedTags = normalizeTags(tags);
  for (const tag of normalizedTags) {
    const existing = await ctx.db
      .query("userTags")
      .withIndex("by_userId_tag", (q) => q.eq("userId", userId).eq("tag", tag))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        label: existing.label || tag,
        updatedAt: now,
        lastUsedAt: now,
      });
      continue;
    }

    await ctx.db.insert("userTags", {
      userId,
      tag,
      label: tag,
      source: "custom",
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    });
  }
}
