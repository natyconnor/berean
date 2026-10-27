import { describe, expect, it } from "vitest";

import { memoryProgressFraction } from "./mastery-ring";
import {
  buildGoalCards,
  type PackGoalCard,
  type PassageGoalCard,
} from "./memory-goals";
import { DAY_MS, EASE_START } from "./memory-scheduler";
import {
  offersLearnAsPassage,
  packDetailActions,
  packDetailGoal,
  packDetailProgress,
  packDetailSubtitle,
  packMemberRow,
  passageDetailActions,
  passageDetailProgress,
  passageVerseRows,
  reviewTogetherOption,
  type PackDetailMember,
  type PackDetailPack,
  type PackDetailPassage,
} from "./pack-detail-model";
import { localDayIndex } from "./passage-frontier";
import type { PassagePiece, PieceAttachment } from "./passage-pieces";

const HOUR_MS = 60 * 60 * 1000;
/** Monday, Oct 12, 2026. */
const NOW = Date.UTC(2026, 9, 12, 18);
const TZ = "UTC";
const TODAY_KEY = localDayIndex(NOW, 0);

const PSALM_16: PackDetailPack = {
  packId: "psalm16",
  name: "Psalm 16",
  kind: "scope",
  scope: {
    books: ["Psalms"],
    chapterRanges: [{ book: "Psalms", startChapter: 16, endChapter: 16 }],
  },
  createdAt: NOW - 10 * DAY_MS,
};

const MERCED: PackDetailPack = {
  packId: "merced",
  name: "Merced Team",
  kind: "custom",
  createdAt: Date.UTC(2026, 8, 12, 12),
};

function piece(
  index: number,
  startVerse: number,
  endVerse: number,
  attachment: PieceAttachment,
  extra: Partial<PassagePiece> = {},
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 16,
    startVerse,
    endVerse,
    sectionIndex: 0,
    attachment,
    learnStage: attachment === "solid" ? 3 : 0,
    stageReps: 0,
    ...(attachment === "unreached" ? {} : { dueAt: NOW - HOUR_MS }),
    ...extra,
  };
}

function passage(extra: Partial<PackDetailPassage> = {}): PackDetailPassage {
  return {
    status: "building",
    pieces: [
      piece(0, 1, 4, "solid"),
      piece(1, 5, 6, "unreached"),
      piece(2, 7, 11, "unreached"),
    ],
    addsOnDay: 0,
    intervalDays: 0,
    stageReps: 0,
    ease: 2.3,
    dueAt: NOW,
    createdAt: NOW - 10 * DAY_MS,
    ...extra,
  };
}

function member(
  verseRefId: string,
  extra: Partial<PackDetailMember> = {},
): PackDetailMember {
  return {
    verseRefId,
    book: "Luke",
    chapter: 9,
    startVerse: 23,
    endVerse: 24,
    status: "reviewing",
    learnStage: 3,
    intervalDays: 6.6,
    stageReps: 0,
    ease: 2.3,
    dueAt: NOW - HOUR_MS,
    ...extra,
  };
}

function passageGoal(extra: Partial<PackDetailPassage> = {}): PassageGoalCard {
  const goal = packDetailGoal({
    pack: PSALM_16,
    members: [],
    passage: passage(extra),
    now: NOW,
    tzOffsetMinutes: 0,
  });
  if (goal?.kind !== "passage") throw new Error("expected a passage goal");
  return goal;
}

function reviewingMasteryPercent(
  member: Pick<
    PackDetailMember,
    "learnStage" | "stageReps" | "intervalDays" | "ease"
  >,
): number {
  return Math.round(
    memoryProgressFraction(
      "reviewing",
      member.learnStage,
      member.stageReps,
      member.intervalDays,
      undefined,
      member.ease,
    ) * 100,
  );
}

function packGoal(
  members: PackDetailMember[],
  pack: PackDetailPack = MERCED,
): PackGoalCard {
  const goal = packDetailGoal({
    pack,
    members,
    passage: null,
    now: NOW,
    tzOffsetMinutes: 0,
  });
  if (goal?.kind !== "pack") throw new Error("expected a pack goal");
  return goal;
}

