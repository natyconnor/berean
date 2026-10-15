import { useId, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";
import {
  BookOpen,
  Brain,
  Clock,
  GraduationCap,
  Heart,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { AddToPack } from "@/components/memory/packs/add-to-pack";
import {
  useFeatureHint,
  useMarkHintShownWhenPending,
} from "@/components/tutorial/use-feature-hint";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  useJoinMemorizePack,
  type MemorizePackChoice,
} from "@/hooks/use-join-memorize-pack";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  memorizeStartHref,
  overlapErrorMessage,
  overlapsMessage,
  useMemorizeStart,
  type MemorizeDestination,
  type MemorizeStatus,
} from "@/hooks/use-memorize-start";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { carriedOverSheetLine } from "@/lib/carried-over-copy";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import {
  estimateMasteryDays,
  estimateMemorizeDays,
  estimateSessionMinutes,
  formatLearnDuration,
  formatMasteryDuration,
  nextStepCopy,
  type MemorizeMode,
  type MemorizeSize,
} from "@/lib/memorize-plan";
import {
  isUnstartedProgress,
  MEMORIZE_MAX_PACK_SPANS,
} from "@/lib/memorize-status";
import {
  memorizeTargetSpans,
  resolveMemorizeTarget,
  type MemorizeTarget,
  type ResolvedMemorize,
} from "@/lib/memorize-target";
import {
  MEMORIZE_LABEL,
  START_MEMORIZING_LABEL,
  memorizeTitleLabel,
} from "@/lib/memory-copy";
import {
  memoryPanelDrawerHref,
  memoryPanelFullPagePath,
  type MemoryPanel,
} from "@/lib/memory-panel";
import { withReturn } from "@/lib/memory-return";
import { memoryVerseSessionHref } from "@/lib/memory-session-path";
import { PACK_ACTIVE_LEARNING_CAP } from "@/lib/pack-pacing";
import { cn } from "@/lib/utils";

import { MemorizeExplainer } from "./memorize-explainer";
import { MemorizePackChoiceRow } from "./memorize-pack-choice";

type Layout = "sheet" | "dialog";

type PlannedMemorize = Exclude<ResolvedMemorize, { mode: "invalid" }>;

const HOW_IT_WORKS: Record<MemorizeMode, string> = {
  passage:
    "You'll learn it in order, a few verses a day, then say it all the way through.",
  verse:
    "Three short daily steps, then we'll bring it back right before you'd forget it.",
  pack: "Each verse takes three short daily steps. We'll keep them all fresh for you.",
};

const START_FAILED = "Couldn't start memorizing. Try again.";
const AS_ONE_CARD = "It's short, so you'll learn it all together.";
const TOO_MANY_CHAPTERS = "Pick up to 20 chapters to memorize as one passage.";
const TOO_MANY_VERSES = `Pick up to ${MEMORIZE_MAX_PACK_SPANS} verses to memorize together.`;
const NOTHING_TO_MEMORIZE = "There's nothing here to memorize.";
const CROSS_BOOK = "A passage has to stay within one book.";

/** `packs.createAndMemorize` rejects longer names. */
const PACK_NAME_MAX_LENGTH = 80;

const TODAY_PATH = "/memory";

/** A drawer only when already on Today; anywhere else, the full page. */
function openHref(destination: MemorizeDestination, pathname: string): string {
  const panel: MemoryPanel =
    destination.kind === "verse"
      ? { kind: "verse", verseRefId: destination.verseRefId }
      : { kind: "pack", packId: destination.packId };
  return pathname === TODAY_PATH
    ? memoryPanelDrawerHref(panel)
    : memoryPanelFullPagePath(panel);
}

