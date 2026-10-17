import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Check, Loader2, Play, Search } from "lucide-react";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTodayModel } from "@/hooks/use-today-model";
import { cn } from "@/lib/utils";
import { formatVerseRef, formatVerseRefTitle } from "@/lib/verse-ref-utils";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { MemoryListRow } from "@/components/memory/memory-surface";
import { TODAY_LABEL } from "@/lib/memory-copy";
import { libraryEmptyCopy, type LibraryView } from "@/lib/memory-empty-states";
import { dueTodayBulkLabel, libraryRow } from "@/lib/memory-library-row";
import { formatNextReviewDay, todayDoneLine } from "@/lib/memory-today";
import { withReturn } from "@/lib/memory-return";
import type { MemoryStatus } from "@/lib/memory-scheduler";
import { memoryTodaySessionHref } from "@/lib/memory-session-path";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import { GoalKindIcon } from "./today/goal-kind-icon";
import { InternalLink } from "./internal-link";
import { LearnVerseDialog } from "./learn-verse-dialog";
import { useMemorizeSheet } from "./memorize/memorize-context";
import { MemoryVerseListAction } from "./memory-verse-list-action";
import type { PracticeVerse } from "./practice/practice-board";
import { toPracticeVerse } from "./to-practice-verse";

const VIEWS: Array<{ key: LibraryView; label: string }> = [
  { key: "all", label: "All" },
  { key: "due", label: "Due today" },
  { key: "learning", label: "Learning" },
  { key: "memorized", label: "Memorized" },
  { key: "mastered", label: "Mastered" },
];

const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] leading-4 font-medium whitespace-nowrap";

const INITIAL_PAGE_SIZE = 20;
/** Up-next rows share the dueAt index and are skipped in-page; a larger first
 *  page cuts round-trips when many Up-next verses sit inside `dueAt <= now`. */
const DUE_INITIAL_PAGE_SIZE = 40;
const LOAD_MORE_PAGE_SIZE = 20;

/**
 * The Library: verses in Memory in All / Due today / Learning / Memorized /
 * Mastered views, paginated (`usePaginatedQuery` over
 * `verseMemory.listLibrary`). A row shows its status, next step and packs,
 * and opens that verse's detail. Rows go two across in a wide `@container`.
 *
 * Search is an in-view filter of already-loaded pages (it does not fetch
 * unloaded pages) — a documented v1 limitation.
 */
