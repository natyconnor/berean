import { describe, expect, it } from "vitest";

import {
  buildGoalCards,
  goalLearnDaysLeft,
  localDayStart,
  type GoalCard,
  type GoalPackInput,
  type GoalPassageInput,
  type GoalsInput,
  type GoalVerseInput,
  type PackGoalCard,
  type PassageGoalCard,
  type VerseGoalCard,
} from "./memory-goals";
import { DAY_MS } from "./memory-scheduler";
import { localDayIndex } from "./passage-frontier";
import type { PassagePiece, PieceAttachment } from "./passage-pieces";

const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 9, 15);
const DAY_START = Date.UTC(2026, 9, 9);
const TOMORROW = DAY_START + DAY_MS;
const TODAY_KEY = localDayIndex(NOW, 0);

function verse(
  verseRefId: string,
  ref: {
    book?: string;
    chapter: number;
    startVerse: number;
    endVerse?: number;
  },
  extra: Partial<GoalVerseInput> = {},
): GoalVerseInput {
  return {
    verseRefId,
    book: ref.book ?? "Romans",
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse ?? ref.startVerse,
    status: "learning",
    learnStage: 0,
    intervalDays: 0,
    dueAt: NOW - HOUR_MS,
    createdAt: NOW - 3 * DAY_MS,
    ...extra,
  };
}

function piece(
  index: number,
  chapter: number,
  startVerse: number,
  endVerse: number,
  attachment: PieceAttachment,
  extra: Partial<PassagePiece> = {},
): PassagePiece {
  const reached = attachment !== "unreached";
  return {
    index,
    book: "Psalms",
    chapter,
    startVerse,
    endVerse,
    sectionIndex: 0,
    attachment,
    learnStage: attachment === "solid" ? 3 : 0,
    stageReps: 0,
    dueAt: reached ? NOW - HOUR_MS : undefined,
    ...extra,
  };
}

function passage(
  packId: string,
  pieces: PassagePiece[],
  extra: Partial<GoalPassageInput> = {},
): GoalPassageInput {
  return {
    packId,
    title: packId,
    status: "building",
    pieces,
    addsOnDay: 0,
    intervalDays: 0,
    dueAt: NOW,
    createdAt: NOW - 5 * DAY_MS,
    ...extra,
  };
}

function customPack(
  packId: string,
  verseRefIds: string[],
  extra: Partial<GoalPackInput> = {},
): GoalPackInput {
  return {
    packId,
    name: packId,
    kind: "custom",
    verseRefIds,
    createdAt: NOW - 10 * DAY_MS,
    ...extra,
  };
}

function input(extra: Partial<GoalsInput> = {}): GoalsInput {
  return {
    now: NOW,
    tzOffsetMinutes: 0,
    verses: [],
    packs: [],
    passages: [],
    upNextByPackId: new Map(),
    reviewTogether: new Map(),
    reviewTogetherVerseRefIds: new Set(),
    ...extra,
  };
}

function only<K extends GoalCard["kind"]>(
  goals: GoalCard[],
  kind: K,
): Extract<GoalCard, { kind: K }> {
  const matches = goals.filter(
    (goal): goal is Extract<GoalCard, { kind: K }> => goal.kind === kind,
  );
  expect(matches).toHaveLength(1);
  const [match] = matches;
  if (!match) throw new Error(`No ${kind} goal`);
  return match;
}

describe("localDayStart", () => {
  it("is local midnight for the viewer's offset", () => {
    expect(localDayStart(NOW, 0)).toBe(DAY_START);
    // UTC-7: 15:00 UTC is 08:00 local, so the day started at 07:00 UTC.
    expect(localDayStart(NOW, 420)).toBe(DAY_START + 7 * HOUR_MS);
  });
});