function invalidMessage(
  resolved: Extract<ResolvedMemorize, { mode: "invalid" }>,
  target: MemorizeTarget,
): string {
  switch (resolved.reason) {
    case "tooLong":
      return target.kind === "spans" &&
        target.spans.length > MEMORIZE_MAX_PACK_SPANS
        ? TOO_MANY_VERSES
        : TOO_MANY_CHAPTERS;
    case "crossBook":
      return CROSS_BOOK;
    case "empty":
      return NOTHING_TO_MEMORIZE;
  }
}

/**
 * The facts on the plan. Learning time and mastery time stay separate. A pack
 * paces by card, so its learn time counts cards rather than verses.
 */
/** The first verse of what's being memorized, for the explainer's samples. */
function explainerSample(resolved: PlannedMemorize) {
  switch (resolved.mode) {
    case "verse":
      return resolved.span;
    case "pack":
      return resolved.spans[0];
    case "passage": {
      const verse = resolved.range?.startVerse ?? 1;
      return {
        book: resolved.book,
        chapter: resolved.startChapter,
        startVerse: verse,
        endVerse: verse,
      };
    }
  }
}

function planFacts(resolved: PlannedMemorize) {
  const cards =
    resolved.mode === "pack" ? resolved.spans.length : resolved.verseCount;
  const size: MemorizeSize = { mode: resolved.mode, verseCount: cards };
  const minutes = estimateSessionMinutes(
    resolved.mode === "passage"
      ? { learningVerses: 0, reviewVerses: 0, passageSessions: 1 }
      : {
          learningVerses:
            resolved.mode === "pack"
              ? Math.min(cards, PACK_ACTIVE_LEARNING_CAP)
              : 1,
          reviewVerses: 0,
          passageSessions: 0,
        },
  );
  return {
    verses: resolved.verseCount === 1 ? null : `${resolved.verseCount} verses`,
    learn: formatLearnDuration(estimateMemorizeDays(size)),
    minutes: `About ${minutes} min a day`,
    mastery: formatMasteryDuration(estimateMasteryDays(size)),
  };
}

/**
 * The Memorize sheet: an honest plan for a target and one tap to start it.
 * A centered dialog from 640px up, a bottom sheet below. Opened through
 * `useMemorizeSheet().open(target)`; the provider renders the one instance.
 */
