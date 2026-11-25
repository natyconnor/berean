import { describe, expect, it } from "vitest";

import type { QueryCtx } from "../../convex/_generated/server";
import {
  applyNoteChange,
  computeOnboardingMilestones,
  countNotes,
  type NoteMilestoneCounts,
} from "../../convex/lib/onboarding";
import { getOnboardingStatus } from "../../convex/onboarding";
import { resolveTutorialStatus } from "../../convex/lib/tutorial";
import {
  READING_MIN_TOTAL_NOTES,
  SEARCH_MIN_DISTINCT_TAGS,
  SEARCH_MIN_NOTES_TOTAL,
  SEARCH_MIN_NOTES_WITH_TAGS,
  STARTER_TAGS_MIN_TAGGED_NOTES,
  STUDY_MIN_NOTES,
  VERSE_LINKS_MIN_NOTES,
  shouldRevealReadingMode,
  shouldRevealSearch,
  shouldRevealStarterTags,
  shouldRevealStudy,
  shouldRevealVerseLinks,
} from "./staged-onboarding-thresholds";

const USER_ID = "user_1";

/** Fake Convex ctx that serves rows per table and records what was read. */
function fakeCtx(
  tables: Record<string, unknown[]>,
  signedIn = true,
): { ctx: QueryCtx; reads: string[] } {
  const reads: string[] = [];
  const query = (table: string) => {
    reads.push(table);
    const rows = tables[table] ?? [];
    const chain = {
      withIndex: () => chain,
      first: () => Promise.resolve(rows[0] ?? null),
      unique: () => Promise.resolve(rows[0] ?? null),
      take: (n: number) => Promise.resolve(rows.slice(0, n)),
      collect: () => Promise.resolve(rows),
    };
    return chain;
  };
  const ctx = {
    auth: {
      getUserIdentity: () =>
        Promise.resolve(signedIn ? { subject: `${USER_ID}|session_1` } : null),
    },
    db: {
      query,
      get: (id: string) => {
        reads.push(`get:${id}`);
        return Promise.resolve(null);
      },
    },
  };
  return { ctx: ctx as unknown as QueryCtx, reads };
}

function rollupRow(counts: NoteMilestoneCounts) {
  return { _id: "rollup_1", userId: USER_ID, ...counts, updatedAt: 0 };
}

async function milestonesFor(counts: NoteMilestoneCounts) {
  const { ctx } = fakeCtx({ userOnboardingMilestones: [rollupRow(counts)] });
  const milestones = await computeOnboardingMilestones(ctx, USER_ID as never);
  if (!milestones) throw new Error("expected milestones");
  return milestones;
}

function notes(count: number, tags: string[] = []) {
  return Array.from({ length: count }, () => ({ tags }));
}

const getOnboardingStatusHandler = (
  getOnboardingStatus as unknown as {
    _handler: (ctx: QueryCtx, args: object) => Promise<unknown>;
  }
)._handler;

describe("note milestone rollup", () => {
  it("counts create, retag, and delete, including distinct tags", () => {
    let counts = countNotes([]);
    counts = applyNoteChange(counts, null, []);
    counts = applyNoteChange(counts, null, ["grace"]);
    counts = applyNoteChange(counts, null, ["grace", "faith"]);
    expect(counts.notesCount).toBe(3);
    expect(counts.taggedNotesCount).toBe(2);
    expect(counts.tagCounts).toHaveLength(2);

    // Removing "faith" from its only note drops the distinct count.
    counts = applyNoteChange(counts, ["grace", "faith"], ["grace"]);
    expect(counts.tagCounts).toEqual([{ tag: "grace", count: 2 }]);

    // "grace" stays while another note still uses it.
    counts = applyNoteChange(counts, ["grace"], null);
    expect(counts).toEqual({
      notesCount: 2,
      taggedNotesCount: 1,
      tagCounts: [{ tag: "grace", count: 1 }],
    });

    // Untagging the last tagged note.
    counts = applyNoteChange(counts, ["grace"], []);
    expect(counts).toEqual({
      notesCount: 2,
      taggedNotesCount: 0,
      tagCounts: [],
    });
  });

  it("matches a full recount after the same writes", () => {
    const incremental = [
      [null, ["a"]],
      [null, ["a", "b"]],
      [null, []],
      [["a", "b"], ["b"]],
      [[], null],
    ].reduce<NoteMilestoneCounts>(
      (counts, [before, after]) => applyNoteChange(counts, before, after),
      countNotes([]),
    );
    expect(incremental).toEqual(countNotes([{ tags: ["a"] }, { tags: ["b"] }]));
  });

  it("stores true totals past the old 30-note scan cap (F2)", () => {
    const counts = countNotes([
      ...notes(40),
      { tags: ["late"] },
      { tags: ["later"] },
    ]);
    expect(counts.notesCount).toBe(42);
    expect(counts.taggedNotesCount).toBe(2);
    expect(counts.tagCounts).toHaveLength(2);
  });
});