const MERCED_MEMBERS: PackDetailMember[] = [
  member("luke"),
  member("matt", { book: "Matthew", chapter: 6, startVerse: 33, endVerse: 33 }),
  member("josh", {
    book: "Joshua",
    chapter: 1,
    startVerse: 9,
    endVerse: 9,
    status: "learning",
    learnStage: 2,
    intervalDays: 0,
    dueAt: NOW + 12 * HOUR_MS,
  }),
  member("isa", {
    book: "Isaiah",
    chapter: 41,
    startVerse: 10,
    endVerse: 10,
    status: "new",
    learnStage: 0,
    intervalDays: 0,
    dueAt: NOW,
  }),
];

describe("primary action", () => {
  it("passage building with work today: Continue · about N min", () => {
    expect(passageDetailActions(passageGoal(), NOW, TZ)).toEqual({
      main: {
        kind: "session",
        emphasis: "primary",
        label: "Continue · about 7 min",
        session: "learn",
      },
      practice: false,
      note: null,
    });
  });

  it("unstarted passage: Start · about N min from the same estimate as Continue", () => {
    const goal = passageGoal({
      pieces: [
        piece(0, 1, 2, "unreached"),
        piece(1, 3, 4, "unreached"),
        piece(2, 5, 6, "unreached"),
      ],
      lastSessionAt: undefined,
    });
    expect(goal.lastPracticedAt).toBeNull();
    expect(goal.learnedVerses).toBe(0);
    expect(passageDetailActions(goal, NOW, TZ)).toEqual({
      main: {
        kind: "session",
        emphasis: "primary",
        label: "Start · about 7 min",
        session: "learn",
      },
      practice: false,
      note: null,
    });
  });

  it("passage building, waiting: disabled Up next tomorrow", () => {
    const goal = passageGoal({
      pieces: [
        piece(0, 1, 4, "solid"),
        piece(1, 5, 6, "learning", {
          learnStage: 2,
          dueAt: NOW + 12 * HOUR_MS,
        }),
        piece(2, 7, 11, "unreached"),
      ],
      addsOnDay: 5,
      addDayKey: TODAY_KEY,
    });
    expect(passageDetailActions(goal, NOW, TZ)).toEqual({
      main: { kind: "waiting", label: "Up next tomorrow" },
      practice: false,
      note: null,
    });
  });

  it("passage memorized and due: Review {title}", () => {
    const goal = passageGoal({
      status: "reviewing",
      pieces: [piece(0, 1, 11, "solid")],
      intervalDays: 4,
      dueAt: NOW - HOUR_MS,
    });
    expect(passageDetailActions(goal, NOW, TZ).main).toEqual({
      kind: "session",
      emphasis: "primary",
      label: "Review Psalm 16",
      session: "review",
    });
  });

  it("passage memorized, not due: Practice anytime and when it comes back", () => {
    const goal = passageGoal({
      status: "reviewing",
      pieces: [piece(0, 1, 11, "solid")],
      intervalDays: 4,
      dueAt: Date.UTC(2026, 9, 15, 12),
    });
    expect(passageDetailActions(goal, NOW, TZ)).toEqual({
      main: {
        kind: "session",
        emphasis: "secondary",
        label: "Practice anytime",
        session: "practice",
        tooltip: "Go over anything you've memorized, any time.",
      },
      practice: false,
      note: "Memorized · next review Thu",
    });
  });

  it("pack with learning and reviews today: Continue · N verses today runs both", () => {
    const goal = packGoal(MERCED_MEMBERS);
    expect(packDetailActions(goal, NOW, TZ)).toEqual({
      main: {
        kind: "session",
        emphasis: "primary",
        // Two reviews plus Isaiah, the Up-next verse joining today: the
        // blended pack session runs all three.
        label: "Continue · 3 verses today",
        session: "today",
      },
      practice: true,
      note: null,
    });
  });

  it("pack with only reviews today goes to review", () => {
    const members = [member("luke")];
    expect(packDetailActions(packGoal(members), NOW, TZ).main).toMatchObject({
      label: "Continue · 1 verse today",
      session: "review",
    });
  });

  it("pack with only learning today goes to the pack's learn session", () => {
    const members = [
      member("isa", { status: "new", learnStage: 0, intervalDays: 0 }),
      member("josh", {
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt: NOW - HOUR_MS,
      }),
    ];
    expect(packDetailActions(packGoal(members), NOW, TZ).main).toMatchObject({
      label: "Continue · 2 verses today",
      session: "learn",
    });
  });

  it("counts only the pack's paced Up-next verses in Continue", () => {
    const upNext = ["a", "b", "c", "d", "e"].map((id) =>
      member(id, { status: "new", learnStage: 0, intervalDays: 0 }),
    );
    expect(packDetailActions(packGoal(upNext), NOW, TZ).main).toMatchObject({
      label: "Continue · 3 verses today",
      session: "learn",
    });
  });

  it("pack, nothing today: Practice anytime with when the pack is next up", () => {
    const members = [
      member("luke", { dueAt: Date.UTC(2026, 9, 15, 12) }),
      member("josh", {
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt: NOW + 12 * HOUR_MS,
      }),
    ];
    expect(packDetailActions(packGoal(members), NOW, TZ)).toEqual({
      main: {
        kind: "session",
        emphasis: "secondary",
        label: "Practice anytime",
        session: "practice",
        tooltip: "Go over anything you've memorized, any time.",
      },
      practice: false,
      note: "Next up tomorrow.",
    });
  });

  it("pack, nothing today and nothing memorized: no action, just the line", () => {
    const members = [
      member("josh", {
        status: "learning",
        learnStage: 3,
        intervalDays: 0,
        dueAt: NOW + 12 * HOUR_MS,
      }),
    ];
    expect(packDetailActions(packGoal(members), NOW, TZ)).toEqual({
      main: null,
      practice: false,
      note: "Next up tomorrow.",
    });
  });

  it("an empty pack has no action", () => {
    expect(
      packDetailGoal({
        pack: MERCED,
        members: [],
        passage: null,
        now: NOW,
        tzOffsetMinutes: 0,
      }),
    ).toBeNull();
    expect(packDetailActions(null, NOW, TZ)).toEqual({
      main: null,
      practice: false,
      note: null,
    });
  });
});

