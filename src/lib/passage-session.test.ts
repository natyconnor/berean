import { describe, expect, it } from "vitest";

import { diffWords } from "./diff-words";
import { DAY_MS, requiredRepsFor } from "./memory-scheduler";
import {
  PASSAGE_MAX_ADDS_PER_DAY,
  remainingIntroduces,
} from "./passage-frontier";
import type { PassagePiece } from "./passage-pieces";
import {
  initialPassageSessionPhase,
  reconcilePassagePhase,
  reducePassageSession,
  repairWindowStart,
  sessionPhaseForPieces,
  type PassageSessionState,
} from "./passage-session";

const NOW = 1_700_000_000_000;
const TZ = 0;

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
  extra?: Partial<PassagePiece>,
): PassagePiece {
  return {
    index,
    book: "John",
    chapter: 3,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: extra?.sectionIndex ?? 0,
    attachment,
    learnStage: 0,
    stageReps: 0,
    ...extra,
  };
}

function session(
  pieces: readonly PassagePiece[],
  extra?: Partial<PassageSessionState>,
): PassageSessionState {
  const addsOnDay = extra?.addsOnDay ?? 0;
  const addDayKey = extra?.addDayKey;
  const now = extra?.now ?? NOW;
  const remaining = remainingIntroduces({
    addsOnDay,
    addDayKey,
    todayKey: extra?.addDayKey === undefined ? 0 : extra.addDayKey,
  });
  return {
    phase:
      extra?.phase ??
      initialPassageSessionPhase({
        pieces,
        remainingIntroduces:
          extra?.addDayKey === undefined
            ? PASSAGE_MAX_ADDS_PER_DAY - addsOnDay
            : remaining,
        now,
      }),
    pieces,
    addsOnDay,
    addDayKey,
    now,
    tzOffsetMinutes: TZ,
    pieceWordCounts: extra?.pieceWordCounts ?? pieces.map(() => 10),
    ...extra,
  };
}

function pass(state: PassageSessionState, extra?: { now?: number }) {
  return reducePassageSession(state, {
    type: "attempt",
    accuracy: 100,
    now: extra?.now,
  });
}

function fail(
  state: PassageSessionState,
  tokens = diffWords("wrong", "one two three"),
) {
  return reducePassageSession(state, {
    type: "attempt",
    accuracy: 40,
    tokens,
  });
}

function passFrontierUntil(
  start: PassageSessionState,
  predicate: (state: PassageSessionState) => boolean,
  maxAttempts = 20,
): PassageSessionState {
  let current = start;
  for (let i = 0; i < maxAttempts; i += 1) {
    if (predicate(current)) return current;
    current = pass(current);
  }
  throw new Error("frontier did not reach expected state");
}

