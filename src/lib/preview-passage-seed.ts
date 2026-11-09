import type { EsvVerse } from "../../shared/esv-api";
import {
  EASE_START,
  requiredRepsFor,
  type MemorySchedule,
} from "./memory-scheduler";
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
  | "sectionOneStepLeft";

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
  /** Absent for readyToStart — user opts in from the pack. */
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

const PSALM_13_VERSES: EsvVerse[] = [
  {
    number: 1,
    text: "How long, O Lord? Will you forget me forever? How long will you hide your face from me?",
  },
  {
    number: 2,
    text: "How long must I take counsel in my soul and have sorrow in my heart all the day? How long shall my enemy be exalted over me?",
  },
  {
    number: 3,
    text: "Consider and answer me, O Lord my God; light up my eyes, lest I sleep the sleep of death,",
  },
  {
    number: 4,
    text: "lest my enemy say, \u201cI have prevailed over him,\u201d lest my foes rejoice because I am shaken.",
  },
  {
    number: 5,
    text: "But I have trusted in your steadfast love; my heart shall rejoice in your salvation.",
  },
  {
    number: 6,
    text: "I will sing to the Lord, because he has dealt bountifully with me.",
  },
];

const PSALM_15_VERSES: EsvVerse[] = [
  {
    number: 1,
    text: "O Lord, who shall sojourn in your tent? Who shall dwell on your holy hill?",
  },
  {
    number: 2,
    text: "He who walks blamelessly and does what is right and speaks truth in his heart;",
  },
  {
    number: 3,
    text: "who does not slander with his tongue and does no evil to his neighbor, nor takes up a reproach against his friend;",
  },
  {
    number: 4,
    text: "in whose eyes a vile person is despised, but who honors those who fear the Lord; who swears to his own hurt and does not change;",
  },
  {
    number: 5,
    text: "who does not put out his money at interest and does not take a bribe against the innocent. He who does these things shall never be moved.",
  },
];

const PSALM_100_VERSES: EsvVerse[] = [
  { number: 1, text: "Make a joyful noise to the Lord, all the earth!" },
  {
    number: 2,
    text: "Serve the Lord with gladness! Come into his presence with singing!",
  },
  {
    number: 3,
    text: "Know that the Lord, he is God! It is he who made us, and we are his; we are his people, and the sheep of his pasture.",
  },
  {
    number: 4,
    text: "Enter his gates with thanksgiving, and his courts with praise! Give thanks to him; bless his name!",
  },
  {
    number: 5,
    text: "For the Lord is good; his steadfast love endures forever, and his faithfulness to all generations.",
  },
];