export function MemoryLibrary({
  now,
  returnTo,
  search: searchProp,
  onOpenVerse,
  onLearnVerse,
  onReviewVerse,
  onPracticeVerse,
}: {
  now: number;
  /** Where the Due today session comes back to. */
  returnTo: string;
  /** A search kept outside the Library; it then shows no filter of its own. */
  search?: string;
  /** Show one verse's detail (its drawer over Today, or its page). */
  onOpenVerse: (verseRefId: Id<"verseRefs">) => void;
  /** Start a Learning session scoped to one library verse. */
  onLearnVerse: (verse: PracticeVerse) => void;
  /** Start a review session scoped to one library verse. */
  onReviewVerse: (verse: PracticeVerse) => void;
  /** Extra recall for a graduated verse that is not due yet. */
  onPracticeVerse: (verse: PracticeVerse) => void;
}) {
  const [view, setView] = useState<LibraryView>("all");
  const [ownSearch, setSearch] = useState("");
  const search = searchProp ?? ownSearch;
  const [learnOpen, setLearnOpen] = useState(false);
  const learnOpenerRef = useRef<HTMLButtonElement | null>(null);
  const memorizeSheet = useMemorizeSheet();
  const timeZone = getViewerTimeZone();
  const openLearnPicker = (opener: HTMLButtonElement) => {
    learnOpenerRef.current = opener;
    setLearnOpen(true);
  };

  const { results, status, loadMore } = usePaginatedQuery(
    api.verseMemory.listLibrary,
    view === "due" ? { view, now } : { view },
    {
      initialNumItems:
        view === "due" ? DUE_INITIAL_PAGE_SIZE : INITIAL_PAGE_SIZE,
    },
  );

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const canLoadMore = status === "CanLoadMore";
  const isExhausted = status === "Exhausted";
  const hasResults = results.length > 0;

  // Keep the last non-empty page for the active view so a tab switch (or brief
  // re-fetch) fades over the existing list instead of collapsing to a spinner.
  // Cached pages return instantly; only a never-seen view truly reloads.
  // Adjusting state during render when the source list changes is the React-
  // documented pattern for this (not an effect).
  const [heldPage, setHeldPage] = useState<{
    view: LibraryView;
    results: typeof results;
  } | null>(null);
  if (hasResults && (heldPage?.results !== results || heldPage.view !== view)) {
    setHeldPage({ view, results });
  }
  const isSwitchingView =
    isLoadingFirstPage && heldPage !== null && heldPage.view !== view;
  const displayResults = isSwitchingView ? heldPage.results : results;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return displayResults;
    return displayResults.filter((row) =>
      formatVerseRef(row).toLowerCase().includes(q),
    );
  }, [displayResults, search]);

  // `listLibrary` can legitimately return an empty page while more pages exist
  // (Due skips Up-next rows in-page). Auto-advance past
  // such empty slices so a user with matching verses isn't stuck on a false
  // empty state with nothing to click.
  useEffect(() => {
    if (canLoadMore && !hasResults) {
      loadMore(LOAD_MORE_PAGE_SIZE);
    }
  }, [canLoadMore, hasResults, loadMore]);

  // A single Load-more affordance, reachable regardless of whether the latest
  // page happened to filter to empty. Renders while more pages remain.
  const loadMoreControl =
    canLoadMore || isLoadingMore ? (
      <div className="mt-3 flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadMore(LOAD_MORE_PAGE_SIZE)}
          disabled={!canLoadMore}
        >
          {isLoadingMore ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Loading…
            </>
          ) : (
            "Load more"
          )}
        </Button>
      </div>
    ) : null;

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Library
          </h2>
          <LearnVerseTrigger onClick={openLearnPicker} />
        </div>
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Filter verses"
        >
          {VIEWS.map((tab) => (
            <Button
              key={tab.key}
              variant={view === tab.key ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setView(tab.key)}
              aria-pressed={view === tab.key}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {searchProp === undefined ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter this list…"
            className="h-9 pl-8"
            aria-label="Filter this list by reference"
          />
        </div>
      ) : null}

      {isLoadingFirstPage && !isSwitchingView ? (
        <div className="flex min-h-[16rem] items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !hasResults && !isSwitchingView && isExhausted && view === "due" ? (
        <DueCaughtUp
          now={now}
          timeZone={timeZone}
          onShowAll={() => setView("all")}
        />
      ) : !hasResults && !isSwitchingView && isExhausted ? (
        // Genuinely empty: the query is exhausted and no rows loaded anywhere.
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {libraryEmptyCopy(view)}
          </p>
          {view === "learning" ? (
            <div className="mt-4">
              <LearnVerseTrigger onClick={openLearnPicker} />
            </div>
          ) : null}
        </div>
      ) : !hasResults && !isSwitchingView ? (
        // Empty page(s) so far but more remain — auto-loading; keep Load more
        // reachable as a fallback so the user is never stuck.
        <div className="flex flex-col items-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          {loadMoreControl}
        </div>
      ) : filtered.length === 0 ? (
        <>
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            No loaded verses match “{search.trim()}”.
          </p>
          {loadMoreControl}
        </>
      ) : (
        <>
          {view === "due" && !isSwitchingView ? (
            <DueTodayBulkAction now={now} returnTo={returnTo} />
          ) : null}
          <ul
            className={cn(
              "grid gap-1.5 transition-opacity @3xl:grid-cols-2",
              isSwitchingView && "pointer-events-none opacity-50",
            )}
            aria-busy={isSwitchingView}
          >
            {filtered.map((row) => {
              const practiceVerse = toPracticeVerse(row);
              const { line, dueToday } = libraryRow(row, now, timeZone);
              const [firstPack, ...morePacks] = row.packs;
              return (
                <li key={row.verseMemoryId} className="min-w-0">
                  <MemoryListRow className="flex items-center gap-3 px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenVerse(row.verseRefId)}
                      className="flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-0.5 text-left"
                    >
                      <span className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {formatVerseRefTitle(row)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <StatusChip status={row.status} />
                          {dueToday ? (
                            <span
                              className={cn(
                                CHIP_CLASS,
                                "border-primary/30 bg-primary/10 text-primary",
                              )}
                            >
                              {TODAY_LABEL}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{line}</span>
                        {firstPack ? (
                          <span className="inline-flex min-w-0 shrink items-center gap-1">
                            <span aria-hidden>·</span>
                            <GoalKindIcon
                              kind={firstPack.kind}
                              className="size-3 shrink-0"
                            />
                            <span className="sr-only">In</span>{" "}
                            <span className="truncate">{firstPack.name}</span>
                            {morePacks.length > 0 ? (
                              <>
                                {" "}
                                <span className="shrink-0">
                                  +{morePacks.length}
                                </span>
                              </>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <MemoryVerseListAction
                      status={row.status}
                      verse={practiceVerse}
                      now={now}
                      onLearn={onLearnVerse}
                      onReview={onReviewVerse}
                      onPractice={onPracticeVerse}
                    />
                  </MemoryListRow>
                </li>
              );
            })}
          </ul>
          {loadMoreControl}
        </>
      )}

      <LearnVerseDialog
        open={learnOpen}
        onOpenChange={setLearnOpen}
        onPick={(span) =>
          memorizeSheet.open(
            { kind: "spans", spans: [span] },
            { returnFocusTo: learnOpenerRef.current },
          )
        }
      />
    </section>
  );
}

function StatusChip({ status }: { status: MemoryStatus }) {
  const style = MEMORY_STATUS_STYLE[status];
  return (
    <span className={cn(CHIP_CLASS, style.text)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

/** "Do all 5 · about 9 min": everything left today in one session. */
function DueTodayBulkAction({
  now,
  returnTo,
}: {
  now: number;
  returnTo: string;
}) {
  const today = useTodayModel(now);
  const label = today ? dueTodayBulkLabel(today.counts) : null;
  if (label === null) return null;
  return (
    <Button asChild className="max-sm:h-11 max-sm:w-full">
      <InternalLink href={withReturn(memoryTodaySessionHref(), returnTo)}>
        <Play aria-hidden />
        {label}
      </InternalLink>
    </Button>
  );
}

/** Due today with nothing left: celebrate what today's work was. */
function DueCaughtUp({
  now,
  timeZone,
  onShowAll,
}: {
  now: number;
  timeZone: string;
  onShowAll: () => void;
}) {
  const today = useTodayModel(now);
  const done = today ? todayDoneLine(today.doneToday) : null;
  const when = today
    ? formatNextReviewDay(today.nextReviewAt, now, timeZone)
    : null;
  return (
    <div className="flex flex-col items-center rounded-xl border bg-card px-4 py-10 text-center">
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      >
        <Check className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold">
        {done ? "Nice work. You're all caught up." : "You're all caught up."}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {[done, when ? `Next review ${when}.` : null]
          .filter(Boolean)
          .join(" ") || libraryEmptyCopy("due")}
      </p>
      <Button variant="ghost" size="sm" className="mt-3" onClick={onShowAll}>
        Show all your verses
      </Button>
    </div>
  );
}

function LearnVerseTrigger({
  onClick,
}: {
  onClick: (opener: HTMLButtonElement) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 shrink-0 gap-1 px-2.5 text-xs"
      onClick={(event) => onClick(event.currentTarget)}
    >
      <Brain className="h-3.5 w-3.5" aria-hidden />
      Memorize a verse
    </Button>
  );
}