describe("packDetailSubtitle", () => {
  it("names a pack, its size and when it was added", () => {
    expect(
      packDetailSubtitle({
        isPassage: false,
        verseCount: 9,
        createdAt: MERCED.createdAt,
        now: NOW,
        timeZone: TZ,
      }),
    ).toEqual({
      text: "Pack · 9 verses · added Sep 12",
      heartedAsOnePassage: false,
    });
    expect(
      packDetailSubtitle({
        isPassage: false,
        verseCount: 1,
        createdAt: NOW - DAY_MS,
        now: NOW,
        timeZone: TZ,
      }).text,
    ).toBe("Pack · 1 verse · added yesterday");
  });

  it("marks a passage as hearted as one passage", () => {
    expect(
      packDetailSubtitle({
        isPassage: true,
        verseCount: 11,
        createdAt: NOW,
        now: NOW,
        timeZone: TZ,
      }),
    ).toEqual({ text: "Passage · 11 verses", heartedAsOnePassage: true });
  });
});

describe("packMemberRow", () => {
  const opts = { now: NOW, timeZone: TZ };

  it("Up next offers Learn", () => {
    expect(packMemberRow(MERCED_MEMBERS[3], opts)).toEqual({
      status: "new",
      line: "Up next · starts when you're ready",
      actions: ["learn"],
    });
  });

  it("waiting learning offers nothing", () => {
    expect(packMemberRow(MERCED_MEMBERS[2], opts)).toEqual({
      status: "learning",
      line: "Learning · tomorrow: fill in the blanks",
      actions: [],
    });
  });

  it("names a same-day lock as later today", () => {
    expect(
      packMemberRow(
        member("rom", {
          status: "learning",
          learnStage: 2,
          dueAt: NOW + 2 * HOUR_MS,
        }),
        opts,
      ),
    ).toEqual({
      status: "learning",
      line: "Learning · later today: fill in the blanks",
      actions: [],
    });
  });

  it("open learning offers Learn", () => {
    expect(
      packMemberRow(
        member("rom", { status: "learning", learnStage: 3, dueAt: NOW }),
        opts,
      ),
    ).toEqual({
      status: "learning",
      line: "Learning · today: say it from memory",
      actions: ["learn"],
    });
  });

  it("due memorized offers Review and Practice", () => {
    expect(packMemberRow(MERCED_MEMBERS[0], opts)).toEqual({
      status: "reviewing",
      line: `Memorized · review due today · mastery ${reviewingMasteryPercent(MERCED_MEMBERS[0])}%`,
      actions: ["review", "practice"],
    });
  });

  it("memorized not due offers Practice", () => {
    expect(
      packMemberRow(member("luke", { dueAt: Date.UTC(2026, 9, 15, 12) }), opts),
    ).toEqual({
      status: "reviewing",
      line: `Memorized · next review Thu · mastery ${reviewingMasteryPercent(MERCED_MEMBERS[0])}%`,
      actions: ["practice"],
    });
    expect(
      packMemberRow(
        member("luke", {
          status: "mastered",
          intervalDays: 40,
          dueAt: Date.UTC(2026, 10, 2, 12),
        }),
        opts,
      ).line,
    ).toBe("Mastered · next review Nov 2");
  });

  it("drops per-verse Review while the pack is reviewed together", () => {
    expect(
      packMemberRow(MERCED_MEMBERS[0], { ...opts, reviewTogether: true })
        .actions,
    ).toEqual(["practice"]);
  });

  it("shows the same reviewing mastery as the verse bar, including banked stageReps", () => {
    const reviewing = member("john", {
      intervalDays: 1,
      stageReps: 2,
      ease: EASE_START,
    });
    const bar = memoryProgressFraction(
      "reviewing",
      reviewing.learnStage,
      reviewing.stageReps,
      reviewing.intervalDays,
      undefined,
      reviewing.ease,
    );
    const shown = Math.round(bar * 100);

    expect(packMemberRow(reviewing, opts).line).toContain(`mastery ${shown}%`);
    expect(packGoal([reviewing]).masteryFraction).toBeCloseTo(bar);

    const verseGoal = buildGoalCards({
      now: NOW,
      tzOffsetMinutes: 0,
      verses: [
        {
          verseRefId: reviewing.verseRefId,
          book: reviewing.book,
          chapter: reviewing.chapter,
          startVerse: reviewing.startVerse,
          endVerse: reviewing.endVerse,
          status: reviewing.status,
          learnStage: reviewing.learnStage,
          intervalDays: reviewing.intervalDays,
          stageReps: reviewing.stageReps,
          ease: reviewing.ease,
          dueAt: reviewing.dueAt,
          createdAt: NOW - DAY_MS,
        },
      ],
      packs: [],
      passages: [],
      upNextByPackId: new Map(),
      reviewTogether: new Map(),
      reviewTogetherVerseRefIds: new Set(),
    });
    expect(verseGoal).toHaveLength(1);
    expect(verseGoal[0]?.kind).toBe("verse");
    expect(verseGoal[0]?.masteryFraction).toBeCloseTo(bar);
  });
});

