import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Dumbbell,
  GraduationCap,
  Heart,
  Loader2,
  Pencil,
  Play,
  Plus,
  ScrollText,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLiveNow } from "@/hooks/use-live-now";
import { useScopeHeartPreview } from "@/hooks/use-scope-heart-preview";
import { heartSpansInChunks } from "@/lib/heart-many-client";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { memoryLearnSearch } from "@/lib/memory-learn-search";
import { formatMemoryStatusSubtitle } from "@/lib/memory-due-label";
import { isDueForLearning, isReviewPhase } from "@/lib/memory-scheduler";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { MemoryListItem } from "@/components/memory/memory-surface";
import { memoryReviewSearch } from "@/lib/memory-review-search";
import { packAllowsUnifiedRecitation } from "@/lib/contiguous-spans";
import {
  heartScopeActionLabel,
  heartScopeConfirmLabel,
  heartScopeCoverageCopy,
  heartScopeDialogTitle,
  heartScopeHintCopy,
  heartScopeTooltip,
} from "@/lib/heart-scope-copy";
import {
  autoHeartAllowed,
  countScopeChapters,
} from "@/lib/scope-chapter-count";
import {
  coveredVerseCount,
  scopeCoverageComplete,
  scopeVerseSlots,
} from "@/lib/scope-verse-coverage";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { MemoryVerseListAction } from "@/components/memory/memory-verse-list-action";
import { toPracticeVerse } from "@/components/memory/to-practice-verse";
import { VerseDetail } from "@/components/memory/verse-detail";
import { formatScopeSummary } from "@/components/study/study-scope-summary";

import { EnableUnifiedReviewDialog } from "./enable-unified-review-dialog";
import { PackVersePicker } from "./pack-verse-picker";
import { ScopeHeartPreview } from "./scope-heart-preview";
import {
  packVerseKey,
  type HeartedVerse,
  type PackableVerse,
} from "./pack-verse-types";

/**
 * A single pack: header + counts, its resolved members, and Review / Practice
 * actions that navigate to `/memory/$packId/review` and
 * `/memory/$packId/practice`. Custom packs additionally support add / remove
 * of their hand-picked membership.
 */
export function PackView({
  packId,
  heartHint = false,
}: {
  packId: Id<"packs">;
  /** After create: point at Memorize whole passage so the CTA is obvious. */
  heartHint?: boolean;
}) {
  const now = useLiveNow();
  const navigate = useNavigate();

  const pack = useQuery(api.packs.get, { id: packId });
  const members = useQuery(api.packs.resolveMembers, { id: packId, now });
  const touch = useMutation(api.packs.touch);

  const hasTouched = useRef(false);
  useEffect(() => {
    if (pack && !hasTouched.current) {
      hasTouched.current = true;
      void touch({ id: packId });
    }
  }, [pack, packId, touch]);

  const dueMembers = useMemo(
    () => (members ?? []).filter((m) => m.isDue),
    [members],
  );
  const learningDueCount = useMemo(
    () => (members ?? []).filter((m) => isDueForLearning(m, now)).length,
    [members, now],
  );
  const newCount = useMemo(
    () => (members ?? []).filter((m) => m.status === "new").length,
    [members],
  );
  const practiceCount = useMemo(
    () => (members ?? []).filter((m) => isReviewPhase(m.status)).length,
    [members],
  );

  if (pack === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pack === null) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <SearchX
            aria-hidden
            className="mx-auto h-8 w-8 text-muted-foreground/70"
          />
          <h1 className="text-base font-semibold tracking-tight">
            Pack not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This pack may have been deleted, or the link points at a pack that
            isn&apos;t yours.
          </p>
          <Link
            to="/memory"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Memory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PackViewMain
      packId={packId}
      pack={pack}
      members={members}
      now={now}
      heartHint={heartHint}
      dueCount={dueMembers.length}
      learningDueCount={learningDueCount}
      newCount={newCount}
      practiceCount={practiceCount}
      onClearHeartHint={() =>
        void navigate({
          to: "/memory/$packId",
          params: { packId },
          search: {},
          replace: true,
        })
      }
      onBack={() => void navigate({ to: "/memory" })}
      onReview={() =>
        void navigate({
          to: "/memory/$packId/review",
          params: { packId },
        })
      }
      onLearn={() =>
        void navigate({
          to: "/memory/$packId/learn",
          params: { packId },
        })
      }
      onPractice={() =>
        void navigate({
          to: "/memory/$packId/practice",
          params: { packId },
        })
      }
      onLearnVerse={(verse) =>
        void navigate({
          to: "/memory/learn",
          search: memoryLearnSearch(verse.reference),
        })
      }
      onReviewVerse={(verse) =>
        void navigate({
          to: "/memory/review",
          search: memoryReviewSearch(verse.reference),
        })
      }
      onDeleted={() => void navigate({ to: "/memory" })}
    />
  );
}

