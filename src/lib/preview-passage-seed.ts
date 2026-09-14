import type { EsvVerse } from "../../shared/esv-api";
import { EASE_START, type MemorySchedule } from "./memory-scheduler";
import { PASSAGE_MAX_ADDS_PER_DAY, localDayIndex } from "./passage-frontier";
import {
  buildPassagePieces,
  type PassagePiece,
  type PassagePieceBase,
  type PieceAttachment,
} from "./passage-pieces";
import type { PassageRowStatus } from "./passage-start";
import { scopesEqual } from "./scope-equality";
import type { VerseScope } from "./verse-scope-match";

export type PreviewPassageSeedRole =
  | "readyToStart"
  | "buildingDue"
  | "budgetExhausted"
  | "maintenanceDue"
  | "collectionOnly";

/** Pack scope as stored on `packs.scope` (tags are unused for verse matching). */
export type PreviewPassagePackScope = VerseScope & {
  tags: string[];
  tagMatchMode: "any" | "all";
};

export type PreviewPassageSeedPack = {
  id: string;
  role: PreviewPassageSeedRole;
  name: string;
  description: string;
  howToTry: string;
  scope: PreviewPassagePackScope;
  /** Absent for readyToStart / collectionOnly — user opts in from the pack. */
  passage?: {
    status: PassageRowStatus;
    pieces: PassagePiece[];
    addsOnDay: number;
    addDayKey?: number;
    schedule: MemorySchedule;
  };
};

export type PreviewPassageSeedPlan = {
  packs: PreviewPassageSeedPack[];
};

function withPackMeta(scope: VerseScope): PreviewPassagePackScope {
  return { ...scope, tags: [], tagMatchMode: "any" };
}

/** Whole-book scope (no chapterRanges) — matches pack-builder empty chapter picks. */
function scopeWholeBook(book: string): PreviewPassagePackScope {
  return withPackMeta({ books: [book] });
}

function scopeChapter(
  book: string,
  startChapter: number,
  endChapter: number = startChapter,
): PreviewPassagePackScope {
  return withPackMeta({
    books: [book],
    chapterRanges: [{ book, startChapter, endChapter }],
  });
}

function multiBookScope(): PreviewPassagePackScope {
  return withPackMeta({
    books: ["Genesis", "John"],
    chapterRanges: [
      { book: "Genesis", startChapter: 1, endChapter: 1 },
      { book: "John", startChapter: 1, endChapter: 1 },
    ],
  });
}

