import { type JSX, type ReactNode, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useMutation } from "convex/react";

import {
  PassageRecallCard,
  type PassageRecallHint,
  type PassageRecallResult,
} from "@/components/memory/passage/passage-recall-card";
import {
  chromeStage,
  computeStallCue,
  DONE_FOR_NOW_LABEL,
  FRONTIER_LOCKED_COPY,
  frontierHint,
  INTRODUCE_ANOTHER_LABEL,
  joinPieceTexts,
  PASSAGE_SESSION_PHASE_LABELS,
  pieceCardTitle,
  pieceReference,
  pieceStatus,
  remainingAddsIn,
  repairPromptIndexes,
  ropeWindowPieceIndexes,
  SECTION_COMPLETE_COPY,
  SECTION_RECITE_LABEL,
  sectionIndexes,
  sessionFromView,
  tzOffsetMinutesAt,
  usedIntroducesToday,
  verseCountIn,
  windowTitle,
  type RopeStartOverride,
} from "@/components/memory/passage/passage-session-model";
import type { PassageView } from "@/components/memory/passage/passage-session-types";
import type { VerseAttemptQuality } from "@/components/study/study-attempt-quality";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEsvCompositePassage } from "@/hooks/use-esv-composite-passage";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  compositeHintForWindow,
  dueFrontierIndex,
  frontierIndex,
  isPassagePieceLocked,
  rehearsalStartIndex,
  ropePieceIndexes,
  sectionStartIndex,
} from "@/lib/passage-frontier";
import type { PassagePiece } from "@/lib/passage-pieces";
import {
  reducePassageSession,
  type PassageSessionPhase,
  type PassageSessionState,
} from "@/lib/passage-session";
import { countVerseWords } from "@/lib/verse-hint";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type BuiltRecall = {
  mode: "rope" | "repair" | "frontier" | "review";
  title: string;
  subtitle?: string;
  promptLine: string;
  versePlainText: string;
  loading: boolean;
  error: string | null;
  retry: () => void;
  hint: PassageRecallHint;
  learnStage: number;
  stageReps: number;
  status: "learning" | "reviewing";
  showJourneyBar: boolean;
  readContinue: boolean;
};

interface PassageSessionProps {
  packId: Id<"packs">;
  view: PassageView;
  packName: string;
  onExit: () => void;
  exitTooltip?: string;
}

