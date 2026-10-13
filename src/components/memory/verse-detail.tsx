import {
  useId,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Brain,
  CircleStop,
  Dumbbell,
  GraduationCap,
  MoreHorizontal,
  Play,
} from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLiveNow } from "@/hooks/use-live-now";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { formatAccuracyPercent, hoverIndexFromX } from "@/lib/accuracy-trend";
import {
  memorizeTitleLabel,
  statusLabel,
  stepShortLabel,
} from "@/lib/memory-copy";
import { withReturn } from "@/lib/memory-return";
import {
  isDueForReview,
  isLearningLocked,
  isReviewPhase,
  MAX_LEARN_STAGE,
} from "@/lib/memory-scheduler";
import {
  memoryVerseSessionHref,
  type MemorySessionKind,
} from "@/lib/memory-session-path";
import { nextStepCopy } from "@/lib/memorize-plan";
import { cn } from "@/lib/utils";
import { howItsGoing, verseDetailFacts } from "@/lib/verse-detail-copy";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import { linePath, scaleLinear } from "./dashboard/svg-chart-helpers";
import { useMemoryPanelFrame } from "./drawer/memory-panel-context";
import { MemoryPanelFrame } from "./drawer/memory-panel-frame";
import { InternalLink } from "./internal-link";
import { useMemorizeSheet } from "./memorize/memorize-context";
import { AddToPack } from "./packs/add-to-pack";
import { LearningJourneyBar } from "./practice/learning-journey-bar";

export type VerseDetailData = NonNullable<
  FunctionReturnType<typeof api.verseMemory.verseDetail>
>;

const STEP_LABELS = Array.from({ length: MAX_LEARN_STAGE + 1 }, (_, stage) =>
  stepShortLabel(stage),
);

const SPARK_W = 280;
const SPARK_H = 56;
const SPARK_PAD = 6;

const sectionHeadingClassName =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

function verseSubtitle(detail: VerseDetailData): string {
  return detail.inMemory
    ? `Verse · ${statusLabel(detail.status)}`
    : "Verse · Not memorizing";
}

function VerseDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading verse">
      <div className="flex gap-2" aria-hidden>
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-hidden>
        {[0, 1].map((key) => (
          <div key={key} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="space-y-2" aria-hidden>
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-56 max-w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/**
 * One verse in a drawer or on its full page: the reference as the title, a ⋯
 * menu with Stop memorizing, and {@link VerseDetailBody}.
 */
export function VerseDetailPanel({
  verseRefId,
}: {
  verseRefId: Id<"verseRefs">;
}) {
  const now = useLiveNow();
  const frame = useMemoryPanelFrame();
  const detail = useQuery(api.verseMemory.verseDetail, { verseRefId, now });

  if (detail === undefined) {
    return (
      <MemoryPanelFrame
        title={
          <>
            <span
              aria-hidden
              className="inline-block h-6 w-36 animate-pulse rounded bg-muted align-middle"
            />
            <span className="sr-only">Loading verse</span>
          </>
        }
      >
        <VerseDetailSkeleton />
      </MemoryPanelFrame>
    );
  }

  if (detail === null) {
    return (
      <MemoryPanelFrame title="Verse not found">
        <p className="py-6 text-sm text-muted-foreground">
          This verse isn&apos;t in your Memory. It may have been removed.
        </p>
      </MemoryPanelFrame>
    );
  }

  const reference = formatVerseRef(detail);
  return (
    <MemoryPanelFrame
      title={reference}
      subtitle={verseSubtitle(detail)}
      actions={
        detail.inMemory ? (
          <StopMemorizingMenu
            verseRefId={verseRefId}
            reference={reference}
            onStopped={frame.exit}
          />
        ) : undefined
      }
    >
      <VerseDetailBody detail={detail} now={now} returnTo={frame.returnTo} />
    </MemoryPanelFrame>
  );
}

/** The verse body without a frame, for dialogs. */
export function VerseDetail({
  verseRefId,
  returnTo,
}: {
  verseRefId: Id<"verseRefs">;
  /** Where sessions started here return. */
  returnTo: string;
}) {
  const now = useLiveNow();
  const detail = useQuery(api.verseMemory.verseDetail, { verseRefId, now });

  if (detail === undefined) return <VerseDetailSkeleton />;
  if (detail === null) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        This verse isn&apos;t in your Memory.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight">
          {formatVerseRef(detail)}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {verseSubtitle(detail)}
        </p>
      </div>
      <VerseDetailBody detail={detail} now={now} returnTo={returnTo} />
    </div>
  );
}

/**
 * Plain facts about one verse: Learn / Review / Practice and Add to pack,
 * when it is next up, its steps, and how recent practice has gone.
 */
export function VerseDetailBody({
  detail,
  now,
  returnTo,
  timeZone = getViewerTimeZone(),
}: {
  detail: VerseDetailData;
  now: number;
  returnTo: string;
  timeZone?: string;
}) {
  const stepsId = useId();
  const goingId = useId();
  const reference = {
    book: detail.book,
    chapter: detail.chapter,
    startVerse: detail.startVerse,
    endVerse: detail.endVerse,
  };

  if (!detail.inMemory) {
    return <NotMemorizing reference={reference} />;
  }

  const reviewPhase = isReviewPhase(detail.status);
  const facts = verseDetailFacts(detail, now, timeZone);
  const going = howItsGoing(detail.attempts.map((attempt) => attempt.accuracy));
  const sessionHref = (kind: MemorySessionKind) =>
    withReturn(memoryVerseSessionHref(kind, reference), returnTo);

  let actions: ReactNode = null;
  if (reviewPhase && isDueForReview(detail, now)) {
    actions = (
      <>
        <Button asChild size="sm" className="max-sm:h-11">
          <InternalLink href={sessionHref("review")}>
            <Play aria-hidden />
            Review
          </InternalLink>
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="text-muted-foreground max-sm:h-11"
        >
          <InternalLink href={sessionHref("practice")}>
            <Dumbbell aria-hidden />
            Practice
          </InternalLink>
        </Button>
      </>
    );
  } else if (reviewPhase) {
    actions = (
      <Button asChild size="sm" variant="outline" className="max-sm:h-11">
        <InternalLink href={sessionHref("practice")}>
          <Dumbbell aria-hidden />
          Practice
        </InternalLink>
      </Button>
    );
  } else if (!isLearningLocked(detail, now)) {
    actions = (
      <Button asChild size="sm" className="max-sm:h-11">
        <InternalLink href={sessionHref("learn")}>
          <GraduationCap aria-hidden />
          Learn
        </InternalLink>
      </Button>
    );
  }

  const stepsLine = !reviewPhase
    ? nextStepCopy(
        {
          status: detail.status,
          learnStage: detail.learnStage,
          dueAt: detail.dueAt,
          lastReviewedAt: detail.lastReviewedAt,
        },
        now,
        timeZone,
      )
    : detail.status === "mastered"
      ? "All steps done, and it's mastered."
      : "All steps done. Short reviews keep it fresh.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <AddToPack reference={reference} now={now} returnTo={returnTo} />
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-lg border bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby={stepsId} className="space-y-2">
        <h3 id={stepsId} className={sectionHeadingClassName}>
          Your steps
        </h3>
        <ol className="grid grid-cols-4 gap-1.5">
          {STEP_LABELS.map((label, stage) => {
            const reached = reviewPhase || detail.learnStage >= stage;
            const current = !reviewPhase && detail.learnStage === stage;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className="flex min-w-0 flex-col gap-1"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-full rounded-full",
                    reached ? "bg-primary" : "bg-muted",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] leading-tight",
                    current
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        {reviewPhase ? (
          <LearningJourneyBar
            learnStage={detail.learnStage}
            stageReps={detail.stageReps}
            status={detail.status}
            intervalDays={detail.intervalDays}
          />
        ) : null}
        <p className="text-sm text-muted-foreground">{stepsLine}</p>
      </section>

      <section aria-labelledby={goingId} className="space-y-2">
        <h3 id={goingId} className={sectionHeadingClassName}>
          How it&apos;s going
        </h3>
        {going === null ? (
          <p className="text-sm text-muted-foreground">
            This fills in after you practice it.
          </p>
        ) : (
          <p className="text-sm">
            <span className="font-semibold">{going.label}</span>
            <span className="text-muted-foreground">
              {" "}
              · {Math.round(going.averageAccuracy)}% accurate over your last{" "}
              {going.attempts === 1 ? "try" : `${going.attempts} tries`}
            </span>
          </p>
        )}
        <AccuracySparkline
          attemptsNewestFirst={detail.attempts}
          timeZone={timeZone}
        />
      </section>
    </div>
  );
}

function NotMemorizing({
  reference,
}: {
  reference: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  };
}) {
  const memorizeSheet = useMemorizeSheet();
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">
        You&apos;re not memorizing this right now. Your past progress is kept.
      </p>
      <Button
        type="button"
        size="sm"
        className="max-sm:h-11"
        onClick={() =>
          memorizeSheet.open({ kind: "spans", spans: [reference] })
        }
      >
        <Brain aria-hidden />
        {memorizeTitleLabel(formatVerseRef(reference))}
      </Button>
    </div>
  );
}

type SparkAttempt = Pick<
  VerseDetailData["attempts"][number],
  "accuracy" | "createdAt"
>;

const sparkY = (pct: number) =>
  scaleLinear(pct, 0, 100, SPARK_H - SPARK_PAD, SPARK_PAD);

function formatAttemptDay(createdAt: number, timeZone: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
}

/** Keeps the tooltip inside the chart near its edges. */
function sparkTooltipTranslateX(x: number): string {
  if (x < 48) return "0%";
  if (x > SPARK_W - 48) return "-100%";
  return "-50%";
}

/**
 * Accuracy per try, oldest to newest. Hover, or focus and use the arrow
 * keys, to see one try's accuracy and day.
 */
function AccuracySparkline({
  attemptsNewestFirst,
  timeZone,
}: {
  attemptsNewestFirst: readonly SparkAttempt[];
  timeZone: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const tooltipId = useId();
  if (attemptsNewestFirst.length < 2) return null;

  const chronological = [...attemptsNewestFirst].reverse();
  const last = chronological.length - 1;
  const points = chronological.map((attempt, i) => ({
    x: scaleLinear(i, 0, last, SPARK_PAD, SPARK_W - SPARK_PAD),
    y: sparkY(attempt.accuracy),
  }));
  const activeAttempt = active === null ? undefined : chronological[active];
  const activePoint = active === null ? undefined : points[active];
  const activeCopy = activeAttempt
    ? {
        accuracy: formatAccuracyPercent(activeAttempt.accuracy),
        day: formatAttemptDay(activeAttempt.createdAt, timeZone),
      }
    : null;

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * SPARK_W;
    setActive(
      hoverIndexFromX(
        x - SPARK_PAD,
        chronological.length,
        SPARK_W - 2 * SPARK_PAD,
      ),
    );
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const current = active ?? last;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, current - 1)
        : event.key === "ArrowRight"
          ? Math.min(last, current + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  return (
    <div className="relative">
      <svg
        role="img"
        tabIndex={0}
        aria-label={`Accuracy across the last ${points.length} tries. Use the arrow keys to step through them.`}
        aria-describedby={activeCopy ? tooltipId : undefined}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
        className="block h-14 w-full cursor-crosshair rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => {
          setFocused(true);
          setActive((current) => current ?? last);
        }}
        onBlur={() => {
          setFocused(false);
          setActive(null);
        }}
        onKeyDown={onKeyDown}
      >
        <rect x={0} y={0} width={SPARK_W} height={SPARK_H} fill="transparent" />
        {[0, 50, 100].map((pct) => (
          <line
            key={pct}
            x1={0}
            y1={sparkY(pct)}
            x2={SPARK_W}
            y2={sparkY(pct)}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray={pct === 50 ? "3 3" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={linePath(points)}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {activePoint ? (
          <line
            x1={activePoint.x}
            y1={SPARK_PAD}
            x2={activePoint.x}
            y2={SPARK_H - SPARK_PAD}
            stroke="var(--chart-1)"
            strokeWidth={1}
            strokeOpacity={0.45}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {activePoint && activeCopy ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-card"
            style={{
              left: `${(activePoint.x / SPARK_W) * 100}%`,
              top: `${(activePoint.y / SPARK_H) * 100}%`,
            }}
          />
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute z-20 -mt-2 w-max rounded-md bg-foreground px-3 py-1.5 text-xs text-background tabular-nums"
            style={{
              left: `${(activePoint.x / SPARK_W) * 100}%`,
              top: `${(activePoint.y / SPARK_H) * 100}%`,
              transform: `translateX(${sparkTooltipTranslateX(activePoint.x)}) translateY(-100%)`,
            }}
          >
            <div className="font-medium">{activeCopy.accuracy}</div>
            <div className="text-background/70">{activeCopy.day}</div>
          </div>
        </>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {focused && activeCopy
          ? `${activeCopy.accuracy}, ${activeCopy.day}`
          : ""}
      </p>
    </div>
  );
}

function StopMemorizingMenu({
  verseRefId,
  reference,
  onStopped,
}: {
  verseRefId: Id<"verseRefs">;
  reference: string;
  onStopped: () => void;
}) {
  const stopMemorizing = useMutation(api.verseMemory.stopMemorizing);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { submit, pending } = useSubmitLock();

  const handleStop = () =>
    submit(async () => {
      try {
        await stopMemorizing({ verseRefId, now: Date.now() });
        setConfirmOpen(false);
        toast.success(`Stopped memorizing ${reference}.`);
        onStopped();
      } catch {
        toast.error("Couldn't stop memorizing. Please try again.");
      }
    });

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground sm:size-8"
            aria-label="More actions"
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <CircleStop aria-hidden />
            Stop memorizing
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Stop memorizing {reference}?</DialogTitle>
            <DialogDescription>
              Your progress is saved if you start again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Keep
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              onClick={handleStop}
            >
              Stop memorizing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