type Pack = NonNullable<FunctionReturnType<typeof api.packs.get>>;
type Member = FunctionReturnType<typeof api.packs.resolveMembers>[number];

function PackViewMain({
  packId,
  pack,
  members,
  now,
  heartHint,
  dueCount,
  learningDueCount,
  newCount,
  practiceCount,
  onClearHeartHint,
  onBack,
  onReview,
  onLearn,
  onPractice,
  onLearnVerse,
  onReviewVerse,
  onDeleted,
}: {
  packId: Id<"packs">;
  pack: Pack;
  members: Member[] | undefined;
  now: number;
  heartHint: boolean;
  dueCount: number;
  learningDueCount: number;
  newCount: number;
  practiceCount: number;
  onClearHeartHint: () => void;
  onBack: () => void;
  onReview: () => void;
  onLearn: () => void;
  onPractice: () => void;
  onLearnVerse: (verse: PracticeVerse) => void;
  onReviewVerse: (verse: PracticeVerse) => void;
  onDeleted: () => void;
}) {
  const isCustom = pack.kind === "custom";
  const verseCount = members?.length ?? 0;

  const rename = useMutation(api.packs.rename);
  const remove = useMutation(api.packs.remove);
  const addVerse = useMutation(api.packs.addVerse);
  const removeVerse = useMutation(api.packs.removeVerse);
  const enrollLearning = useMutation(api.packs.enrollLearning);
  const setUnifiedReview = useMutation(api.packs.setUnifiedReview);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(pack.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedVerseRefId, setSelectedVerseRefId] =
    useState<Id<"verseRefs"> | null>(null);
  const [pendingVerseKey, setPendingVerseKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [heartRemainingOpen, setHeartRemainingOpen] = useState(false);
  const [heartHintDismissed, setHeartHintDismissed] = useState(false);
  const [unifiedDialogOpen, setUnifiedDialogOpen] = useState(false);
  const [isSettingUnified, setIsSettingUnified] = useState(false);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);
  const [unifiedJustDisabled, setUnifiedJustDisabled] = useState(false);
  const [removingRefId, setRemovingRefId] = useState<Id<"verseRefs"> | null>(
    null,
  );

  const memberRefIds = useMemo(
    () => new Set((members ?? []).map((m) => String(m.verseRefId))),
    [members],
  );
  const memberRefKeys = useMemo(
    () => new Set((members ?? []).map((m) => packVerseKey(m))),
    [members],
  );

  const handleRename = useCallback(async () => {
    const next = renameValue.trim();
    if (next.length === 0 || next === pack.name) {
      setRenameOpen(false);
      return;
    }
    setActionError(null);
    setIsRenaming(true);
    try {
      await rename({ id: packId, name: next });
      setRenameOpen(false);
    } catch {
      setActionError("Couldn't rename the pack. Please try again.");
    } finally {
      setIsRenaming(false);
    }
  }, [renameValue, pack.name, rename, packId]);

  const handleDelete = useCallback(async () => {
    setActionError(null);
    setIsDeleting(true);
    try {
      await remove({ id: packId });
      onDeleted();
    } catch {
      setActionError("Couldn't delete the pack. Please try again.");
      setIsDeleting(false);
    }
  }, [remove, packId, onDeleted]);

  const handleAdd = useCallback(
    async (verse: PackableVerse) => {
      if (pendingVerseKey) return;
      const key = packVerseKey(verse);
      setActionError(null);
      setPendingVerseKey(key);
      try {
        await addVerse({
          id: packId,
          book: verse.book,
          chapter: verse.chapter,
          startVerse: verse.startVerse,
          endVerse: verse.endVerse,
        });
      } catch {
        setActionError("Couldn't add that verse. Please try again.");
      } finally {
        setPendingVerseKey(null);
      }
    },
    [addVerse, packId, pendingVerseKey],
  );

  // Enroll on the session clock the queues read from: a live `Date.now()` can
  // land the fresh `dueAt` far enough ahead of the frozen `now` to look like a
  // finished learning session, hiding the verses the click just queued.
  const handleLearnPack = useCallback(async () => {
    if (isEnrolling) return;
    setActionError(null);
    setIsEnrolling(true);
    try {
      await enrollLearning({ id: packId, now });
      onLearn();
    } catch {
      setActionError("Couldn't start this pack. Please try again.");
    } finally {
      setIsEnrolling(false);
    }
  }, [enrollLearning, isEnrolling, now, onLearn, packId]);

  // Same session clock as enrollLearning: the mutation pulls every member's
  // `dueAt` to this `now`, which is the clock the due queues read from.
  const handleEnableUnified = useCallback(async () => {
    if (isSettingUnified) return;
    setUnifiedError(null);
    setIsSettingUnified(true);
    try {
      await setUnifiedReview({ id: packId, enabled: true, now });
      setUnifiedJustDisabled(false);
      setUnifiedDialogOpen(false);
      // The point of confirming is to recite it, so go straight there.
      onReview();
    } catch {
      setUnifiedError("Couldn't turn this on. Please try again.");
    } finally {
      setIsSettingUnified(false);
    }
  }, [isSettingUnified, now, onReview, packId, setUnifiedReview]);

  const handleDisableUnified = useCallback(async () => {
    if (isSettingUnified) return;
    setActionError(null);
    setIsSettingUnified(true);
    try {
      await setUnifiedReview({ id: packId, enabled: false, now });
      setUnifiedJustDisabled(true);
    } catch {
      setActionError("Couldn't turn this off. Please try again.");
    } finally {
      setIsSettingUnified(false);
    }
  }, [isSettingUnified, now, packId, setUnifiedReview]);

  const handleRemove = useCallback(
    async (verseRefId: Id<"verseRefs">) => {
      setActionError(null);
      setRemovingRefId(verseRefId);
      try {
        await removeVerse({ id: packId, verseRefId });
      } catch {
        setActionError("Couldn't remove that verse. Please try again.");
      } finally {
        setRemovingRefId(null);
      }
    },
    [removeVerse, packId],
  );

  const canReview = dueCount > 0;
  const canLearn = learningDueCount > 0;
  const canPractice = practiceCount > 0;
  const canEnroll = newCount > 0;

  // Unified recitation: a scope pack whose every member has graduated. While
  // one is on, the pack counts as a single due item (matching the pack list).
  const unifiedEnabled = pack.unifiedReviewEnabled === true;
  const allGraduated = verseCount > 0 && practiceCount === verseCount;
  const effectiveDueCount = unifiedEnabled ? (dueCount > 0 ? 1 : 0) : dueCount;
  const notDueCount = verseCount - dueCount;

  // A scope pack's members are exactly the hearts inside its scope, so they
  // are also the coverage input: no extra query needed to spot the gaps.
  const scope = pack.kind === "scope" ? pack.scope : undefined;
  const memberSpans = useMemo<VerseSpan[]>(
    () =>
      (members ?? []).map(({ book, chapter, startVerse, endVerse }) => ({
        book,
        chapter,
        startVerse,
        endVerse,
      })),
    [members],
  );
  const scopeFilled =
    scope !== undefined &&
    members !== undefined &&
    scopeCoverageComplete(scope, memberSpans);
  // After Memorize whole passage (or any path that fills the scope), Add verses
  // has nothing left to heart. Custom packs keep the control; incomplete scopes
  // still use it to pick individual verses. Hide it while members are loading
  // (so a full scope doesn't flash the button) and while unified recitation is
  // on: a fresh heart would arrive as a new unit and block the recitation.
  const showAddVerses =
    isCustom || (members !== undefined && !scopeFilled && !unifiedEnabled);
  // Recite-as-one-passage is only an option for a contiguous block (or the
  // whole scope) of more than one hearted member — a single passage has
  // nothing to join. Stay visible while unified is already on so it can be
  // switched off. While the pack is still being learned, the Learn-whole-
  // passage card occupies this slot so a disabled Recite switch doesn't bury
  // the next step — including when every unit is locked until tomorrow.
  const showPackLearnBanner =
    pack.kind === "scope" &&
    scopeFilled &&
    !unifiedEnabled &&
    !allGraduated &&
    verseCount > 0;
  const showUnifiedPanel =
    pack.kind === "scope" &&
    (unifiedEnabled ||
      (verseCount > 1 &&
        allGraduated &&
        packAllowsUnifiedRecitation(memberSpans, scope)));
  // Over-cap scopes offer nothing here: create already explained the limit, and
  // a permanently disabled button on an existing pack would only be noise.
  // A unified pack also withholds the offer: fresh hearts arrive as new units,
  // and they would block the recitation this pack is currently scheduled as.
  const canHeartRemaining = useMemo(
    () =>
      !unifiedEnabled &&
      scope !== undefined &&
      members !== undefined &&
      autoHeartAllowed(scope) &&
      !scopeFilled,
    [unifiedEnabled, scope, members, scopeFilled],
  );
  const heartHintOpen = heartHint && canHeartRemaining && !heartHintDismissed;

  const dismissHeartHint = useCallback(() => {
    if (heartHintDismissed) return;
    setHeartHintDismissed(true);
    if (heartHint) onClearHeartHint();
  }, [heartHint, heartHintDismissed, onClearHeartHint]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="-ml-2 mb-1 shrink-0 gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
          </TooltipTrigger>
          <TooltipContent>Go back to Memory</TooltipContent>
        </Tooltip>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {pack.name}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isCustom ? "Custom" : "Scope"} · {verseCount} verse
              {verseCount !== 1 ? "s" : ""}
              {unifiedEnabled ? " · one recitation" : ""}
              {effectiveDueCount === 0
                ? ""
                : unifiedEnabled
                  ? " · due today"
                  : ` · ${dueCount} due`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setRenameValue(pack.name);
                setRenameOpen(true);
              }}
              aria-label="Rename pack"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete pack"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showPackLearnBanner ? null : canEnroll ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void handleLearnPack()}
              disabled={isEnrolling}
            >
              <GraduationCap className="h-4 w-4" aria-hidden />
              {isEnrolling ? "Starting\u2026" : "Learn this pack"}
              <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground tabular-nums">
                {newCount + learningDueCount}
              </span>
            </Button>
          ) : canLearn ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onLearn}
            >
              <GraduationCap className="h-4 w-4" aria-hidden />
              Continue Learning
              <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold leading-none text-muted-foreground tabular-nums">
                {learningDueCount}
              </span>
            </Button>
          ) : null}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={onReview}
            disabled={!canReview}
          >
            <Play className="h-4 w-4" aria-hidden />
            {unifiedEnabled && canReview ? "Review passage" : "Review"}
            {effectiveDueCount > 0 ? (
              <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary tabular-nums">
                {effectiveDueCount}
              </span>
            ) : null}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onPractice}
            disabled={!canPractice}
          >
            <Dumbbell className="h-4 w-4" aria-hidden />
            Practice Pack
          </Button>
        </div>
      </header>

      {actionError ? (
        <div
          role="alert"
          className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-2xl space-y-6 px-5 py-6">
          {showPackLearnBanner ? (
            <PackLearnPanel
              packName={pack.name}
              verseCount={verseCount}
              newCount={newCount}
              queueCount={
                canEnroll ? newCount + learningDueCount : learningDueCount
              }
              canEnroll={canEnroll}
              canLearn={canLearn}
              pending={isEnrolling}
              onLearn={() => (canEnroll ? void handleLearnPack() : onLearn())}
            />
          ) : showUnifiedPanel ? (
            <UnifiedReviewPanel
              packName={pack.name}
              verseCount={verseCount}
              enabled={unifiedEnabled}
              eligible={allGraduated}
              pending={isSettingUnified}
              justDisabled={unifiedJustDisabled}
              onEnable={() => {
                setUnifiedError(null);
                setUnifiedDialogOpen(true);
              }}
              onDisable={() => void handleDisableUnified()}
            />
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Verses
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {canHeartRemaining && scope ? (
                  <HeartScopeButton
                    hintOpen={heartHintOpen}
                    onHintOpenChange={(open) => {
                      if (!open) dismissHeartHint();
                    }}
                    onClick={() => {
                      dismissHeartHint();
                      setHeartRemainingOpen(true);
                    }}
                  />
                ) : null}
                {showAddVerses ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add verses
                  </Button>
                ) : null}
              </div>
            </div>

            {members === undefined ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border bg-card px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {isCustom
                    ? "No verses yet. Add a verse from your hearted list or by browsing."
                    : canHeartRemaining
                      ? "No verses yet. Memorize whole passage hearts every verse in this scope as short memory passages — or heart them in the reader and they'll appear automatically."
                      : "No verses yet. Heart verses within this scope — from here or in the reader — and they'll appear automatically."}
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {members.map((member) => {
                  const style = MEMORY_STATUS_STYLE[member.status];
                  const practiceVerse = toPracticeVerse(member);
                  return (
                    <MemoryListItem
                      key={member.verseRefId}
                      className="flex items-center gap-2 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedVerseRefId(member.verseRefId)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            style.dot,
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {formatVerseRef(member)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatMemoryStatusSubtitle({
                              status: member.status,
                              statusLabel: style.label,
                              dueAt: member.dueAt,
                              lastReviewedAt: member.lastReviewedAt,
                              now,
                            })}
                          </span>
                        </span>
                      </button>
                      <MemoryVerseListAction
                        status={member.status}
                        verse={practiceVerse}
                        now={now}
                        onLearn={onLearnVerse}
                        onReview={onReviewVerse}
                      />
                      {isCustom && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => void handleRemove(member.verseRefId)}
                          disabled={removingRefId === member.verseRefId}
                          aria-label={`Remove ${formatVerseRef(member)}`}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    </MemoryListItem>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>

      <Dialog
        open={selectedVerseRefId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedVerseRefId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verse detail</DialogTitle>
          </DialogHeader>
          {selectedVerseRefId !== null ? (
            <VerseDetail
              verseRefId={selectedVerseRefId}
              now={now}
              onLearn={(verse) => {
                setSelectedVerseRefId(null);
                onLearnVerse(verse);
              }}
              onReview={(verse) => {
                setSelectedVerseRefId(null);
                onReviewVerse(verse);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename pack</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRename();
              }
            }}
            aria-label="Pack name"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleRename()} disabled={isRenaming}>
              {isRenaming ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete pack?</DialogTitle>
            <DialogDescription>
              This removes the pack “{pack.name}”. Your hearted verses and
              memory history are kept — only the pack (and its membership) is
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting\u2026" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EnableUnifiedReviewDialog
        open={unifiedDialogOpen}
        onOpenChange={(open) => {
          setUnifiedDialogOpen(open);
          if (!open) setUnifiedError(null);
        }}
        packName={pack.name}
        verseCount={verseCount}
        notDueCount={notDueCount}
        isEnabling={isSettingUnified}
        error={unifiedError}
        onConfirm={() => void handleEnableUnified()}
      />

      {scope && canHeartRemaining ? (
        <HeartRemainingDialog
          open={heartRemainingOpen}
          onOpenChange={setHeartRemainingOpen}
          scope={scope}
          hearts={memberSpans}
          now={now}
        />
      ) : null}

      <AddVersesDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        memberRefIds={memberRefIds}
        memberRefKeys={memberRefKeys}
        pendingVerseKey={pendingVerseKey}
        scope={pack.kind === "scope" ? pack.scope : undefined}
        onAdd={handleAdd}
      />
    </div>
  );
}

function HeartScopeButton({
  hintOpen,
  onHintOpenChange,
  onClick,
}: {
  hintOpen: boolean;
  onHintOpenChange: (open: boolean) => void;
  onClick: () => void;
}) {
  const button = (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1.5"
      onClick={onClick}
    >
      <Heart className="h-3.5 w-3.5" aria-hidden />
      {heartScopeActionLabel()}
    </Button>
  );

  if (hintOpen) {
    return (
      <Popover open modal={false} onOpenChange={onHintOpenChange}>
        <PopoverTrigger asChild>{button}</PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          className="w-72 p-3 text-xs leading-5"
          role="status"
        >
          {heartScopeHintCopy()}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {heartScopeTooltip()}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * After a scope is fully hearted, the next step is learning the passage as a
 * queue — not one row at a time. This card sits in the Recite slot until every
 * unit has graduated, so a disabled Recite switch doesn't steal the click.
 */
function PackLearnPanel({
  packName,
  verseCount,
  newCount,
  queueCount,
  canEnroll,
  canLearn,
  pending,
  onLearn,
}: {
  packName: string;
  verseCount: number;
  newCount: number;
  queueCount: number;
  canEnroll: boolean;
  canLearn: boolean;
  pending: boolean;
  onLearn: () => void;
}) {
  const lockedUntilTomorrow = !canEnroll && !canLearn;
  const someStarted = newCount > 0 && newCount < verseCount;
  const description = canEnroll
    ? someStarted
      ? `Some verses are already in progress. This queues the rest so you can learn ${packName} together, in order.`
      : `Starting one verse at a time splits the passage. This queues every new unit in order so you learn ${packName} together.`
    : lockedUntilTomorrow
      ? `Today's session is done. Come back tomorrow to keep learning ${packName} together.`
      : `Continue in order so ${packName} stays together.`;
  const label = pending
    ? "Starting\u2026"
    : canEnroll
      ? "Learn whole passage"
      : lockedUntilTomorrow
        ? "Continue Learning · Tomorrow"
        : "Continue Learning";

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap aria-hidden className="h-4 w-4 text-primary" />
            Learn whole passage
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={onLearn}
          disabled={pending || lockedUntilTomorrow}
        >
          <GraduationCap className="h-4 w-4" aria-hidden />
          {label}
          {queueCount > 0 && !pending ? (
            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary tabular-nums">
              {queueCount}
            </span>
          ) : null}
        </Button>
      </div>
    </section>
  );
}

/**
 * The switch that turns a graduated scope pack into one recitation.
 *
 * A pack of short units drips its reviews out a couple at a time, which is
 * exactly the wrong shape for a passage you want to say straight through. This
 * panel names that problem in the copy and offers the one-line fix; the confirm
 * dialog handles the consequence (everything moves to today).
 */
function UnifiedReviewPanel({
  packName,
  verseCount,
  enabled,
  eligible,
  pending,
  justDisabled,
  onEnable,
  onDisable,
}: {
  packName: string;
  verseCount: number;
  enabled: boolean;
  /** Every member has graduated, so a recitation is possible. */
  eligible: boolean;
  pending: boolean;
  /** Just switched off in this session, so the fallout is worth a line. */
  justDisabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const unitLabel = `${verseCount} unit${verseCount === 1 ? "" : "s"}`;
  const description = enabled
    ? `${unitLabel} on one schedule. Review is a single card — recite ${packName} straight through, and one grade sets the next date for all of them.`
    : eligible
      ? verseCount === 1
        ? `${packName} is one unit today. Turn this on to review it as a single recitation, and anything you add later joins the same schedule.`
        : `${unitLabel}, ${verseCount} separate schedules — ${packName} comes back a piece at a time. Turn this on to review it as one recitation instead.`
      : "Finish learning this pack first — every unit has to graduate before they can share one recitation.";

  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        // Eligible-but-off is an offer, not a setting: give it a little pull.
        !enabled && eligible && "border-primary/30 bg-primary/[0.03]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ScrollText
              aria-hidden
              className={cn(
                "h-4 w-4",
                enabled ? "text-primary" : "text-muted-foreground",
              )}
            />
            Recite as one passage
            {enabled ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                On
              </span>
            ) : null}
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            {description}
          </p>
          {!enabled && justDisabled ? (
            <p className="text-xs leading-5 text-muted-foreground/80">
              Back to unit-by-unit reviews. They keep the due date they share
              now until you review them one at a time.
            </p>
          ) : null}
        </div>
        <Switch
          checked={enabled}
          disabled={pending || (!enabled && !eligible)}
          onCheckedChange={(next) => (next ? onEnable() : onDisable())}
          aria-label="Recite as one passage"
        />
      </div>
    </section>
  );
}

/**
 * Fill a scope pack's coverage gaps with the same proposal the pack builder
 * shows at create time: chips for the memory units that would be added, kept
 * hearts left exactly as they are. Confirming hearts only the proposed gaps.
 */
function HeartRemainingDialog({
  open,
  onOpenChange,
  scope,
  hearts,
  now,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: NonNullable<Pack["scope"]>;
  hearts: VerseSpan[];
  now: number;
}) {
  const heartMany = useMutation(api.savedVerses.heartMany);
  const [isHearting, setIsHearting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passage text is fetched only while the dialog is open.
  const preview = useScopeHeartPreview({ scope, hearts, enabled: open });
  const { proposedCount, proposedSpans } = preview;
  const slots = scopeVerseSlots(scope);
  const covered = coveredVerseCount(scope, hearts);
  const chapterCount = countScopeChapters(scope);

  const handleHeart = useCallback(async () => {
    if (isHearting) return;
    setError(null);
    setIsHearting(true);
    const result = await heartSpansInChunks(heartMany, proposedSpans, now);
    setIsHearting(false);
    if (result.failedChunks > 0) {
      setError("Some verses couldn't be hearted. Try again to fill the rest.");
      return;
    }
    onOpenChange(false);
  }, [heartMany, isHearting, now, onOpenChange, proposedSpans]);

  const canHeart =
    !isHearting && !preview.loading && !preview.error && proposedCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heartScopeDialogTitle()}</DialogTitle>
          <DialogDescription>
            {heartScopeCoverageCopy(covered, slots, chapterCount)}
          </DialogDescription>
        </DialogHeader>
        <ScopeHeartPreview
          scopeLabel={formatScopeSummary(scope)}
          preview={preview}
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isHearting}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleHeart()} disabled={!canHeart}>
            {isHearting
              ? "Hearting\u2026"
              : preview.loading
                ? "Preparing\u2026"
                : heartScopeConfirmLabel(proposedCount)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddVersesDialog({
  open,
  onOpenChange,
  memberRefIds,
  memberRefKeys,
  pendingVerseKey,
  scope,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberRefIds: Set<string>;
  memberRefKeys: Set<string>;
  pendingVerseKey: string | null;
  scope?: Pack["scope"];
  onAdd: (verse: PackableVerse) => void;
}) {
  // Only load hearted verses while the dialog is open — and never for scope
  // packs, whose "add" flow is purely about hearting *new* verses in the scope
  // (a hearted list would just re-list verses already in the pack).
  const savedVerses = useQuery(
    api.savedVerses.listAll,
    open && !scope ? {} : "skip",
  );
  const heartedVerses = useMemo<HeartedVerse[]>(
    () =>
      (savedVerses ?? []).map((v) => ({
        verseRefId: v.verseRefId,
        book: v.book,
        chapter: v.chapter,
        startVerse: v.startVerse,
        endVerse: v.endVerse,
        memory: v.memory
          ? {
              status: v.memory.status,
              dueAt: v.memory.dueAt,
              lastReviewedAt: v.memory.lastReviewedAt,
            }
          : undefined,
      })),
    [savedVerses],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {scope ? "Heart verses in scope" : "Add verses"}
          </DialogTitle>
          <DialogDescription>
            {scope
              ? "Browse within this pack's scope. Verses you heart here join the pack automatically."
              : "Pick from hearted verses or browse. Added verses are hearted for Memory."}
          </DialogDescription>
        </DialogHeader>
        <PackVersePicker
          heartedVerses={heartedVerses}
          isLoadingHearted={open && !scope && savedVerses === undefined}
          scope={scope}
          isSelected={(verse) =>
            (verse.verseRefId !== undefined &&
              memberRefIds.has(String(verse.verseRefId))) ||
            memberRefKeys.has(packVerseKey(verse))
          }
          isDisabled={(verse) =>
            (verse.verseRefId !== undefined &&
              memberRefIds.has(String(verse.verseRefId))) ||
            memberRefKeys.has(packVerseKey(verse))
          }
          isPending={(verse) => pendingVerseKey === packVerseKey(verse)}
          onSelect={onAdd}
        />
      </DialogContent>
    </Dialog>
  );
}
