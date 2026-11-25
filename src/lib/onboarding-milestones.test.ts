import { describe, expect, it } from "vitest";

import { getFunctionName, type FunctionReference } from "convex/server";

import type { MutationCtx, QueryCtx } from "../../convex/_generated/server";
import {
  NOTE_RECOUNT_PAGE_SIZE,
  applyNoteChange,
  computeOnboardingMilestones,
  countNotes,
  recordNoteChange,
  type NoteMilestoneCounts,
} from "../../convex/lib/onboarding";
import { backfillNoteMilestones } from "../../convex/migrations";
import {
  ensureNoteMilestones,
  getOnboardingStatus,
  recountNoteMilestones,
} from "../../convex/onboarding";
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

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type Handler = (ctx: MutationCtx, args: object) => Promise<unknown>;

function handlerOf(fn: unknown): Handler {
  return (fn as { _handler: Handler })._handler;
}

const HANDLERS: Record<string, Handler> = {
  "onboarding:recountNoteMilestones": handlerOf(recountNoteMilestones),
  "migrations:backfillNoteMilestones": handlerOf(backfillNoteMilestones),
};

/**
 * In-memory stand-in for a Convex ctx: index reads with eq/gt, inserts,
 * patches, deletes, pagination, and a scheduler queue that `drain` runs.
 * Records every table queried and every `db.get`.
 */
function fakeCtx(tables: Record<string, object[]> = {}, signedIn = true) {
  let clock = 0;
  const reads: string[] = [];
  const scheduled: { name: string; args: object }[] = [];
  const db: Record<string, Row[]> = {};
  const insertRow = (table: string, doc: object) => {
    clock += 1;
    const row: Row = { _id: `${table}_${clock}`, _creationTime: clock };
    for (const [key, value] of Object.entries({ userId: USER_ID, ...doc })) {
      if (value !== undefined) row[key] = value;
    }
    (db[table] ??= []).push(row);
    return row._id;
  };
  for (const [table, rows] of Object.entries(tables)) {
    for (const row of rows) insertRow(table, row);
  }
  (db.users ??= []).push({ _id: USER_ID, _creationTime: 0 });
  const findRow = (id: string) => {
    for (const rows of Object.values(db)) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) return { rows, index };
    }
    return null;
  };

  const query = (table: string) => {
    reads.push(table);
    const filters: ((row: Row) => boolean)[] = [];
    const rows = () =>
      (db[table] ?? [])
        .filter((row) => filters.every((keep) => keep(row)))
        .sort((a, b) => a._creationTime - b._creationTime);
    const range = {
      eq: (field: string, value: unknown) => {
        filters.push((row) => row[field] === value);
        return range;
      },
      gt: (field: string, value: number) => {
        filters.push((row) => (row[field] as number) > value);
        return range;
      },
    };
    const chain = {
      withIndex: (_name: string, build?: (q: typeof range) => unknown) => {
        build?.(range);
        return chain;
      },
      first: () => Promise.resolve(rows()[0] ?? null),
      unique: () => Promise.resolve(rows()[0] ?? null),
      take: (n: number) => Promise.resolve(rows().slice(0, n)),
      collect: () => Promise.resolve(rows()),
      paginate: (opts: { cursor: string | null; numItems: number }) => {
        const offset = Number(opts.cursor ?? 0);
        const all = rows();
        const end = offset + opts.numItems;
        return Promise.resolve({
          page: all.slice(offset, end),
          isDone: end >= all.length,
          continueCursor: String(end),
        });
      },
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
        const found = findRow(id);
        return Promise.resolve(found ? found.rows[found.index] : null);
      },
      insert: (table: string, doc: object) =>
        Promise.resolve(insertRow(table, doc)),
      patch: (id: string, fields: object) => {
        const found = findRow(id);
        if (!found) throw new Error(`missing ${id}`);
        const row = found.rows[found.index];
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) delete row[key];
          else row[key] = value;
        }
        return Promise.resolve();
      },
      delete: (id: string) => {
        const found = findRow(id);
        if (found) found.rows.splice(found.index, 1);
        return Promise.resolve();
      },
    },
    scheduler: {
      runAfter: (
        _delay: number,
        ref: FunctionReference<"mutation", "internal">,
        args: object,
      ) => {
        scheduled.push({ name: getFunctionName(ref), args });
        return Promise.resolve();
      },
    },
  };
  const typed = ctx as unknown as MutationCtx;

  return {
    ctx: typed,
    reads,
    scheduled,
    rows: (table: string) => db[table] ?? [],
    rollup: () => db.userOnboardingMilestones?.[0],
    /** Run the next scheduled job (FIFO). */
    step: async () => {
      const job = scheduled.shift();
      if (!job) return false;
      await HANDLERS[job.name](typed, job.args);
      return true;
    },
    drain: async () => {
      while (scheduled.length > 0) {
        const job = scheduled.shift()!;
        await HANDLERS[job.name](typed, job.args);
      }
    },
  };
}