describe("reducePassageSession", () => {
  it("introduces the first piece at Read 0", () => {
    const start = session([piece(0, "unreached"), piece(1, "unreached")]);
    expect(start.phase).toBe("offer-introduce");

    const next = reducePassageSession(start, { type: "introduce" });
    expect(next.pieces[0]?.attachment).toBe("learning");
    expect(next.pieces[0]?.learnStage).toBe(0);
    expect(next.pieces[0]?.stageReps).toBe(0);
    expect(next.pieces[1]?.attachment).toBe("unreached");
    expect(next.phase).toBe("frontier");
    expect(next.addsOnDay).toBe(1);
    expect(next.pendingMutation).toEqual({ name: "introduceNext" });
  });

  it("attaches only after Guided clears, not after Read", () => {
    let current = reducePassageSession(session([piece(0, "unreached")]), {
      type: "introduce",
    });
    current = pass(current);
    expect(current.pieces[0]?.attachment).toBe("learning");
    expect(current.pieces[0]?.learnStage).toBe(1);

    current = passFrontierUntil(
      current,
      (state) => state.pieces[0]?.attachment === "attached",
    );
    expect(current.pieces[0]?.attachment).toBe("attached");
    expect(current.pieces[0]?.learnStage).toBe(2);
  });

  it("soft-locks after Guided and offers the next verse instead of rope", () => {
    let current = reducePassageSession(
      session([piece(0, "unreached"), piece(1, "unreached")]),
      { type: "introduce" },
    );
    current = passFrontierUntil(
      current,
      (state) => state.pieces[0]?.attachment === "attached",
    );

    const locked = current.pieces[0];
    expect(locked?.dueAt).toBeGreaterThan(current.now);
    expect(locked?.learnStage).toBe(2);
    expect(current.phase).toBe("offer-introduce");

    const ignored = pass(current);
    expect(ignored.phase).toBe("offer-introduce");
    expect(ignored.pendingMutation).toBeUndefined();
    expect(ignored.pieces[0]?.learnStage).toBe(locked?.learnStage);
  });

  it("offers a rolling pair connect after every attached piece from the second on", () => {
    let current = session([
      piece(0, "unreached"),
      piece(1, "unreached"),
      piece(2, "unreached"),
      piece(3, "unreached"),
    ]);

    current = reducePassageSession(current, { type: "introduce" });
    current = passFrontierUntil(
      current,
      (state) => state.pieces[0]?.attachment === "attached",
    );
    expect(current.phase).toBe("offer-introduce");

    current = reducePassageSession(current, { type: "introduce" });
    current = passFrontierUntil(
      current,
      (state) => state.pieces[1]?.attachment === "attached",
    );
    expect(current.phase).toBe("connect");
    expect(current.rehearsalRopeIndexes).toEqual([0, 1]);

    current = reducePassageSession(current, { type: "continue" });
    expect(current.phase).toBe("offer-introduce");

    current = reducePassageSession(current, { type: "introduce" });
    current = passFrontierUntil(
      current,
      (state) => state.pieces[2]?.attachment === "attached",
    );
    expect(current.phase).toBe("connect");
    expect(current.rehearsalRopeIndexes).toEqual([1, 2]);

    current = reducePassageSession(current, { type: "continue" });
    current = reducePassageSession(current, { type: "introduce" });
    current = passFrontierUntil(
      current,
      (state) => state.pieces[3]?.attachment === "attached",
    );
    expect(current.phase).toBe("connect");
    expect(current.rehearsalRopeIndexes).toEqual([2, 3]);
  });

  it("repairs a rope fail then continues", () => {
    const start = session(
      [
        piece(0, "attached", { learnStage: 2, stageReps: 0 }),
        piece(1, "unreached"),
      ],
      { phase: "rope" },
    );
    const stalled = fail(start);
    expect(stalled.phase).toBe("stall-repair");
    expect(stalled.interruptedPhase).toBeDefined();

    const continued = pass(stalled);
    expect(continued.phase).not.toBe("stall-repair");
    expect(["frontier", "offer-introduce", "frontier-locked"]).toContain(
      continued.phase,
    );
  });

  it("repairs from one rope piece earlier in a gapped window", () => {
    const twoPieceGap = session(
      [
        piece(0, "solid", { learnStage: 3 }),
        piece(1, "unreached"),
        piece(2, "attached", { learnStage: 2 }),
      ],
      {
        phase: "rope",
        pieceWordCounts: [3, 3, 3],
      },
    );
    const tokens = diffWords(
      "one two three four five WRONG",
      "one two three four five six",
    );
    const stalled = reducePassageSession(twoPieceGap, {
      type: "attempt",
      accuracy: 40,
      tokens,
    });
    expect(stalled.phase).toBe("stall-repair");
    expect(stalled.rehearsalRopeIndexes).toEqual([0, 2]);
    expect(stalled.stallIndex).toBe(1);
    expect(repairWindowStart(stalled)).toBe(0);
    expect(stalled.pieces[repairWindowStart(stalled)]?.attachment).not.toBe(
      "unreached",
    );
  });

  it("does not remap a failed repair onto rope pieces omitted from the prompt", () => {
    const afterFirstFail = session(
      [
        piece(0, "solid", { learnStage: 3 }),
        piece(1, "unreached"),
        piece(2, "attached", { learnStage: 2 }),
        piece(3, "learning", { learnStage: 0 }),
        piece(4, "unreached"),
        piece(5, "attached", { learnStage: 2 }),
      ],
      {
        phase: "stall-repair",
        stallIndex: 2,
        rehearsalStart: 0,
        rehearsalRopeIndexes: [0, 2, 5],
        pieceWordCounts: [3, 3, 3, 3, 3, 3],
      },
    );
    expect(repairWindowStart(afterFirstFail)).toBe(2);

    const retried = reducePassageSession(afterFirstFail, {
      type: "attempt",
      accuracy: 40,
      tokens: diffWords(
        "WRONG two three four five six",
        "one two three four five six",
      ),
    });
    expect(retried.phase).toBe("stall-repair");
    expect(retried.rehearsalRopeIndexes).toEqual([2, 5]);
    expect(retried.stallIndex).toBe(0);
    expect(repairWindowStart(retried)).toBe(2);
    expect(repairWindowStart(retried)).not.toBe(0);
  });

  it("solids a piece when From Memory clears", () => {
    const start = session(
      [
        piece(0, "attached", {
          learnStage: 3,
          stageReps: requiredRepsFor(3, 10) - 1,
        }),
        piece(1, "unreached", { sectionIndex: 1 }),
      ],
      { phase: "frontier" },
    );
    const next = pass(start);
    expect(next.pieces[0]?.attachment).toBe("solid");
    expect(next.pieces[0]?.learnStage).toBe(3);
  });

  it("enters section-complete when the last piece in a section becomes solid", () => {
    const start = session(
      [
        piece(0, "solid", { sectionIndex: 0, learnStage: 3 }),
        piece(1, "attached", {
          sectionIndex: 0,
          learnStage: 3,
          stageReps: requiredRepsFor(3, 10) - 1,
        }),
        piece(2, "unreached", { sectionIndex: 1, startVerse: 3, endVerse: 3 }),
      ],
      { phase: "frontier" },
    );
    const next = pass(start);
    expect(next.pieces[1]?.attachment).toBe("solid");
    expect(next.phase).toBe("section-complete");
    expect(next.pieces[2]?.attachment).toBe("unreached");
  });

  it("counts five introduces and refuses a sixth", () => {
    const unreached = Array.from({ length: 8 }, (_, index) =>
      piece(index, "unreached", { startVerse: index + 1, endVerse: index + 1 }),
    );
    let current = session(unreached);
    for (let i = 0; i < PASSAGE_MAX_ADDS_PER_DAY; i += 1) {
      current = reducePassageSession(current, { type: "introduce" });
    }
    expect(
      current.pieces.filter((p) => p.attachment === "learning"),
    ).toHaveLength(PASSAGE_MAX_ADDS_PER_DAY);
    expect(current.addsOnDay).toBe(PASSAGE_MAX_ADDS_PER_DAY);

    const refused = reducePassageSession(current, { type: "introduce" });
    expect(
      refused.pieces.filter((p) => p.attachment === "learning"),
    ).toHaveLength(PASSAGE_MAX_ADDS_PER_DAY);
    expect(refused.addsOnDay).toBe(PASSAGE_MAX_ADDS_PER_DAY);
    expect(refused.phase).toBe("budget-exhausted");
    expect(refused.pendingMutation).toBeUndefined();
  });

  it("resets the introduce budget when localDayIndex advances", () => {
    const unreached = [piece(0, "unreached"), piece(1, "unreached")];
    const todayKey = 42;
    const exhausted = session(unreached, {
      addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
      addDayKey: todayKey,
      now: todayKey * DAY_MS,
      phase: "offer-introduce",
    });
    expect(
      remainingIntroduces({
        addsOnDay: exhausted.addsOnDay,
        addDayKey: exhausted.addDayKey,
        todayKey,
      }),
    ).toBe(0);

    const nextDay = reducePassageSession(exhausted, {
      type: "introduce",
      now: (todayKey + 1) * DAY_MS,
    });
    expect(nextDay.pieces[0]?.attachment).toBe("learning");
    expect(nextDay.addsOnDay).toBe(1);
    expect(nextDay.addDayKey).toBe(todayKey + 1);
  });

  it("opens with a warm-up when at least two pieces are already practiced", () => {
    const start = session([
      piece(0, "attached", {
        learnStage: 2,
        dueAt: NOW + DAY_MS,
      }),
      piece(1, "attached", {
        learnStage: 2,
        dueAt: NOW + DAY_MS,
      }),
      piece(2, "unreached"),
    ]);
    expect(start.phase).toBe("rope");
  });

  it("opens on the due verse when fewer than two pieces are practiced", () => {
    const start = session([
      piece(0, "attached", { learnStage: 2 }),
      piece(1, "unreached"),
    ]);
    expect(start.phase).toBe("frontier");
  });

  it("offers the next verse when the current one is locked and no warm-up applies", () => {
    const start = session([
      piece(0, "attached", {
        learnStage: 2,
        dueAt: NOW + DAY_MS,
      }),
      piece(1, "unreached"),
    ]);
    expect(start.phase).toBe("offer-introduce");
  });

  it("keeps offering the next verse after warm-up when budget remains", () => {
    const warmed = session(
      [
        piece(0, "attached", {
          learnStage: 2,
          dueAt: NOW + DAY_MS,
        }),
        piece(1, "attached", {
          learnStage: 2,
          dueAt: NOW + DAY_MS,
        }),
        piece(2, "unreached"),
      ],
      { phase: "rope" },
    );
    const next = reducePassageSession(warmed, { type: "continue" });
    expect(next.phase).toBe("offer-introduce");
  });

  it("ends the day when practiced verses are locked and nothing else is due", () => {
    expect(
      sessionPhaseForPieces({
        pieces: [
          piece(0, "attached", {
            learnStage: 2,
            dueAt: NOW + DAY_MS,
          }),
          piece(1, "attached", {
            learnStage: 2,
            dueAt: NOW + DAY_MS,
          }),
        ],
        remainingIntroduces: 0,
        now: NOW,
      }),
    ).toBe("frontier-locked");
  });

  it("reconciles a frontier phase with no due verse after the server locks it", () => {
    expect(
      reconcilePassagePhase(
        "frontier",
        [
          piece(0, "attached", {
            learnStage: 2,
            dueAt: NOW + DAY_MS,
          }),
          piece(1, "unreached"),
        ],
        4,
        NOW,
      ),
    ).toBe("offer-introduce");
  });
});