export function PassageSession({
  packId,
  view,
  packName,
  onExit,
  exitTooltip = "Go back to the pack",
}: PassageSessionProps): JSX.Element {
  const now = useLiveNow();
  const tzOffsetMinutes = tzOffsetMinutesAt(now);
  const introduceNext = useMutation(api.passageMemory.introduceNext);
  const recordAttempt = useMutation(api.passageMemory.recordAttempt);

  const isMaintenance =
    view.status === "reviewing" || view.status === "mastered";

  const [state, setState] = useState<PassageSessionState>(() =>
    sessionFromView(view, now, tzOffsetMinutes),
  );
  const [ropeOverride, setRopeOverride] =
    useState<RopeStartOverride>("rehearsal");
  const [stallCue, setStallCue] = useState<string | null>(null);
  const [holdResult, setHoldResult] = useState(false);
  const [heldRecall, setHeldRecall] = useState<BuiltRecall | null>(null);
  const [recitingSection, setRecitingSection] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);

  const pieceRefs = useMemo(
    () => view.pieces.map(pieceReference),
    [view.pieces],
  );
  const composite = useEsvCompositePassage(pieceRefs, {
    enabled: view.pieces.length > 0,
  });
  const pieceTexts = useMemo(
    () => view.pieces.map((_, index) => composite.segments[index]?.text ?? ""),
    [view.pieces, composite.segments],
  );
  const pieceWordCounts = useMemo(
    () => pieceTexts.map((text) => countVerseWords(text)),
    [pieceTexts],
  );
  const wordCountsReady =
    composite.segments.length === view.pieces.length &&
    !composite.loading &&
    composite.error === null;

  const ropeIndexes = ropeWindowPieceIndexes(
    state.pieces,
    recitingSection ? "section" : ropeOverride,
    wordCountsReady ? pieceWordCounts : undefined,
  );
  const liveRecall = isMaintenance
    ? reviewRecall(packName, state.pieces, pieceTexts, composite)
    : buildingRecall({
        packName,
        state,
        recitingSection,
        pieceTexts,
        compositeLoading: composite.loading,
        compositeError: composite.error,
        retry: composite.retry,
        ropeIndexes,
      });
  const recall = holdResult && heldRecall ? heldRecall : liveRecall;

  async function persist(
    next: PassageSessionState,
    quality: VerseAttemptQuality | undefined,
    durationMs?: number,
  ): Promise<boolean> {
    const pending = next.pendingMutation;
    if (!pending) {
      setState(next);
      setPersistError(null);
      return true;
    }
    const attemptedAt = Date.now();
    const tz = tzOffsetMinutesAt(attemptedAt);
    try {
      if (pending.name === "introduceNext") {
        const nextView = await introduceNext({
          packId,
          now: attemptedAt,
          tzOffsetMinutes: tz,
        });
        setState({
          ...next,
          pieces: nextView.pieces,
          addsOnDay: nextView.addsOnDay,
          addDayKey: nextView.addDayKey,
          pendingMutation: undefined,
        });
        setPersistError(null);
        return true;
      }
      if (!quality) return false;
      const nextView = await recordAttempt({
        packId,
        kind: pending.kind,
        quality,
        accuracy: pending.accuracy,
        now: attemptedAt,
        tzOffsetMinutes: tz,
        durationMs,
        pieceIndex: pending.pieceIndex,
      });
      setState({
        ...next,
        pieces: nextView.pieces,
        addsOnDay: nextView.addsOnDay,
        addDayKey: nextView.addDayKey,
        pendingMutation: undefined,
      });
      setPersistError(null);
      return true;
    } catch {
      setPersistError(
        pending.name === "introduceNext"
          ? "Couldn't introduce the next piece. Please try again."
          : "Couldn't save that attempt. Please try again.",
      );
      return false;
    }
  }

  function withWordCounts(current: PassageSessionState): PassageSessionState {
    return {
      ...current,
      pieceWordCounts: wordCountsReady
        ? pieceWordCounts
        : current.pieceWordCounts,
    };
  }

  async function handleGraded(result: PassageRecallResult): Promise<boolean> {
    if (isMaintenance) {
      const saved = await persist(
        {
          ...state,
          pendingMutation: {
            name: "recordAttempt",
            kind: "review",
            accuracy: result.accuracy,
          },
        },
        result.quality,
        result.durationMs,
      );
      if (!saved) return false;
      if (result.via === "typed") {
        setHoldResult(true);
        setHeldRecall(liveRecall);
      }
      return true;
    }

    const next = reducePassageSession(withWordCounts(state), {
      type: "attempt",
      accuracy: result.accuracy,
      tokens: result.tokens,
      now: Date.now(),
    });
    const saved = await persist(next, result.quality, result.durationMs);
    if (!saved) return false;
    if (result.via === "typed") {
      setHeldRecall(liveRecall);
      setHoldResult(true);
    }
    setStallCue(computeStallCue(next, pieceTexts));
    return true;
  }

  async function handleIntroduce() {
    const next = reducePassageSession(withWordCounts(state), {
      type: "introduce",
      now: Date.now(),
    });
    const saved = await persist(next, undefined);
    if (!saved) return;
    setRopeOverride("rehearsal");
    setStallCue(null);
    setHoldResult(false);
    setHeldRecall(null);
    setRecitingSection(false);
  }

  function handleContinueAfterResult() {
    setHoldResult(false);
    setHeldRecall(null);
    if (state.phase !== "rope" && state.phase !== "stall-repair") {
      setRopeOverride("rehearsal");
    }
    if (state.phase !== "section-complete") {
      setRecitingSection(false);
    }
  }

  function handleSkipSection() {
    const next = reducePassageSession(withWordCounts(state), {
      type: "continue",
      now: Date.now(),
    });
    setState(next);
    setHoldResult(false);
    setHeldRecall(null);
    setStallCue(null);
    setRecitingSection(false);
  }

  const phaseLabel = isMaintenance
    ? "Review"
    : PASSAGE_SESSION_PHASE_LABELS[state.phase];

  const defaultRehearsalStart = rehearsalStartIndex(
    state.pieces,
    wordCountsReady ? pieceWordCounts : undefined,
  );
  const lastRope = ropePieceIndexes(state.pieces).at(-1) ?? 0;
  const showSectionStart =
    !isMaintenance &&
    state.phase === "rope" &&
    sectionStartIndex(state.pieces, lastRope) < defaultRehearsalStart;
  const showBeginningStart =
    !isMaintenance &&
    state.phase === "rope" &&
    (ropePieceIndexes(state.pieces)[0] ?? 0) < defaultRehearsalStart;

  const remaining = remainingAddsIn(state);
  const introduceIsNudge = usedIntroducesToday(state) === 0;
  const showIntroducePanel =
    !isMaintenance && !holdResult && state.phase === "offer-introduce";
  const frontierPiece = state.pieces[frontierIndex(state.pieces)];
  const showFrontierLocked =
    !isMaintenance &&
    !holdResult &&
    state.phase !== "frontier" &&
    state.phase !== "stall-repair" &&
    state.phase !== "section-complete" &&
    Boolean(frontierPiece && isPassagePieceLocked(frontierPiece, state.now));

  return (
    <PassageSessionShell
      phaseLabel={phaseLabel}
      packName={packName}
      onExit={onExit}
      exitTooltip={exitTooltip}
      persistError={persistError}
    >
      {showIntroducePanel ? (
        <IntroducePanel
          remaining={remaining}
          nudge={introduceIsNudge}
          onIntroduce={() => {
            void handleIntroduce();
          }}
          onDone={onExit}
        />
      ) : null}

      {state.phase === "section-complete" && !holdResult && !recitingSection ? (
        <SectionCompletePanel
          onRecite={() => setRecitingSection(true)}
          onSkip={handleSkipSection}
        />
      ) : null}

      {showFrontierLocked ? (
        <p className="mb-4 text-center text-sm text-muted-foreground">
          {FRONTIER_LOCKED_COPY}
        </p>
      ) : null}

      {state.phase === "budget-exhausted" && !holdResult && !recall ? (
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Daily introduce budget is used. You can still practice the rope.
        </p>
      ) : null}

      {recall ? (
        <div className="space-y-3">
          {recall.mode === "rope" &&
          state.phase === "rope" &&
          (showSectionStart || showBeginningStart) ? (
            <div className="flex flex-wrap justify-center gap-2">
              {showSectionStart ? (
                <Button
                  type="button"
                  variant={ropeOverride === "section" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRopeOverride("section")}
                >
                  From the start of this section
                </Button>
              ) : null}
              {showBeginningStart ? (
                <Button
                  type="button"
                  variant={ropeOverride === "beginning" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRopeOverride("beginning")}
                >
                  From the beginning of the passage
                </Button>
              ) : null}
            </div>
          ) : null}
          <PassageRecallCard
            key={`${recall.mode}:${recall.title}`}
            mode={recall.mode}
            phaseLabel={phaseLabel}
            title={recall.title}
            subtitle={recall.subtitle}
            promptLine={recall.promptLine}
            versePlainText={recall.versePlainText}
            loading={recall.loading}
            error={recall.error}
            retry={recall.retry}
            hint={recall.hint}
            stallCue={stallCue}
            learnStage={recall.learnStage}
            stageReps={recall.stageReps}
            status={recall.status}
            showJourneyBar={recall.showJourneyBar}
            readContinue={recall.readContinue}
            onSubmit={handleGraded}
            onContinueAfterResult={handleContinueAfterResult}
          />
        </div>
      ) : null}
    </PassageSessionShell>
  );
}