export function MemorizeSheet({
  target,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  target: MemorizeTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Return focus to the opener; Radix only does so for its own trigger. */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const isMobile = useIsMobile();
  if (!target) return null;

  const close = () => onOpenChange(false);

  // `data-passage-dismiss-exempt`: opened from a reader selection, clicks in
  // the sheet must not clear that selection behind it.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          onCloseAutoFocus={onCloseAutoFocus}
          data-passage-dismiss-exempt
        >
          <MemorizePanel target={target} layout="sheet" onClose={close} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[580px]"
        onCloseAutoFocus={onCloseAutoFocus}
        data-passage-dismiss-exempt
      >
        <MemorizePanel target={target} layout="dialog" onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function MemorizePanel({
  target,
  layout,
  onClose,
}: {
  target: MemorizeTarget;
  layout: Layout;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { pathname, searchStr } = useLocation();
  const now = useLiveNow();
  const nameId = useId();

  const resolved = useMemo(() => resolveMemorizeTarget(target), [target]);
  const spans = useMemo(() => memorizeTargetSpans(resolved), [resolved]);
  const liveStatus = useQuery(
    api.verseMemory.memorizeStatus,
    spans.length > 0 ? { spans } : "skip",
  );

  // Held from the Start tap so the plan doesn't swap to "You're memorizing"
  // while the sheet animates closed.
  const [frozen, setFrozen] = useState<{
    status: MemorizeStatus;
    showExplainer: boolean;
  } | null>(null);
  const status = frozen ? frozen.status : liveStatus;
  // Only a new passage is blocked by one it overlaps; verses and packs may
  // share verses with passages.
  const state =
    status?.state === "overlaps" && resolved.mode !== "passage"
      ? "none"
      : (status?.state ?? "none");

  const verseDestination =
    state === "memorizing" && status?.destination?.kind === "verse"
      ? status.destination
      : null;
  const inMemory = useQuery(
    api.verseMemory.getInMemory,
    verseDestination ? verseDestination.span : "skip",
  );

  const explainer = useFeatureHint(
    FEATURE_HINTS.MEMORIZE_EXPLAINER,
    resolved.mode !== "invalid" && state === "none",
    { useDisplayQueue: false },
  );
  useMarkHintShownWhenPending(explainer);
  const showExplainer = frozen ? frozen.showExplainer : explainer.pending;

  const [name, setName] = useState(() =>
    resolved.mode === "pack"
      ? resolved.title.slice(0, PACK_NAME_MAX_LENGTH)
      : "",
  );
  const [packChoice, setPackChoice] = useState<MemorizePackChoice | null>(null);
  const joinPack = useJoinMemorizePack();
  const { start } = useMemorizeStart();
  const { submit, pending: starting } = useSubmitLock();
  const [started, setStarted] = useState(false);

  // A session started here returns here; from Today, without an open drawer.
  const sessionReturnTo =
    pathname === TODAY_PATH ? TODAY_PATH : `${pathname}${searchStr}`;

  const openDestination = (destination: MemorizeDestination) => {
    onClose();
    void navigate({ href: openHref(destination, pathname) });
  };

  const learnNow = (span: VerseSpan) => {
    onClose();
    void navigate({
      href: withReturn(memoryVerseSessionHref("learn", span), sessionReturnTo),
    });
  };

  const handleStart = () => {
    if (resolved.mode === "invalid" || status === undefined) return;
    submit(async () => {
      setFrozen({ status, showExplainer });
      try {
        const result = await start(
          resolved,
          resolved.mode === "pack" ? { name } : undefined,
        );
        explainer.complete();
        setStarted(true);
        // Not awaited: joining the pack never holds up the session.
        if (resolved.mode === "verse" && packChoice) {
          void joinPack(resolved.span, packChoice);
        }
        if (result.alreadyMemorizing) {
          openDestination(result.destination);
          return;
        }
        onClose();
        if (result.asOneCard) toast(AS_ONE_CARD);
        void navigate({
          href: memorizeStartHref(result.destination, sessionReturnTo),
        });
      } catch (caught) {
        setFrozen(null);
        toast.error(overlapErrorMessage(caught) ?? START_FAILED);
      }
    });
  };

  if (resolved.mode === "invalid") {
    return (
      <PanelFrame
        layout={layout}
        header={
          <PanelHeading layout={layout}>
            {resolved.title
              ? memorizeTitleLabel(resolved.title)
              : MEMORIZE_LABEL}
          </PanelHeading>
        }
        body={
          <PanelDescription layout={layout}>
            {invalidMessage(resolved, target)}
          </PanelDescription>
        }
        footer={
          <FooterActions>
            <NotNowButton onClick={onClose} />
            <StartButton disabled />
          </FooterActions>
        }
      />
    );
  }

  if (state === "memorizing" && status?.destination) {
    const destination = status.destination;
    const title = status.title ?? resolved.title;
    const addToPack =
      destination.kind === "verse" ? (
        <AddToPack
          reference={destination.span}
          now={now}
          className="h-11 flex-1 sm:h-9 sm:flex-none"
        />
      ) : null;

    if (destination.kind === "verse" && isUnstartedProgress(status.progress)) {
      const upNext = status.progress === "upNext";
      const packName = status.upNextPackName;
      return (
        <PanelFrame
          layout={layout}
          header={
            <PanelHeading layout={layout}>
              {upNext
                ? `${title} is up next${packName ? ` in ${packName}` : ""}`
                : `You added ${title} but haven't started`}
            </PanelHeading>
          }
          body={
            <PanelDescription layout={layout}>
              {upNext
                ? packName
                  ? "It starts when the pack gets to it, or start it now."
                  : "Start it whenever you're ready."
                : inMemory
                  ? nextStepCopy(inMemory.memory, now)
                  : ""}
            </PanelDescription>
          }
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <div className="flex gap-2">
                {addToPack}
                <Button
                  variant="outline"
                  className="h-11 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => openDestination(destination)}
                >
                  Open
                </Button>
              </div>
              <Button
                className="h-11 sm:h-9"
                onClick={() => learnNow(destination.span)}
              >
                <GraduationCap aria-hidden />
                {upNext ? "Start now" : "Start"}
              </Button>
            </div>
          }
        />
      );
    }

    const line =
      destination.kind === "verse"
        ? inMemory
          ? nextStepCopy(inMemory.memory, now)
          : ""
        : HOW_IT_WORKS[resolved.mode];
    return (
      <PanelFrame
        layout={layout}
        header={
          <PanelHeading layout={layout}>
            You&apos;re memorizing {title}
          </PanelHeading>
        }
        body={<PanelDescription layout={layout}>{line}</PanelDescription>}
        footer={
          <FooterActions>
            {addToPack}
            <Button
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              onClick={() => openDestination(destination)}
            >
              Open
            </Button>
          </FooterActions>
        }
      />
    );
  }

  if (state === "partOf" && status?.destination) {
    const destination = status.destination;
    const container = status.title ?? "a passage";
    // A passage inside one already being memorized would make its verses due twice.
    const passageInPassage = resolved.mode === "passage";
    return (
      <PanelFrame
        layout={layout}
        header={
          <PanelHeading layout={layout}>
            {passageInPassage ? (
              <>You&apos;re memorizing {container}</>
            ) : (
              memorizeTitleLabel(resolved.title)
            )}
          </PanelHeading>
        }
        body={
          <PanelDescription layout={layout}>
            {passageInPassage ? (
              <>{resolved.title} is part of it.</>
            ) : (
              <>
                {resolved.title} is part of {container}, which you&apos;re
                memorizing.
              </>
            )}
          </PanelDescription>
        }
        footer={
          <FooterActions>
            <Button
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              onClick={() => openDestination(destination)}
            >
              {passageInPassage ? "Open" : `Open ${container}`}
            </Button>
          </FooterActions>
        }
      />
    );
  }

  if (state === "overlaps" && status?.destination) {
    const destination = status.destination;
    const overlapping = status.title ?? "a passage";
    return (
      <PanelFrame
        layout={layout}
        header={
          <PanelHeading layout={layout}>
            {memorizeTitleLabel(resolved.title)}
          </PanelHeading>
        }
        body={
          <PanelDescription layout={layout}>
            {overlapsMessage(overlapping, resolved.title)}
          </PanelDescription>
        }
        footer={
          <FooterActions>
            <Button
              variant="outline"
              className="h-11 flex-1 sm:h-9 sm:flex-none"
              onClick={() => openDestination(destination)}
            >
              Open {overlapping}
            </Button>
            <StartButton disabled />
          </FooterActions>
        }
      />
    );
  }

  const facts = planFacts(resolved);
  const showHeartLine = status !== undefined && !status.allHearted;
  const carriedOverLine =
    resolved.mode === "passage"
      ? carriedOverSheetLine(status?.carriedOver)
      : null;

  return (
    <PanelFrame
      layout={layout}
      header={
        <PanelHeading layout={layout}>
          {memorizeTitleLabel(resolved.title)}
        </PanelHeading>
      }
      body={
        <>
          <ul className="flex flex-wrap gap-1.5">
            {facts.verses ? (
              <FactChip icon={<BookOpen aria-hidden />}>
                {facts.verses}
              </FactChip>
            ) : null}
            <FactChip icon={<GraduationCap aria-hidden />}>
              {facts.learn}
            </FactChip>
            <FactChip icon={<Clock aria-hidden />}>{facts.minutes}</FactChip>
          </ul>
          <div className="space-y-1">
            <PanelDescription layout={layout} className="text-foreground">
              {HOW_IT_WORKS[resolved.mode]}
            </PanelDescription>
            <p className="text-xs text-muted-foreground">
              Then short reviews keep it fresh.{" "}
              <span className="font-semibold text-foreground">
                {facts.mastery}.
              </span>
            </p>
          </div>
          {carriedOverLine ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              {carriedOverLine}
            </p>
          ) : null}
          {showExplainer ? (
            <MemorizeExplainer
              mode={resolved.mode}
              sample={explainerSample(resolved)}
            />
          ) : null}
          {resolved.mode === "pack" ? (
            <div className="space-y-1.5">
              <label htmlFor={nameId} className="text-sm font-medium">
                Name
              </label>
              <Input
                id={nameId}
                value={name}
                maxLength={PACK_NAME_MAX_LENGTH}
                placeholder="e.g. Verses on hope"
                className="h-11 sm:h-9"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleStart();
                  }
                }}
              />
            </div>
          ) : null}
          {resolved.mode === "verse" ? (
            <MemorizePackChoiceRow
              choice={packChoice}
              onChange={setPackChoice}
              now={now}
              onSubmit={handleStart}
            />
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {showHeartLine ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:mr-auto">
              <Heart
                className="size-3.5 shrink-0 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
                aria-hidden
              />
              Also adds {resolved.title} to your hearts
            </p>
          ) : null}
          <FooterActions>
            <NotNowButton onClick={onClose} />
            <StartButton
              loading={starting}
              disabled={status === undefined || started}
              onClick={handleStart}
            />
          </FooterActions>
        </div>
      }
    />
  );
}