describe("buildGoalCards: passages", () => {
  it("shows a building passage's learned verses and today's open step", () => {
    const goal = only(
      buildGoalCards(
        input({
          passages: [
            passage("psalm16", [
              piece(0, 16, 1, 2, "solid"),
              piece(1, 16, 3, 3, "attached", {
                learnStage: 2,
                dueAt: TOMORROW,
              }),
              piece(2, 16, 4, 4, "learning", { learnStage: 1 }),
              piece(3, 16, 5, 6, "unreached"),
            ]),
          ],
        }),
      ),
      "passage",
    );

    expect(goal).toMatchObject<Partial<PassageGoalCard>>({
      packId: "psalm16",
      verseCount: 6,
      learnedVerses: 3,
      status: "building",
      hasWorkToday: true,
      todayStep: {
        label: "Read verse 4, then type it with first letters",
        ladderDay: 1,
      },
      masteryFraction: 0,
      nextDueAt: NOW - HOUR_MS,
    });
  });

  it("starts a new passage on its first verses while today's budget lasts", () => {
    const goal = only(
      buildGoalCards(
        input({
          passages: [
            passage("psalm23", [
              piece(0, 23, 1, 2, "unreached"),
              piece(1, 23, 3, 3, "unreached"),
            ]),
          ],
        }),
      ),
      "passage",
    );

    expect(goal.learnedVerses).toBe(0);
    expect(goal.hasWorkToday).toBe(true);
    expect(goal.todayStep).toEqual({
      label: "Read verses 1–2, then type them with first letters",
      ladderDay: 1,
    });
  });

  it("names the chapter when the passage spans chapters", () => {
    const goal = only(
      buildGoalCards(
        input({
          passages: [
            passage("john14-15", [
              piece(0, 14, 31, 31, "solid"),
              piece(1, 15, 1, 1, "attached", { learnStage: 2 }),
            ]),
          ],
        }),
      ),
      "passage",
    );

    expect(goal.todayStep).toEqual({
      label: "Fill in the blanks for verse 15:1",
      ladderDay: 2,
    });
  });

  it("waits until tomorrow once today's step is done", () => {
    const goal = only(
      buildGoalCards(
        input({
          passages: [
            passage(
              "psalm8",
              [
                piece(0, 8, 1, 1, "attached", {
                  learnStage: 2,
                  dueAt: TOMORROW + 2 * HOUR_MS,
                }),
                piece(1, 8, 2, 2, "unreached"),
              ],
              { addsOnDay: 5, addDayKey: TODAY_KEY },
            ),
          ],
        }),
      ),
      "passage",
    );

    expect(goal.hasWorkToday).toBe(false);
    expect(goal.todayStep).toBeNull();
    expect(goal.nextDueAt).toBe(TOMORROW);
  });

  it("shows a memorized passage's mastery and next recite", () => {
    const pieces = [piece(0, 1, 1, 3, "solid"), piece(1, 1, 4, 6, "solid")];
    const upcoming = only(
      buildGoalCards(
        input({
          passages: [
            passage("psalm1", pieces, {
              status: "reviewing",
              intervalDays: 12,
              dueAt: NOW + 2 * DAY_MS,
              lastSessionAt: NOW - DAY_MS,
            }),
          ],
        }),
      ),
      "passage",
    );

    expect(upcoming).toMatchObject<Partial<PassageGoalCard>>({
      verseCount: 6,
      learnedVerses: 6,
      status: "reviewing",
      hasWorkToday: false,
      todayStep: null,
      masteryFraction: 0.4,
      nextDueAt: NOW + 2 * DAY_MS,
      lastActivityAt: NOW - DAY_MS,
      lastPracticedAt: NOW - DAY_MS,
    });

    const due = only(
      buildGoalCards(
        input({
          passages: [
            passage("psalm1", pieces, {
              status: "reviewing",
              intervalDays: 12,
              dueAt: NOW - HOUR_MS,
            }),
          ],
        }),
      ),
      "passage",
    );
    expect(due.hasWorkToday).toBe(true);
    expect(due.todayStep).toBeNull();
    expect(due.lastPracticedAt).toBeNull();
  });

  it("fills the mastery bar for a mastered passage", () => {
    const goal = only(
      buildGoalCards(
        input({
          passages: [
            passage("psalm23", [piece(0, 23, 1, 6, "solid")], {
              status: "mastered",
              intervalDays: 24,
              dueAt: NOW + 20 * DAY_MS,
            }),
          ],
        }),
      ),
      "passage",
    );
    expect(goal.masteryFraction).toBe(1);
  });
});