describe("passageVerseRows", () => {
  it("chips each verse: Memorized, Learning today, Up next", () => {
    const rows = passageVerseRows(passage(), NOW, 0);
    expect(rows).toHaveLength(11);
    expect(rows.map((row) => [row.verse, row.chip.label])).toEqual([
      [1, "Memorized"],
      [2, "Memorized"],
      [3, "Memorized"],
      [4, "Memorized"],
      [5, "Learning today"],
      [6, "Learning today"],
      [7, "Up next"],
      [8, "Up next"],
      [9, "Up next"],
      [10, "Up next"],
      [11, "Up next"],
    ]);
  });

  it("shows a piece done for today as still learning", () => {
    const rows = passageVerseRows(
      passage({
        pieces: [
          piece(0, 1, 4, "solid"),
          piece(1, 5, 6, "learning", {
            learnStage: 2,
            dueAt: NOW + 12 * HOUR_MS,
          }),
          piece(2, 7, 11, "unreached"),
        ],
        addsOnDay: 5,
        addDayKey: TODAY_KEY,
      }),
      NOW,
      0,
    );
    expect(rows[4]?.chip).toEqual({ kind: "tomorrow", label: "Learning" });
    expect(rows[6]?.chip.kind).toBe("upNext");
  });

  it("leaves every verse Up next after a whole-passage Start over", () => {
    const rows = passageVerseRows(
      passage({
        pieces: [
          piece(0, 1, 2, "unreached"),
          piece(1, 3, 4, "unreached"),
          piece(2, 5, 6, "unreached"),
        ],
        lastSessionAt: undefined,
        addsOnDay: 0,
        addDayKey: undefined,
      }),
      NOW,
      0,
    );
    expect(rows.map((row) => row.chip.label)).toEqual([
      "Up next",
      "Up next",
      "Up next",
      "Up next",
      "Up next",
      "Up next",
    ]);
  });

  it("marks memorized verses the passage kept from before", () => {
    const rows = passageVerseRows(
      passage({
        pieces: [
          piece(0, 1, 4, "solid"),
          piece(1, 5, 6, "solid", { carriedOver: true }),
          piece(2, 7, 11, "unreached"),
        ],
      }),
      NOW,
      0,
    );
    expect(rows[0]?.chip).toEqual({ kind: "memorized", label: "Memorized" });
    expect(rows[4]?.chip).toEqual({
      kind: "memorized",
      label: "Memorized",
      fromBefore: true,
    });
    expect(rows[5]?.chip.fromBefore).toBe(true);
    expect(rows[6]?.chip.fromBefore).toBeUndefined();
  });
});

