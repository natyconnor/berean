import { v, type Infer } from "convex/values";

export const pieceAttachmentValidator = v.union(
  v.literal("unreached"),
  v.literal("learning"),
  v.literal("attached"),
  v.literal("solid"),
);

export const passageStatusValidator = v.union(
  v.literal("building"),
  v.literal("reviewing"),
  v.literal("mastered"),
);

export const qualityValidator = v.union(
  v.literal("exact"),
  v.literal("close"),
  v.literal("off"),
);

export const passageAttemptKindValidator = v.union(
  v.literal("rope"),
  v.literal("repair"),
  v.literal("review"),
  v.literal("frontier"),
);

export const pieceBaseValidator = v.object({
  index: v.number(),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  sectionIndex: v.number(),
  sectionLabel: v.optional(v.string()),
});

export const passagePieceValidator = v.object({
  index: v.number(),
  book: v.string(),
  chapter: v.number(),
  startVerse: v.number(),
  endVerse: v.number(),
  sectionIndex: v.number(),
  sectionLabel: v.optional(v.string()),
  attachment: pieceAttachmentValidator,
  learnStage: v.number(),
  stageReps: v.number(),
  dueAt: v.optional(v.number()),
});

/**
 * Stored `passageMemory` fields plus computed introduce budget, frontier, and
 * default rope-window meta. `remainingIntroduces`, `frontierIndex`,
 * `rehearsalStartIndex`, and `ropePieceIndexes` are not persisted.
 */
export const passageViewValidator = v.object({
  _id: v.id("passageMemory"),
  packId: v.id("packs"),
  status: passageStatusValidator,
  pieces: v.array(passagePieceValidator),
  addDayKey: v.optional(v.number()),
  addsOnDay: v.number(),
  ease: v.number(),
  intervalDays: v.number(),
  dueAt: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  stageReps: v.number(),
  earlyReviewApplied: v.optional(v.boolean()),
  lastSessionAt: v.optional(v.number()),
  migratedAt: v.optional(v.number()),
  unheartedCount: v.optional(v.number()),
  keptHeartCount: v.optional(v.number()),
  migrationBannerDismissed: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
  remainingIntroduces: v.number(),
  frontierIndex: v.number(),
  rehearsalStartIndex: v.number(),
  ropePieceIndexes: v.array(v.number()),
});

export type PieceBase = Infer<typeof pieceBaseValidator>;
export type PassagePieceValue = Infer<typeof passagePieceValidator>;
export type PassageView = Infer<typeof passageViewValidator>;
export type PassageAttemptQuality = Infer<typeof qualityValidator>;
export type PassageAttemptKind = Infer<typeof passageAttemptKindValidator>;

const memoryStatusValidator = v.union(
  v.literal("new"),
  v.literal("learning"),
  v.literal("reviewing"),
  v.literal("mastered"),
);

/** Unified or passage pack card in the global Learn / Review queues. */
export const dueQueuePackItemValidator = v.object({
  kind: v.literal("pack"),
  packId: v.id("packs"),
  packName: v.string(),
  dueAt: v.number(),
  status: memoryStatusValidator,
  learnStage: v.number(),
  stageReps: v.optional(v.number()),
  ease: v.number(),
  intervalDays: v.number(),
  consecutiveCorrect: v.number(),
  lapses: v.number(),
  earlyReviewApplied: v.optional(v.boolean()),
  lastReviewedAt: v.optional(v.number()),
  members: v.array(
    v.object({
      book: v.string(),
      chapter: v.number(),
      startVerse: v.number(),
      endVerse: v.number(),
    }),
  ),
  passageStatus: v.optional(passageStatusValidator),
});