describe("tutorial thresholds from the rollup", () => {
  it("gates note-count stages at 2 / 4 / 8 / 12 notes", async () => {
    const at = (n: number) => milestonesFor(countNotes(notes(n)));

    expect(shouldRevealVerseLinks(await at(VERSE_LINKS_MIN_NOTES - 1))).toBe(
      false,
    );
    expect(shouldRevealVerseLinks(await at(VERSE_LINKS_MIN_NOTES))).toBe(true);
    expect(shouldRevealStudy(await at(STUDY_MIN_NOTES - 1))).toBe(false);
    expect(shouldRevealStudy(await at(STUDY_MIN_NOTES))).toBe(true);
    expect(shouldRevealSearch(await at(SEARCH_MIN_NOTES_TOTAL - 1))).toBe(
      false,
    );
    expect(shouldRevealSearch(await at(SEARCH_MIN_NOTES_TOTAL))).toBe(true);
    expect(shouldRevealReadingMode(await at(READING_MIN_TOTAL_NOTES - 1))).toBe(
      false,
    );
    expect(shouldRevealReadingMode(await at(READING_MIN_TOTAL_NOTES))).toBe(
      true,
    );
  });

  it("gates starter tags on tagged notes and Search on distinct tags", async () => {
    expect(shouldRevealStarterTags(await milestonesFor(countNotes([])))).toBe(
      false,
    );
    expect(
      shouldRevealStarterTags(
        await milestonesFor(
          countNotes(notes(STARTER_TAGS_MIN_TAGGED_NOTES, ["grace"])),
        ),
      ),
    ).toBe(true);

    const withTags = (tags: string[]) =>
      milestonesFor(
        countNotes([
          ...notes(SEARCH_MIN_NOTES_WITH_TAGS - tags.length),
          ...tags.map((tag) => ({ tags: [tag] })),
        ]),
      );
    expect(SEARCH_MIN_DISTINCT_TAGS).toBe(2);
    expect(shouldRevealSearch(await withTags(["a"]))).toBe(false);
    expect(shouldRevealSearch(await withTags(["a", "b"]))).toBe(true);
  });
});

describe("getOnboardingStatus", () => {
  it("returns the signed-out defaults without reading anything (F4)", async () => {
    const { ctx, reads } = fakeCtx({}, false);
    expect(await getOnboardingStatusHandler(ctx, {})).toEqual({
      ...resolveTutorialStatus(null),
      milestones: {
        notesCount: 0,
        taggedNotesCount: 0,
        distinctTagCount: 0,
        heartsCount: 0,
        hasInlineVerseLink: false,
        hasExplicitVerseLink: false,
        starterTagCount: 0,
        customTagCount: 0,
      },
      hints: [],
    });
    expect(reads).toEqual([]);
  });

  it("reads the rollup row and bounded flags, never note documents (F1, F5)", async () => {
    const { ctx, reads } = fakeCtx({
      userOnboardingMilestones: [
        rollupRow(countNotes([...notes(30), { tags: ["grace"] }])),
      ],
      noteInlineVerseLinks: [{}],
      savedVerses: [{}, {}, {}],
      userTags: [{ source: "starter" }, { source: "custom" }],
      userFeatureHints: [{ hintId: "search", shownAt: 5 }],
    });

    const status = await getOnboardingStatusHandler(ctx, {});

    expect(status).toMatchObject({
      milestones: {
        notesCount: 31,
        taggedNotesCount: 1,
        distinctTagCount: 1,
        heartsCount: 2,
        hasInlineVerseLink: true,
        hasExplicitVerseLink: false,
        starterTagCount: 1,
        customTagCount: 1,
      },
      hints: [{ hintId: "search", shownAt: 5 }],
    });
    expect(reads).not.toContain("notes");
    expect(reads.some((read) => read.startsWith("get:"))).toBe(false);
  });

  it("returns null until the rollup exists, without scanning notes", async () => {
    const { ctx, reads } = fakeCtx({ notes: notes(20) });
    expect(await getOnboardingStatusHandler(ctx, {})).toBeNull();
    expect(reads).toEqual(["userOnboardingMilestones"]);
  });
});
