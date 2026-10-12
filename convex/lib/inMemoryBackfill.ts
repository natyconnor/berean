import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  passageHeartSpans,
  spanCoveredBy,
  type VerseSpan,
} from "../../src/lib/hearted-verse-coverage";
import {
  backfilledInMemory,
  inMemoryMembershipFlags,
  shouldBeInMemory,
  type InMemoryMembership,
} from "../../src/lib/in-memory-migration";
import type { VerseScope } from "../../src/lib/verse-scope-match";
import { ensurePassageHearts } from "./memorize";
import { loadUserHeartSpans } from "./savedVerses";

export type InMemoryBackfillCounts = {
  rows: number;
  inMemory: number;
  heartedOnly: number;
  changed: number;
  passageHeartsCreated: number;
  passageHeartsLinked: number;
};

async function findUserMemoryStats(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"userMemoryStats"> | null> {
  return await ctx.db
    .query("userMemoryStats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/** True once {@link backfillInMemoryForUser} has run for this user. */
export async function hasInMemoryBackfill(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const stats = await findUserMemoryStats(ctx, userId);
  return stats?.inMemoryBackfilledAt !== undefined;
}

/**
 * Derive `verseMemory.inMemory` for every row the user has, create the
 * passage heart for every active passage, rebuild `userMemoryStats` from the
 * in-Memory set, and stamp `inMemoryBackfilledAt`.
 *
 * Only rows whose `inMemory` is still unset are derived; rows the new code
 * already wrote keep their value unless `force` is set. Stats count every
 * in-Memory row either way.
 *
 * Idempotent: rows are only patched when the derived value changes, and
 * passage hearts are linked or created once. Callers decide whether to skip
 * users who are already stamped.
 */
export async function backfillInMemoryForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  opts: { force?: boolean } = {},
): Promise<InMemoryBackfillCounts> {
  const packs = await ctx.db
    .query("packs")
    .withIndex("by_userId_lastOpenedAt", (q) => q.eq("userId", userId))
    .collect();
  const packById = new Map(packs.map((pack) => [pack._id, pack]));

  const passages = (
    await ctx.db
      .query("passageMemory")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
  ).filter((passage) => packById.has(passage.packId));

  let passageHeartsCreated = 0;
  let passageHeartsLinked = 0;
  for (const passage of passages) {
    const result = await ensurePassageHearts(ctx, userId, passage, now);
    passageHeartsCreated += result.created;
    passageHeartsLinked += result.linked;
  }

  const [memories, saved, packVerses] = await Promise.all([
    ctx.db
      .query("verseMemory")
      .withIndex("by_userId_verseRefId", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("savedVerses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("packVerses")
      .withIndex("by_userId_verseRefId", (q) => q.eq("userId", userId))
      .collect(),
  ]);

  // A passage heart stands for the passage, not for a verse item with the
  // same span, so it must not make that item count as hearted.
  const heartedVerseRefIds = new Set<Id<"verseRefs">>(
    saved
      .filter((row) => row.passageMemoryId === undefined)
      .map((row) => row.verseRefId),
  );
  const scopes: VerseScope[] = [];
  for (const pack of packs) {
    if (pack.kind === "scope" && pack.scope) scopes.push(pack.scope);
  }
  const membership: InMemoryMembership = {
    customPackVerseRefIds: new Set<string>(
      packVerses
        .filter((row) => packById.get(row.packId)?.kind === "custom")
        .map((row) => row.verseRefId),
    ),
    scopes,
    passageSpans: passages.flatMap((passage) =>
      passageHeartSpans(passage.pieces),
    ),
  };

  const rows = await Promise.all(
    memories.map(async (memory) => ({
      memory,
      ref: await ctx.db.get(memory.verseRefId),
    })),
  );

  const stats = { new: 0, learning: 0, reviewing: 0, mastered: 0, total: 0 };
  let inMemory = 0;
  let heartedOnly = 0;
  let changed = 0;

  for (const { memory, ref } of rows) {
    const isHearted = heartedVerseRefIds.has(memory.verseRefId);
    const next = backfilledInMemory(
      memory.inMemory,
      () =>
        ref !== null &&
        ref.userId === userId &&
        shouldBeInMemory({
          isHearted,
          status: memory.status,
          ...inMemoryMembershipFlags(memory.verseRefId, ref, membership),
        }),
      opts.force === true,
    );

    if (memory.inMemory !== next) {
      await ctx.db.patch(memory._id, { inMemory: next });
      changed += 1;
    }

    if (next) {
      inMemory += 1;
      stats[memory.status] += 1;
      stats.total += 1;
    } else if (isHearted) {
      heartedOnly += 1;
    }
  }

  const existingStats = await findUserMemoryStats(ctx, userId);
  if (existingStats) {
    await ctx.db.patch(existingStats._id, {
      ...stats,
      updatedAt: now,
      inMemoryBackfilledAt: now,
    });
  } else {
    await ctx.db.insert("userMemoryStats", {
      userId,
      ...stats,
      updatedAt: now,
      inMemoryBackfilledAt: now,
    });
  }

  return {
    rows: memories.length,
    inMemory,
    heartedOnly,
    changed,
    passageHeartsCreated,
    passageHeartsLinked,
  };
}

export type InMemoryInvariantReport = {
  inMemoryRows: number;
  uncoveredVerseMemoryIds: Id<"verseMemory">[];
  activePassages: number;
  passageMemoryIdsWithoutHeart: Id<"passageMemory">[];
};

/**
 * In-Memory rows that no heart contains, and active passages missing a
 * passage heart for any of their chapters. Both lists are empty when the
 * invariant holds.
 */
export async function checkInMemoryInvariantForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<InMemoryInvariantReport> {
  const [inMemoryRows, hearts, passages] = await Promise.all([
    ctx.db
      .query("verseMemory")
      .withIndex("by_userId_inMemory", (q) =>
        q.eq("userId", userId).eq("inMemory", true),
      )
      .collect(),
    loadUserHeartSpans(ctx, userId),
    ctx.db
      .query("passageMemory")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect(),
  ]);

  const uncoveredVerseMemoryIds: Id<"verseMemory">[] = [];
  for (const memory of inMemoryRows) {
    const ref = await ctx.db.get(memory.verseRefId);
    if (!ref || ref.userId !== userId || !spanCoveredBy(ref, hearts)) {
      uncoveredVerseMemoryIds.push(memory._id);
    }
  }

  let activePassages = 0;
  const passageMemoryIdsWithoutHeart: Id<"passageMemory">[] = [];
  for (const passage of passages) {
    const pack = await ctx.db.get(passage.packId);
    if (!pack || pack.userId !== userId) continue;
    activePassages += 1;

    const linkedRows = await ctx.db
      .query("savedVerses")
      .withIndex("by_userId_passageMemoryId", (q) =>
        q.eq("userId", userId).eq("passageMemoryId", passage._id),
      )
      .collect();
    const linkedSpans: VerseSpan[] = [];
    for (const row of linkedRows) {
      const ref = await ctx.db.get(row.verseRefId);
      if (ref && ref.userId === userId) linkedSpans.push(ref);
    }
    const missing = passageHeartSpans(passage.pieces).some(
      (span) => !spanCoveredBy(span, linkedSpans),
    );
    if (missing) passageMemoryIdsWithoutHeart.push(passage._id);
  }

  return {
    inMemoryRows: inMemoryRows.length,
    uncoveredVerseMemoryIds,
    activePassages,
    passageMemoryIdsWithoutHeart,
  };
}