describe("buildGoalCards: verses on their own", () => {
  it("shows a learning verse with today's step open", () => {
    const goal = only(
      buildGoalCards(
        input({
          verses: [
            verse(
              "rom828",
              { chapter: 8, startVerse: 28 },
              { learnStage: 2, lastReviewedAt: NOW - DAY_MS },
            ),
          ],
        }),
      ),
      "verse",
    );

    expect(goal).toEqual<VerseGoalCard>({
      kind: "verse",
      verseRefId: "rom828",
      title: "Romans 8:28",
      book: "Romans",
      chapter: 8,
      startVerse: 28,
      endVerse: 28,
      status: "learning",
      learnStage: 2,
      intervalDays: 0,
      masteryFraction: 0,
      hasWorkToday: true,
      nextDueAt: NOW - HOUR_MS,
      createdAt: NOW - 3 * DAY_MS,
      lastActivityAt: NOW - DAY_MS,
      lastPracticedAt: NOW - DAY_MS,
    });
  });

  it("shows a memorized verse only while its review is due", () => {
    const due = verse(
      "john316",
      { book: "John", chapter: 3, startVerse: 16 },
      { status: "reviewing", intervalDays: 4.5, dueAt: NOW - HOUR_MS },
    );
    const later = verse(
      "ps11",
      { book: "Psalms", chapter: 1, startVerse: 1 },
      { status: "reviewing", intervalDays: 6, dueAt: NOW + DAY_MS },
    );

    const goals = buildGoalCards(input({ verses: [due, later] }));
    const goal = only(goals, "verse");
    expect(goal.title).toBe("John 3:16");
    expect(goal.hasWorkToday).toBe(true);
    expect(goal.masteryFraction).toBeCloseTo(0.15);
  });

  it("leaves out verses in a pack or inside a passage", () => {
    const goals = buildGoalCards(
      input({
        verses: [
          verse("inPack", { chapter: 12, startVerse: 1 }),
          verse("inPassage", { book: "Psalms", chapter: 16, startVerse: 5 }),
          verse("alone", { chapter: 12, startVerse: 2 }),
        ],
        packs: [customPack("team", ["inPack"])],
        passages: [passage("psalm16", [piece(0, 16, 1, 11, "unreached")])],
      }),
    );

    expect(
      goals.flatMap((goal) => (goal.kind === "verse" ? [goal.verseRefId] : [])),
    ).toEqual(["alone"]);
  });
});

describe("buildGoalCards: packs", () => {
  it("counts a pack with nothing learned yet and today's learning", () => {
    const goal = only(
      buildGoalCards(
        input({
          verses: [
            verse("a", { chapter: 12, startVerse: 1, endVerse: 2 }),
            verse("b", { chapter: 5, startVerse: 8 }, { status: "new" }),
            verse("c", { chapter: 8, startVerse: 28 }, { status: "new" }),
          ],
          packs: [customPack("team", ["c", "missing", "a", "b"])],
          upNextByPackId: new Map([["team", ["c"]]]),
        }),
      ),
      "pack",
    );

    expect(goal).toMatchObject<Partial<PackGoalCard>>({
      packId: "team",
      title: "team",
      verseCount: 3,
      learned: 0,
      learning: 1,
      upNext: 2,
      mastered: 0,
      masteryFraction: 0,
      reviewsDue: [],
      learningToday: 2,
      reviewTogether: false,
      hasWorkToday: true,
      nextDueAt: NOW - HOUR_MS,
      memberLabels: ["Romans 8:28", "Romans 12:1-2", "Romans 5:8"],
    });
  });

  it("counts learned and mastered members, mastery, and due reviews", () => {
    const goal = only(
      buildGoalCards(
        input({
          verses: [
            verse(
              "luke",
              { book: "Luke", chapter: 9, startVerse: 23, endVerse: 24 },
              {
                status: "reviewing",
                intervalDays: 6,
                dueAt: NOW - HOUR_MS,
                lastReviewedAt: NOW - 6 * DAY_MS,
              },
            ),
            verse(
              "matt",
              { book: "Matthew", chapter: 6, startVerse: 33 },
              {
                status: "mastered",
                intervalDays: 40,
                dueAt: NOW + 30 * DAY_MS,
                lastReviewedAt: NOW - 2 * DAY_MS,
              },
            ),
            verse(
              "eph",
              { book: "Ephesians", chapter: 2, startVerse: 10 },
              { dueAt: TOMORROW, lastReviewedAt: NOW - HOUR_MS },
            ),
            verse(
              "deut",
              { book: "Deuteronomy", chapter: 6, startVerse: 4 },
              { status: "new" },
            ),
          ],
          packs: [customPack("merced", ["luke", "matt", "eph", "deut"])],
        }),
      ),
      "pack",
    );

    expect(goal).toMatchObject<Partial<PackGoalCard>>({
      verseCount: 4,
      learned: 2,
      learning: 1,
      upNext: 1,
      mastered: 1,
      reviewsDue: [{ verseRefId: "luke", label: "Luke 9:23-24" }],
      learningToday: 0,
      hasWorkToday: true,
      nextDueAt: NOW - HOUR_MS,
      lastActivityAt: NOW - HOUR_MS,
      lastPracticedAt: NOW - HOUR_MS,
    });
    expect(goal.masteryFraction).toBeCloseTo((6 / 30 + 1) / 4);
  });

  it("lists a scope pack's members in Bible order", () => {
    const goal = only(
      buildGoalCards(
        input({
          verses: [
            verse("r12", { chapter: 12, startVerse: 2 }),
            verse("r8", { chapter: 8, startVerse: 1 }),
            verse("john", { book: "John", chapter: 1, startVerse: 1 }),
          ],
          packs: [
            {
              packId: "romans",
              name: "Romans",
              kind: "scope",
              scope: { books: ["Romans"] },
              verseRefIds: [],
              createdAt: NOW,
            },
          ],
        }),
      ),
      "pack",
    );

    expect(goal.memberLabels).toEqual(["Romans 8:1", "Romans 12:2"]);
  });

  it("lists only the verses inside a scope pack's passage range", () => {
    const goal = only(
      buildGoalCards(
        input({
          verses: [
            verse("r8-27", { chapter: 8, startVerse: 27 }),
            verse("r8-28", { chapter: 8, startVerse: 28 }),
            verse("r8-39", { chapter: 8, startVerse: 39 }),
          ],
          packs: [
            {
              packId: "conquerors",
              name: "More than conquerors",
              kind: "scope",
              scope: {
                books: ["Romans"],
                chapterRanges: [
                  { book: "Romans", startChapter: 8, endChapter: 8 },
                ],
              },
              passageRange: {
                book: "Romans",
                startChapter: 8,
                startVerse: 28,
                endChapter: 8,
                endVerse: 39,
              },
              verseRefIds: [],
              createdAt: NOW,
            },
          ],
        }),
      ),
      "pack",
    );

    expect(goal.memberLabels).toEqual(["Romans 8:28", "Romans 8:39"]);
  });

  it("reviews a pack recited together only when the recitation is due", () => {
    const members = [
      verse(
        "a",
        { chapter: 8, startVerse: 1 },
        { status: "reviewing", intervalDays: 2, dueAt: NOW - HOUR_MS },
      ),
      verse(
        "b",
        { chapter: 8, startVerse: 2 },
        { status: "reviewing", intervalDays: 2, dueAt: NOW + DAY_MS },
      ),
    ];
    const base = input({
      verses: members,
      packs: [customPack("together", ["a", "b"]), customPack("plain", ["a"])],
      reviewTogetherVerseRefIds: new Set(["a", "b"]),
    });

    const due = buildGoalCards({
      ...base,
      reviewTogether: new Map([["together", NOW - HOUR_MS]]),
    });
    const together = due.find(
      (goal): goal is PackGoalCard =>
        goal.kind === "pack" && goal.packId === "together",
    );
    const plain = due.find(
      (goal): goal is PackGoalCard =>
        goal.kind === "pack" && goal.packId === "plain",
    );
    expect(together?.reviewTogether).toBe(true);
    expect(together?.reviewsDue.map((review) => review.verseRefId)).toEqual([
      "a",
    ]);
    expect(plain?.reviewsDue).toEqual([]);

    const notDue = buildGoalCards({
      ...base,
      reviewTogether: new Map([["together", null]]),
    });
    const waiting = notDue.find(
      (goal): goal is PackGoalCard =>
        goal.kind === "pack" && goal.packId === "together",
    );
    expect(waiting?.reviewsDue).toEqual([]);
    expect(waiting?.hasWorkToday).toBe(false);
  });

  it("skips packs with no verses in Memory and passage packs", () => {
    const goals = buildGoalCards(
      input({
        packs: [
          customPack("empty", ["gone"]),
          {
            packId: "psalm16",
            name: "Psalm 16",
            kind: "scope",
            scope: { books: ["Psalms"] },
            verseRefIds: [],
            createdAt: NOW,
          },
        ],
        passages: [passage("psalm16", [piece(0, 16, 1, 11, "unreached")])],
      }),
    );

    expect(goals.map((goal) => `${goal.kind}:${goal.title}`)).toEqual([
      "passage:psalm16",
    ]);
  });
});