function PanelFrame({
  layout,
  header,
  body,
  footer,
}: {
  layout: Layout;
  header: ReactNode;
  body: ReactNode;
  footer: ReactNode;
}) {
  const eyebrow = (
    <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
      {MEMORIZE_LABEL}
    </p>
  );
  if (layout === "sheet") {
    return (
      <>
        <SheetHeader className="gap-1 pb-3">
          {eyebrow}
          {header}
        </SheetHeader>
        <SheetBody className="space-y-3">{body}</SheetBody>
        <SheetFooter>{footer}</SheetFooter>
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1 pr-6">
        {eyebrow}
        {header}
      </div>
      <div className="min-w-0 space-y-3">{body}</div>
      <div className="pt-1">{footer}</div>
    </>
  );
}

function PanelHeading({
  layout,
  children,
}: {
  layout: Layout;
  children: ReactNode;
}) {
  const className = "text-xl leading-tight font-semibold tracking-tight";
  return layout === "sheet" ? (
    <SheetTitle className={className}>{children}</SheetTitle>
  ) : (
    <DialogTitle className={className}>{children}</DialogTitle>
  );
}

function PanelDescription({
  layout,
  className,
  children,
}: {
  layout: Layout;
  className?: string;
  children: ReactNode;
}) {
  const classes = cn("text-sm", className);
  return layout === "sheet" ? (
    <SheetDescription className={classes}>{children}</SheetDescription>
  ) : (
    <DialogDescription className={classes}>{children}</DialogDescription>
  );
}

function FactChip({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium [&>svg]:size-3.5 [&>svg]:text-muted-foreground">
      {icon}
      {children}
    </li>
  );
}

function FooterActions({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 sm:ml-auto sm:justify-end">{children}</div>;
}

function NotNowButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      className="h-11 flex-1 sm:h-9 sm:flex-none"
      onClick={onClick}
    >
      Not now
    </Button>
  );
}

function StartButton({
  loading,
  disabled,
  onClick,
}: {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      className="h-11 flex-[2] sm:h-9 sm:flex-none"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
    >
      <Brain aria-hidden />
      {START_MEMORIZING_LABEL}
    </Button>
  );
}