const JUDE_VERSES: EsvVerse[] = [
  {
    number: 1,
    text: "Jude, a servant of Jesus Christ and brother of James,\n\nTo those who are called, beloved in God the Father and kept for Jesus Christ:",
    heading: "Greeting",
  },
  { number: 2, text: "May mercy, peace, and love be multiplied to you." },
  {
    number: 3,
    text: "Beloved, although I was very eager to write to you about our common salvation, I found it necessary to write appealing to you to contend for the faith that was once for all delivered to the saints.",
    heading: "Judgment on False Teachers",
  },
  {
    number: 4,
    text: "For certain people have crept in unnoticed who long ago were designated for this condemnation, ungodly people, who pervert the grace of our God into sensuality and deny our only Master and Lord, Jesus Christ.",
  },
  {
    number: 5,
    text: "Now I want to remind you, although you once fully knew it, that Jesus, who saved a people out of the land of Egypt, afterward destroyed those who did not believe.",
  },
  {
    number: 6,
    text: "And the angels who did not stay within their own position of authority, but left their proper dwelling, he has kept in eternal chains under gloomy darkness until the judgment of the great day\u2014",
  },
  {
    number: 7,
    text: "just as Sodom and Gomorrah and the surrounding cities, which likewise indulged in sexual immorality and pursued unnatural desire, serve as an example by undergoing a punishment of eternal fire.",
  },
  {
    number: 8,
    text: "Yet in like manner these people also, relying on their dreams, defile the flesh, reject authority, and blaspheme the glorious ones.",
  },
  {
    number: 9,
    text: "But when the archangel Michael, contending with the devil, was disputing about the body of Moses, he did not presume to pronounce a blasphemous judgment, but said, \u201cThe Lord rebuke you.\u201d",
  },
  {
    number: 10,
    text: "But these people blaspheme all that they do not understand, and they are destroyed by all that they, like unreasoning animals, understand instinctively.",
  },
  {
    number: 11,
    text: "Woe to them! For they walked in the way of Cain and abandoned themselves for the sake of gain to Balaam\u2019s error and perished in Korah\u2019s rebellion.",
  },
  {
    number: 12,
    text: "These are hidden reefs at your love feasts, as they feast with you without fear, shepherds feeding themselves; waterless clouds, swept along by winds; fruitless trees in late autumn, twice dead, uprooted;",
  },
  {
    number: 13,
    text: "wild waves of the sea, casting up the foam of their own shame; wandering stars, for whom the gloom of utter darkness has been reserved forever.",
  },
  {
    number: 14,
    text: "It was also about these that Enoch, the seventh from Adam, prophesied, saying, \u201cBehold, the Lord comes with ten thousands of his holy ones,",
  },
  {
    number: 15,
    text: "to execute judgment on all and to convict all the ungodly of all their deeds of ungodliness that they have committed in such an ungodly way, and of all the harsh things that ungodly sinners have spoken against him.\u201d",
  },
  {
    number: 16,
    text: "These are grumblers, malcontents, following their own sinful desires; they are loud-mouthed boasters, showing favoritism to gain advantage.",
  },
  {
    number: 17,
    text: "But you must remember, beloved, the predictions of the apostles of our Lord Jesus Christ.",
    heading: "A Call to Persevere",
  },
  {
    number: 18,
    text: "They said to you, \u201cIn the last time there will be scoffers, following their own ungodly passions.\u201d",
  },
  {
    number: 19,
    text: "It is these who cause divisions, worldly people, devoid of the Spirit.",
  },
  {
    number: 20,
    text: "But you, beloved, building yourselves up in your most holy faith and praying in the Holy Spirit,",
  },
  {
    number: 21,
    text: "keep yourselves in the love of God, waiting for the mercy of our Lord Jesus Christ that leads to eternal life.",
  },
  { number: 22, text: "And have mercy on those who doubt;" },
  {
    number: 23,
    text: "save others by snatching them out of the fire; to others show mercy with fear, hating even the garment stained by the flesh.",
  },
  {
    number: 24,
    text: "Now to him who is able to keep you from stumbling and to present you blameless before the presence of his glory with great joy,",
    heading: "Doxology",
  },
  {
    number: 25,
    text: "to the only God, our Savior, through Jesus Christ our Lord, be glory, majesty, dominion, and authority, before all time and now and forever. Amen.",
  },
];

const PSALM_23_VERSES: EsvVerse[] = [
  {
    number: 1,
    text: "The Lord is my shepherd; I shall not want.",
    heading: "The Lord Is My Shepherd",
  },
  {
    number: 2,
    text: "He makes me lie down in green pastures. He leads me beside still waters.",
  },
  {
    number: 3,
    text: "He restores my soul. He leads me in paths of righteousness for his name's sake.",
  },
  {
    number: 4,
    text: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
  },
  {
    number: 5,
    text: "You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows.",
  },
  {
    number: 6,
    text: "Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the Lord forever.",
  },
];