function rollupRow(counts: NoteMilestoneCounts) {
  return { ...counts, updatedAt: 0, builtAt: 1 };
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

/** What the row should hold: a full count of the notes that exist now. */
function expectRowMatchesNotes(fake: ReturnType<typeof fakeCtx>) {
  const row = fake.rollup();
  expect(row?.builtAt).toBeDefined();
  expect(row?.scannedThrough).toBeUndefined();
  const expected = countNotes(
    fake.rows("notes") as unknown as { tags: string[] }[],
  );
  expect({
    notesCount: row?.notesCount,
    taggedNotesCount: row?.taggedNotesCount,
    tagCounts: [...(row?.tagCounts as { tag: string }[])].sort((a, b) =>
      a.tag.localeCompare(b.tag),
    ),
  }).toEqual({
    ...expected,
    tagCounts: [...expected.tagCounts].sort((a, b) =>
      a.tag.localeCompare(b.tag),
    ),
  });
  expect(fake.rows("userOnboardingMilestones")).toHaveLength(1);
}

/** Simulate a note writer: change the note, then record it (as notes.ts does). */
async function retag(
  fake: ReturnType<typeof fakeCtx>,
  index: number,
  tags: string[],
) {
  const note = fake.rows("notes")[index];
  const before = { ...note };
  await fake.ctx.db.patch(note._id as never, { tags });
  await recordNoteChange(
    fake.ctx,
    USER_ID as never,
    before as never,
    before.tags as string[],
    tags,
  );
}

async function removeNote(fake: ReturnType<typeof fakeCtx>, index: number) {
  const note = { ...fake.rows("notes")[index] };
  await fake.ctx.db.delete(note._id as never);
  await recordNoteChange(
    fake.ctx,
    USER_ID as never,
    note as never,
    note.tags as string[],
    null,
  );
}

async function addNote(fake: ReturnType<typeof fakeCtx>, tags: string[]) {
  const id = await fake.ctx.db.insert("notes", { tags } as never);
  const note = await fake.ctx.db.get(id);
  await recordNoteChange(fake.ctx, USER_ID as never, note!, null, tags);
}

/** A library bigger than one recount page, with a few tags spread through. */
function bigLibrary() {
  return Array.from({ length: NOTE_RECOUNT_PAGE_SIZE * 2 + 37 }, (_, i) => ({
    tags: i % 7 === 0 ? ["grace"] : i % 11 === 0 ? ["faith", "hope"] : [],
  }));
}

const getOnboardingStatusHandler = (
  getOnboardingStatus as unknown as {
    _handler: (ctx: QueryCtx, args: object) => Promise<unknown>;
  }
)._handler;
const ensureHandler = handlerOf(ensureNoteMilestones);
const backfillHandler = HANDLERS["migrations:backfillNoteMilestones"];

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

  it("returns null while a recount is still in progress", async () => {
    const fake = fakeCtx({ notes: bigLibrary() });
    await ensureHandler(fake.ctx, {});
    expect(fake.rollup()?.builtAt).toBeUndefined();
    expect(await getOnboardingStatusHandler(fake.ctx, {})).toBeNull();

    await fake.drain();
    expect(await getOnboardingStatusHandler(fake.ctx, {})).toMatchObject({
      milestones: { notesCount: NOTE_RECOUNT_PAGE_SIZE * 2 + 37 },
    });
  });
});