describe("progress", () => {
  it("passage building: Learned bar, on track date, mastery note", () => {
    const progress = passageDetailProgress(passageGoal(), NOW, TZ);
    expect(progress.learned).toMatchObject({
      label: "4 of 11 verses learned",
      fraction: 4 / 11,
    });
    expect(progress.learned?.detail).toMatch(/^on track for Oct \d+$/);
    expect(progress.mastery).toBeNull();
    expect(progress.masteryNote).toMatch(
      /^Mastery starts once all 11 are learned, about .+ of short reviews after that\.$/,
    );
  });

  it("passage memorized shows Mastery only", () => {
    const progress = passageDetailProgress(
      passageGoal({
        status: "reviewing",
        pieces: [piece(0, 1, 11, "solid")],
        intervalDays: 6.6,
      }),
      NOW,
      TZ,
    );
    expect(progress.learned).toBeNull();
    expect(progress.mastery).toMatchObject({
      label: `Mastery ${reviewingMasteryPercent({
        learnStage: 3,
        stageReps: 0,
        intervalDays: 6.6,
        ease: 2.3,
      })}%`,
    });
  });

  it("pack shows both bars once a verse is learned", () => {
    const progress = packDetailProgress(packGoal(MERCED_MEMBERS), NOW, TZ);
    expect(progress.learned).toEqual({
      label: "2 of 4 verses learned",
      fraction: 0.5,
      detail: "1 learning · 1 up next",
    });
    const reviewingShare = memoryProgressFraction(
      "reviewing",
      3,
      0,
      6.6,
      undefined,
      2.3,
    );
    expect(progress.mastery).toMatchObject({
      label: `Mastery ${Math.round(((reviewingShare + reviewingShare) / 4) * 100)}%`,
    });
    expect(progress.mastery?.detail).toMatch(/^first ones mastered /);
  });

  it("pack with nothing learned shows Learned only", () => {
    const members = [MERCED_MEMBERS[3]];
    expect(packDetailProgress(packGoal(members), NOW, TZ).mastery).toBeNull();
  });
});

describe("pack options", () => {
  it("offers Learn it as a passage only to legacy chapter packs", () => {
    expect(offersLearnAsPassage(PSALM_16, null)).toBe(true);
    expect(offersLearnAsPassage(PSALM_16, passage())).toBe(false);
    expect(offersLearnAsPassage(MERCED, null)).toBe(false);
  });

  it("offers Review together for one block of verses", () => {
    const block = [
      member("a", {
        book: "Psalms",
        chapter: 16,
        startVerse: 1,
        endVerse: 2,
      }),
      member("b", {
        book: "Psalms",
        chapter: 16,
        startVerse: 3,
        endVerse: 4,
      }),
    ];
    expect(reviewTogetherOption(PSALM_16, null, block)).toEqual({
      checked: false,
      disabled: false,
    });
    expect(
      reviewTogetherOption(PSALM_16, null, [
        block[0],
        { ...block[1], status: "learning", learnStage: 2 },
      ]),
    ).toEqual({ checked: false, disabled: true });
    expect(reviewTogetherOption(PSALM_16, passage(), block)).toBeNull();
    expect(reviewTogetherOption(MERCED, null, block)).toBeNull();
    expect(
      reviewTogetherOption(
        { ...PSALM_16, unifiedReviewEnabled: true },
        null,
        [],
      ),
    ).toEqual({ checked: true, disabled: false });
  });
});