const THIRD_JOHN_VERSES: EsvVerse[] = [
  {
    number: 1,
    text: "The elder to the beloved Gaius, whom I love in truth.",
    heading: "Greeting",
  },
  {
    number: 2,
    text: "Beloved, I pray that all may go well with you and that you may be in good health, as it goes well with your soul.",
  },
  {
    number: 3,
    text: "For I rejoiced greatly when the brothers came and testified to your truth, as indeed you are walking in the truth.",
  },
  {
    number: 4,
    text: "I have no greater joy than to hear that my children are walking in the truth.",
  },
  {
    number: 5,
    text: "Beloved, it is a faithful thing you do in all your efforts for these brothers, strangers as they are,",
    heading: "Support and Opposition",
  },
  {
    number: 6,
    text: "who testified to your love before the church. You will do well to send them on their journey in a manner worthy of God.",
  },
  {
    number: 7,
    text: "For they have gone out for the sake of the name, accepting nothing from the Gentiles.",
  },
  {
    number: 8,
    text: "Therefore we ought to support people like these, that we may be fellow workers for the truth.",
  },
  {
    number: 9,
    text: "I have written something to the church, but Diotrephes, who likes to put himself first, does not acknowledge our authority.",
  },
  {
    number: 10,
    text: "So if I come, I will bring up what he is doing, talking wicked nonsense against us. And not content with that, he refuses to welcome the brothers, and also stops those who want to and puts them out of the church.",
  },
  {
    number: 11,
    text: "Beloved, do not imitate evil but imitate good. Whoever does good is from God; whoever does evil has not seen God.",
    heading: "Final Greetings",
  },
  {
    number: 12,
    text: "Demetrius has received a good testimony from everyone, and from the truth itself. We also add our testimony, and you know that our testimony is true.",
  },
  {
    number: 13,
    text: "I had much to write to you, but I would rather not write with pen and ink.",
  },
  {
    number: 14,
    text: "I hope to see you soon, and we will talk face to face.",
  },
  {
    number: 15,
    text: "Peace be to you. The friends greet you. Greet the friends, each by name.",
  },
];

function paintPieces(
  bases: readonly PassagePieceBase[],
  paint: ReadonlyArray<{
    attachment: PieceAttachment;
    learnStage?: number;
    stageReps?: number;
    dueAt?: number;
  }>,
): PassagePiece[] {
  return bases.map((base, index) => {
    const spec = paint[index] ?? { attachment: "unreached" as const };
    const piece: PassagePiece = {
      ...base,
      attachment: spec.attachment,
      learnStage: spec.learnStage ?? (spec.attachment === "unreached" ? 0 : 2),
      stageReps: spec.stageReps ?? 0,
    };
    if (spec.dueAt !== undefined) piece.dueAt = spec.dueAt;
    return piece;
  });
}

function buildingSchedule(now: number): MemorySchedule {
  return {
    status: "new",
    learnStage: 0,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 0,
    dueAt: now,
    consecutiveCorrect: 0,
    lapses: 0,
    earlyReviewApplied: false,
  };
}

function reviewingDueSchedule(now: number): MemorySchedule {
  return {
    status: "reviewing",
    learnStage: 3,
    stageReps: 0,
    ease: EASE_START,
    intervalDays: 1,
    dueAt: now,
    consecutiveCorrect: 2,
    lapses: 0,
    earlyReviewApplied: false,
  };
}

/** Piece spans from the same auto-heart grouping used when starting a passage. */
export function judePassagePieceBases(): PassagePieceBase[] {
  return buildPassagePieces([
    { book: "Jude", chapter: 1, verses: JUDE_VERSES },
  ]);
}

function thirdJohnPassagePieceBases(): PassagePieceBase[] {
  return buildPassagePieces([
    { book: "3 John", chapter: 1, verses: THIRD_JOHN_VERSES },
  ]);
}

function psalm23PassagePieceBases(): PassagePieceBase[] {
  return buildPassagePieces([
    { book: "Psalms", chapter: 23, verses: PSALM_23_VERSES },
  ]);
}

/**
 * Deterministic passage packs for preview/dev manual testing. Kept separate
 * from hearted-verse samples so Memory home can list how-to-try steps for each.
 *
 * Each scope pack uses a distinct canonical scope (no duplicate Jude/etc.).
 * Passage piece spans come from {@link buildPassagePieces} / auto-heart grouping.
 */