describe("paged note recount", () => {
  it("counts a library larger than one page across scheduled pages", async () => {
    const fake = fakeCtx({ notes: bigLibrary() });

    await ensureHandler(fake.ctx, {});
    expect(fake.rollup()).toMatchObject({ notesCount: NOTE_RECOUNT_PAGE_SIZE });
    expect(fake.scheduled).toEqual([
      { name: "onboarding:recountNoteMilestones", args: { userId: USER_ID } },
    ]);

    await fake.drain();
    expectRowMatchesNotes(fake);
  });

  it("builds a zero row for a user with no notes in one call", async () => {
    const fake = fakeCtx();
    await ensureHandler(fake.ctx, {});
    expect(fake.scheduled).toEqual([]);
    expect(fake.rollup()).toMatchObject({ notesCount: 0, tagCounts: [] });
    expectRowMatchesNotes(fake);
  });

  it("applies writes made during a recount exactly once", async () => {
    const fake = fakeCtx({ notes: bigLibrary() });
    await ensureHandler(fake.ctx, {});
    const scannedThrough = fake.rollup()?.scannedThrough as number;
    const notesNow = fake.rows("notes");
    const behind = notesNow.findIndex(
      (note) => note._creationTime <= scannedThrough,
    );
    const ahead = notesNow.findIndex(
      (note) => note._creationTime > scannedThrough,
    );

    // Already counted: the write applies as a delta.
    await retag(fake, behind, ["joy"]);
    // Not counted yet: the scan will read its new tags instead.
    await retag(fake, ahead, ["peace"]);
    // A note created after the recount started is counted once, by the scan.
    await addNote(fake, ["new"]);
    // Deletes on both sides of the mark.
    await removeNote(fake, behind + 1);
    await removeNote(fake, ahead + 1);

    await fake.drain();
    expectRowMatchesNotes(fake);
    expect(fake.rollup()?.tagCounts).toEqual(
      expect.arrayContaining([
        { tag: "joy", count: 1 },
        { tag: "peace", count: 1 },
        { tag: "new", count: 1 },
      ]),
    );
  });

  it("starts a recount when a writer finds no row, counting its note once", async () => {
    const fake = fakeCtx({ notes: notes(3, ["a"]) });
    await addNote(fake, ["b"]);
    expect(fake.rollup()).toMatchObject({ notesCount: 4 });
    expectRowMatchesNotes(fake);
  });

  it("keeps deltas once the row is complete", async () => {
    const fake = fakeCtx({ notes: notes(3, ["a"]) });
    await ensureHandler(fake.ctx, {});
    await addNote(fake, ["b"]);
    await retag(fake, 0, []);
    await removeNote(fake, 1);
    expectRowMatchesNotes(fake);
    expect(fake.rollup()).toMatchObject({ notesCount: 3, taggedNotesCount: 2 });
  });
});

describe("backfillNoteMilestones", () => {
  it("walks one user's pages before moving on, then stops", async () => {
    const fake = fakeCtx({ notes: bigLibrary() });
    const first = await backfillHandler(fake.ctx, {});
    expect(first).toMatchObject({ isDone: false });
    expect(fake.rollup()?.builtAt).toBeUndefined();

    await fake.drain();
    expectRowMatchesNotes(fake);
  });

  it("skips a user whose row is already complete", async () => {
    const complete = rollupRow(countNotes(notes(2)));
    const fake = fakeCtx({
      notes: notes(5),
      userOnboardingMilestones: [complete],
    });
    expect(await backfillHandler(fake.ctx, {})).toEqual({
      totals: { usersBuilt: 0, usersSkipped: 1, pages: 0 },
      isDone: true,
    });
    expect(fake.rollup()).toMatchObject({ notesCount: 2 });
  });

  it("stays correct when the app's ensure runs alongside it", async () => {
    const fake = fakeCtx({ notes: bigLibrary() });
    await backfillHandler(fake.ctx, {});
    await ensureHandler(fake.ctx, {});
    await addNote(fake, ["mid"]);
    await fake.step();
    await ensureHandler(fake.ctx, {});
    await retag(fake, 0, ["early"]);
    await fake.drain();

    expectRowMatchesNotes(fake);
    expect(await backfillHandler(fake.ctx, {})).toMatchObject({
      totals: { usersSkipped: 1 },
      isDone: true,
    });
  });
});