function IntroducePanel({
  remaining,
  nudge,
  onIntroduce,
  onDone,
}: {
  remaining: number;
  /** Rope-only day: encourage an introduce without blocking exit or the rope. */
  nudge: boolean;
  onIntroduce: () => void;
  onDone: () => void;
}): JSX.Element {
  return (
    <div className="mx-auto mb-6 max-w-md space-y-3 text-center">
      <p className="text-sm text-muted-foreground">
        {nudge
          ? `You haven't introduced a new piece yet today. ${remaining} left.`
          : `Introduce another piece? ${remaining} left today.`}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={onIntroduce}>
          {INTRODUCE_ANOTHER_LABEL}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {DONE_FOR_NOW_LABEL}
        </Button>
      </div>
    </div>
  );
}

function SectionCompletePanel({
  onRecite,
  onSkip,
}: {
  onRecite: () => void;
  onSkip: () => void;
}): JSX.Element {
  return (
    <div className="mx-auto mb-6 max-w-md space-y-3 text-center">
      <p className="text-sm text-muted-foreground">{SECTION_COMPLETE_COPY}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={onRecite}>
          {SECTION_RECITE_LABEL}
        </Button>
        <Button type="button" variant="outline" onClick={onSkip}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function reviewRecall(
  packName: string,
  pieces: readonly PassagePiece[],
  texts: readonly string[],
  composite: { loading: boolean; error: string | null; retry: () => void },
): BuiltRecall {
  const indexes = pieces.map((_, index) => index);
  return {
    mode: "review",
    title: packName,
    subtitle: `${verseCountIn(pieces)} verses · whole passage`,
    promptLine: "Recite the whole passage from memory",
    versePlainText: joinPieceTexts(pieces, indexes, texts),
    loading: composite.loading,
    error: composite.error,
    retry: composite.retry,
    hint: {
      type: "hidden",
      message:
        "No hint text. Type the passage from memory — verse numbers not needed — then check your answer.",
    },
    learnStage: 3,
    stageReps: 0,
    status: "reviewing",
    showJourneyBar: false,
    readContinue: false,
  };
}

function ropeRecall(
  packName: string,
  pieces: readonly PassagePiece[],
  indexes: readonly number[],
  pieceTexts: readonly string[],
  compositeLoading: boolean,
  compositeError: string | null,
  retry: () => void,
  subtitle: string,
  promptLine: string,
): BuiltRecall {
  const start = indexes[0] ?? 0;
  const end = (indexes[indexes.length - 1] ?? 0) + 1;
  const hintText = compositeHintForWindow(pieces, start, end, pieceTexts);
  const allHidden = pieces
    .filter((_, index) => indexes.includes(index))
    .every((piece) => piece.attachment === "solid");

  return {
    mode: "rope",
    title: windowTitle(packName, pieces, indexes),
    subtitle,
    promptLine,
    versePlainText: joinPieceTexts(pieces, indexes, pieceTexts),
    loading: compositeLoading,
    error: compositeError,
    retry,
    hint: allHidden
      ? {
          type: "hidden",
          message:
            "No hint text. Type the passage from memory — verse numbers not needed — then check your answer.",
        }
      : { type: "text", text: hintText, label: "Rope hint" },
    learnStage: chromeStage(pieces, indexes),
    stageReps: 0,
    status: "learning",
    showJourneyBar: false,
    readContinue: false,
  };
}

function buildingRecall(args: {
  packName: string;
  state: PassageSessionState;
  recitingSection: boolean;
  pieceTexts: readonly string[];
  compositeLoading: boolean;
  compositeError: string | null;
  retry: () => void;
  ropeIndexes: readonly number[];
}): BuiltRecall | null {
  const {
    packName,
    state,
    recitingSection,
    pieceTexts,
    compositeLoading,
    compositeError,
    retry,
    ropeIndexes,
  } = args;
  const phase = state.phase;

  // After a rope-only session the introduce offer sits above the rope so
  // exit and mixed-support practice stay available. First-piece sessions
  // have no rope yet, so the offer is the only card.
  if (phase === "offer-introduce" && ropeIndexes.length === 0) return null;

  if (phase === "section-complete") {
    if (!recitingSection) return null;
    const indexes = sectionIndexes(state.pieces);
    if (indexes.length === 0) return null;
    return ropeRecall(
      packName,
      state.pieces,
      indexes,
      pieceTexts,
      compositeLoading,
      compositeError,
      retry,
      "Section recitation",
      "Recite this section from memory",
    );
  }

  if (phase === "stall-repair") {
    const indexes = repairPromptIndexes(state);
    const start = indexes[0] ?? 0;
    const end = (indexes[indexes.length - 1] ?? 0) + 1;
    return {
      mode: "repair",
      title: windowTitle(packName, state.pieces, indexes),
      subtitle: "Repair the stall",
      promptLine: "Type the repair window from memory",
      versePlainText: joinPieceTexts(state.pieces, indexes, pieceTexts),
      loading: compositeLoading,
      error: compositeError,
      retry,
      hint: {
        type: "text",
        text: compositeHintForWindow(state.pieces, start, end, pieceTexts),
        label: "Rope hint",
      },
      learnStage: chromeStage(state.pieces, indexes),
      stageReps: 0,
      status: "learning",
      showJourneyBar: false,
      readContinue: false,
    };
  }

  if (phase === "frontier") {
    const due = dueFrontierIndex(state.pieces, state.now);
    if (due === null) return null;
    const piece = state.pieces[due];
    if (!piece) return null;
    const text = pieceTexts[due] ?? "";
    const masked = frontierHint(text, piece.learnStage, piece.stageReps);
    return {
      mode: "frontier",
      title: pieceCardTitle(piece),
      subtitle: undefined,
      promptLine:
        masked.stage === "full"
          ? "Read it through, then continue"
          : masked.stage === "hidden"
            ? "Recall the verse from memory"
            : "Type what you remember",
      versePlainText: text,
      loading: compositeLoading,
      error: compositeError,
      retry,
      hint:
        masked.stage === "hidden"
          ? {
              type: "hidden",
              message:
                "No hint text. Type the verse from memory, then check your answer.",
            }
          : { type: "tokens", tokens: masked.tokens },
      learnStage: piece.learnStage,
      stageReps: piece.stageReps,
      status: pieceStatus(piece),
      showJourneyBar: true,
      readContinue: masked.stage === "full",
    };
  }

  const ropePhases: PassageSessionPhase[] = [
    "rope",
    "frontier-locked",
    "budget-exhausted",
    "passage-complete",
    "offer-introduce",
  ];
  if (!ropePhases.includes(phase)) return null;
  if (ropeIndexes.length === 0) return null;

  return ropeRecall(
    packName,
    state.pieces,
    ropeIndexes,
    pieceTexts,
    compositeLoading,
    compositeError,
    retry,
    "Mixed-support recitation",
    "Type the window using the mixed-support hints",
  );
}

function PassageSessionShell({
  phaseLabel,
  packName,
  onExit,
  exitTooltip,
  persistError,
  children,
}: {
  phaseLabel: string;
  packName: string;
  onExit: () => void;
  exitTooltip: string;
  persistError: string | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExit}
                className="-ml-2 shrink-0 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            </TooltipTrigger>
            <TooltipContent>{exitTooltip}</TooltipContent>
          </Tooltip>
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg tracking-tight">
            <span
              className="shrink-0 font-semibold"
              role="status"
              aria-label={`Session phase: ${phaseLabel}`}
            >
              {phaseLabel}
            </span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="truncate font-medium text-muted-foreground">
              {packName}
            </span>
          </h1>
        </div>
      </header>
      {persistError ? (
        <div
          role="alert"
          className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive"
        >
          {persistError}
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-6">{children}</div>
      </ScrollArea>
    </div>
  );
}