export function buildPreviewPassageSeed(
  now: number,
  tzOffsetMinutes: number,
): PreviewPassageSeedPlan {
  const todayKey = localDayIndex(now, tzOffsetMinutes);
  const judeBases = judePassagePieceBases();
  const thirdJohnBases = thirdJohnPassagePieceBases();
  const psalm23Bases = psalm23PassagePieceBases();

  // Mid-build Jude: early pieces solid, then attached, one learning frontier, rest unreached.
  const judePaint = judeBases.map((_, index) => {
    if (index < 4) {
      return {
        attachment: "solid" as const,
        learnStage: 3,
      };
    }
    if (index === 4) {
      return { attachment: "attached" as const, learnStage: 2 };
    }
    if (index === 5) {
      return {
        attachment: "learning" as const,
        learnStage: 1,
        stageReps: 1,
        dueAt: now,
      };
    }
    return { attachment: "unreached" as const };
  });

  // Budget exhausted on 3 John: frontier soft-locked until tomorrow; adds at daily cap.
  const thirdJohnPaint = thirdJohnBases.map((_, index) => {
    if (index < 3) {
      return { attachment: "solid" as const, learnStage: 3 };
    }
    if (index === 3) {
      return { attachment: "attached" as const, learnStage: 2 };
    }
    if (index === 4) {
      return {
        attachment: "learning" as const,
        learnStage: 2,
        stageReps: 0,
        dueAt: now + 24 * 60 * 60 * 1000,
      };
    }
    return { attachment: "unreached" as const };
  });

  const packs: PreviewPassageSeedPack[] = [
    {
      id: "passage-ready-psalm-1",
      role: "readyToStart",
      name: "Sample · Psalm 1 (start passage)",
      description:
        "Eligible scope pack with no passage row yet — use Learn as a passage.",
      howToTry:
        "Open this pack → Learn as a passage. Confirm start works and pieces freeze.",
      scope: scopeChapter("Psalms", 1),
    },
    {
      id: "passage-building-jude",
      role: "buildingDue",
      name: "Sample · Jude (building)",
      description:
        "Mid-build passage with a due frontier and introduces left today.",
      howToTry:
        "Open Learn or the pack → continue Jude. Solidify the frontier, then introduce the next piece.",
      scope: scopeWholeBook("Jude"),
      passage: {
        status: "building",
        addsOnDay: 2,
        addDayKey: todayKey,
        schedule: buildingSchedule(now),
        pieces: paintPieces(judeBases, judePaint),
      },
    },
    {
      id: "passage-budget-3-john",
      role: "budgetExhausted",
      name: "Sample · 3 John (budget used)",
      description:
        "Building passage with today's introduce budget already spent.",
      howToTry:
        "Open the pack/Learn. You should see the budget-exhausted copy, not frontier-locked copy. Practice rope is still allowed.",
      scope: scopeWholeBook("3 John"),
      passage: {
        status: "building",
        addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
        addDayKey: todayKey,
        schedule: buildingSchedule(now),
        pieces: paintPieces(thirdJohnBases, thirdJohnPaint),
      },
    },
    {
      id: "passage-review-psalm-23",
      role: "maintenanceDue",
      name: "Sample · Psalm 23 (maintenance due)",
      description:
        "Fully solid passage in reviewing status, due now for maintenance.",
      howToTry:
        "Open Review or the pack. Pass once, then fail once — due date/ease should move both times (not only on ≥85%).",
      scope: scopeChapter("Psalms", 23),
      passage: {
        status: "reviewing",
        addsOnDay: 0,
        schedule: reviewingDueSchedule(now),
        pieces: paintPieces(
          psalm23Bases,
          psalm23Bases.map(() => ({
            attachment: "solid" as const,
            learnStage: 3,
          })),
        ),
      },
    },
    {
      id: "passage-collection-multi",
      role: "collectionOnly",
      name: "Sample · Multi-book (collection only)",
      description: "Multi-book scope — passage mode must stay unavailable.",
      howToTry:
        "Open the pack. Learn as a passage should be hidden; collection/heart behavior only.",
      scope: multiBookScope(),
    },
  ];

  // Guardrail: sample scopes must stay uniquely keyed the same way create() does.
  for (let i = 0; i < packs.length; i++) {
    for (let j = i + 1; j < packs.length; j++) {
      if (scopesEqual(packs[i].scope, packs[j].scope)) {
        throw new Error(
          `Preview passage seed has duplicate scopes: ${packs[i].name} and ${packs[j].name}`,
        );
      }
    }
  }

  return { packs };
}