const PSALM_112_VERSES: EsvVerse[] = [
  {
    number: 1,
    text: "Praise the Lord! Blessed is the man who fears the Lord, who greatly delights in his commandments!",
    heading: "The Righteous Will Never Be Moved",
  },
  {
    number: 2,
    text: "His offspring will be mighty in the land; the generation of the upright will be blessed.",
  },
  {
    number: 3,
    text: "Wealth and riches are in his house, and his righteousness endures forever.",
  },
  {
    number: 4,
    text: "Light dawns in the darkness for the upright; he is gracious, merciful, and righteous.",
  },
  {
    number: 5,
    text: "It is well with the man who deals generously and lends; who conducts his affairs with justice.",
  },
  {
    number: 6,
    text: "For the righteous will never be moved; he will be remembered forever.",
  },
  {
    number: 7,
    text: "He is not afraid of bad news; his heart is firm, trusting in the Lord.",
  },
  {
    number: 8,
    text: "His heart is steady; he will not be afraid, until he looks in triumph on his adversaries.",
  },
  {
    number: 9,
    text: "He has distributed freely; he has given to the poor; his righteousness endures forever; his horn is exalted in honor.",
  },
  {
    number: 10,
    text: "The wicked man sees it and is angry; he gnashes his teeth and melts away; the desire of the wicked will perish!",
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

/**
 * A whole psalm, every piece solid, reviewing and due now: one fresh counted
 * review per seed.
 */
function maintenanceDuePsalm(
  now: number,
  chapter: number,
  verses: EsvVerse[],
  howToTry: string,
): PreviewPassageSeedPack {
  const bases = buildPassagePieces([{ book: "Psalms", chapter, verses }]);
  return {
    id: `passage-review-psalm-${chapter}`,
    role: "maintenanceDue",
    name: `Sample · Psalm ${chapter} (maintenance due)`,
    description:
      "Fully solid passage in reviewing status, due now for maintenance.",
    howToTry,
    scope: scopeChapter("Psalms", chapter),
    passage: {
      status: "reviewing",
      addsOnDay: 0,
      schedule: reviewingDueSchedule(now),
      pieces: paintPieces(
        bases,
        bases.map(() => ({ attachment: "solid" as const, learnStage: 3 })),
      ),
    },
  };
}

function isProdDeployment(convexDeployment: string | undefined): boolean {
  return convexDeployment?.startsWith("prod:") === true;
}

/**
 * Three more due maintenance passages, one per refresher case a tester walks
 * through. Never seeded on a production Convex deployment.
 */
export function testerMaintenancePacks(
  now: number,
  convexDeployment: string | undefined,
): PreviewPassageSeedPack[] {
  if (isProdDeployment(convexDeployment)) return [];
  return [
    maintenanceDuePsalm(
      now,
      13,
      PSALM_13_VERSES,
      "Open Review or the pack. Miss a verse or two (60–84%), take the refresher, then pass From memory. That pass replaces the miss.",
    ),
    maintenanceDuePsalm(
      now,
      15,
      PSALM_15_VERSES,
      "Open Review or the pack. Tap Need a refresher? before trying, then miss the From memory try. That miss counts.",
    ),
    maintenanceDuePsalm(
      now,
      100,
      PSALM_100_VERSES,
      "Open Review or the pack and recite the whole passage for a normal review.",
    ),
  ];
}

/**
 * A Learning Psalm 112 one From memory pass from finishing its first section,
 * so a tester reaches "Recite this section" and its refresher (S15, R37).
 * Never seeded on a production Convex deployment.
 */
export function testerSectionRecitalPacks(
  now: number,
  convexDeployment: string | undefined,
): PreviewPassageSeedPack[] {
  if (isProdDeployment(convexDeployment)) return [];
  const bases = buildPassagePieces([
    { book: "Psalms", chapter: 112, verses: PSALM_112_VERSES },
  ]);
  // Sections run in order from 0, so this is the first section's last piece.
  const lastOfSection =
    bases.filter((piece) => piece.sectionIndex === 0).length - 1;
  const pieces = paintPieces(
    bases,
    bases.map((_, index) =>
      index < lastOfSection
        ? { attachment: "solid" as const, learnStage: 3 }
        : index === lastOfSection
          ? {
              attachment: "attached" as const,
              learnStage: 3,
              stageReps: requiredRepsFor(3) - 1,
              dueAt: now,
            }
          : { attachment: "unreached" as const },
    ),
  );
  return [
    {
      id: "passage-section-psalm-112",
      role: "sectionOneStepLeft",
      name: "Sample · Psalm 112 (section almost done)",
      description:
        "Learning passage one From memory pass from finishing its first section.",
      howToTry:
        "Open the pack or Learn → Psalm 112. Skip warm-up, type the due verse from memory and Check answer, then Continue. On Section complete, tap Recite this section: Need a refresher? sits under the hint, and a try under 85% offers it beside Continue.",
      scope: scopeChapter("Psalms", 112),
      passage: {
        status: "building",
        addsOnDay: 0,
        schedule: buildingSchedule(now),
        pieces,
      },
    },
  ];
}

/**
 * Deterministic passage packs for preview/dev manual testing. Kept separate
 * from hearted-verse samples so Memory home can list how-to-try steps for each.
 * The seed mutation gives each seeded passage its passage heart (one per
 * chapter, from `passageHeartSpans`).
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
        "Open this pack → Learn as a passage. Confirm start works, pieces freeze, and one Psalm 1 heart appears in the reader.",
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
    maintenanceDuePsalm(
      now,
      23,
      PSALM_23_VERSES,
      "Open Review or the pack and recite the whole passage from memory.",
    ),
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
