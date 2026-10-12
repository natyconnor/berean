import { spanCoveredBy, type VerseSpan } from "./hearted-verse-coverage";
import type { MemoryStatus } from "./memory-scheduler";
import { verseMatchesScope, type VerseScope } from "./verse-scope-match";

export type InMemoryRuleInput = {
  /** An exact heart exists for the verse (passage hearts do not count). */
  isHearted: boolean;
  status: MemoryStatus;
  inCustomPack: boolean;
  inScopePack: boolean;
  inActivePassage: boolean;
};

/**
 * Derive `inMemory` for a row written while hearting enrolled verses: hearted
 * verses stay in Memory once started, packed, or inside a passage. Hearted
 * verses that were never started and belong to nothing become hearted-only.
 *
 * Only valid for rows that predate the switch to `inMemory`. Re-applying it
 * later would undo stops and passage absorbs.
 */
export function shouldBeInMemory(input: InMemoryRuleInput): boolean {
  if (!input.isHearted) return false;
  return (
    input.status !== "new" ||
    input.inCustomPack ||
    input.inScopePack ||
    input.inActivePassage
  );
}

/**
 * The `inMemory` value a backfill writes. Rows that already have a value were
 * written by memorize / stop / passage absorb and keep it; only rows that
 * predate the switch (`undefined`) are derived. `force` re-derives every row.
 */
export function backfilledInMemory(
  current: boolean | undefined,
  derive: () => boolean,
  force: boolean,
): boolean {
  if (!force && current !== undefined) return current;
  return derive();
}

/** A user's pack and passage membership, loaded once per backfill. */
export type InMemoryMembership = {
  customPackVerseRefIds: ReadonlySet<string>;
  scopes: readonly VerseScope[];
  /** Per-chapter spans of every active passage (`passageHeartSpans`). */
  passageSpans: readonly VerseSpan[];
};

export function inMemoryMembershipFlags(
  verseRefId: string,
  span: VerseSpan,
  membership: InMemoryMembership,
): Pick<InMemoryRuleInput, "inCustomPack" | "inScopePack" | "inActivePassage"> {
  return {
    inCustomPack: membership.customPackVerseRefIds.has(verseRefId),
    inScopePack: membership.scopes.some((scope) =>
      verseMatchesScope(span, scope),
    ),
    inActivePassage: spanCoveredBy(span, membership.passageSpans),
  };
}