describe("buildGoalCards: order", () => {
  it("puts work today first, then the soonest projected learn date", () => {
    const goals = buildGoalCards(
      input({
        verses: [
          // Waiting for tomorrow: no work today.
          verse(
            "waiting",
            { chapter: 1, startVerse: 1 },
            { dueAt: TOMORROW, lastReviewedAt: NOW - HOUR_MS },
          ),
          // Open on day 3: one learning day left.
          verse("day3", { chapter: 2, startVerse: 1 }, { learnStage: 3 }),
          // Open on day 1: three learning days left.
          verse("day1", { chapter: 3, startVerse: 1 }),
          verse("p1", { chapter: 4, startVerse: 1 }, { status: "new" }),
          verse("p2", { chapter: 4, startVerse: 2 }, { status: "new" }),
        ],
        packs: [customPack("big", ["p1", "p2"])],
        passages: [
          passage("long", [
            piece(0, 1, 1, 5, "unreached"),
            piece(1, 1, 6, 10, "unreached"),
          ]),
        ],
      }),
    );

    expect(goals.map((goal) => goal.title)).toEqual([
      "Romans 2:1",
      "Romans 3:1",
      "long",
      "Romans 1:1",
      "big",
    ]);
    expect(goals.map(goalLearnDaysLeft)).toEqual([1, 3, 4, 3, 3]);
  });
});
