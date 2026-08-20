import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Loader2, Search } from "lucide-react";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import { MemoryListRow } from "@/components/memory/memory-surface";
import { formatMemoryStatusSubtitle } from "@/lib/memory-due-label";
import { LearnVerseDialog } from "./learn-verse-dialog";
import { MemoryVerseListAction } from "./memory-verse-list-action";
import type { PracticeVerse } from "./practice/practice-board";
import { toPracticeVerse } from "./to-practice-verse";
import { VerseDetail } from "./verse-detail";

type LibraryView = "due" | "inMemory" | "notStarted";

const VIEWS: Array<{ key: LibraryView; label: string }> = [
  { key: "due", label: "Due" },
  { key: "inMemory", label: "In memory" },
  { key: "notStarted", label: "Not started" },
];

const EMPTY_COPY: Record<LibraryView, string> = {
  due: "Nothing due right now.",
  inMemory: "Start learning a verse to see it here.",
  notStarted: "No unstarted hearted verses.",
};

const INITIAL_PAGE_SIZE = 20;
/** New rows share the dueAt index and are skipped in-page; a larger first page
 *  cuts round-trips when many hearted New verses sit inside `dueAt <= now`. */
const DUE_INITIAL_PAGE_SIZE = 40;
const LOAD_MORE_PAGE_SIZE = 20;

/**
 * The Library: hearted verses in Due / In memory / Not started views,
 * paginated (`usePaginatedQuery` over `verseMemory.listLibrary`), with a
 * drill-down dialog.
 *
 * Search is an in-view filter of already-loaded pages (it does not fetch
 * unloaded pages) — a documented v1 limitation.
 */
export function MemoryLibrary({
  now,
  onLearnVerse,
  onReviewVerse,
}: {
  now: number;
  /** Start a Learning session scoped to one library verse. */
  onLearnVerse: (verse: PracticeVerse) => void;
  /** Start a review session scoped to one library verse. */
  onReviewVerse: (verse: PracticeVerse) => void;
}) {
  const [view, setView] = useState<LibraryView>("due");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Id<"verseRefs"> | null>(null);
  const [learnOpen, setLearnOpen] = useState(false);

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
  // (Due/In memory skip New or un-hearted rows in-page). Auto-advance past
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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Library
          </h2>
          <LearnVerseTrigger onClick={() => setLearnOpen(true)} />
        </div>
        <div className="flex items-center gap-1">
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

      {isLoadingFirstPage && !isSwitchingView ? (
        <div className="flex min-h-[16rem] items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !hasResults && !isSwitchingView && isExhausted ? (
        // Genuinely empty: the query is exhausted and no rows loaded anywhere.
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">{EMPTY_COPY[view]}</p>
          {view === "due" ? (
            <div className="mt-4">
              <LearnVerseTrigger onClick={() => setLearnOpen(true)} />
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
          <ul
            className={cn(
              "space-y-1.5 transition-opacity",
              isSwitchingView && "pointer-events-none opacity-50",
            )}
            aria-busy={isSwitchingView}
          >
            {filtered.map((row) => {
              const style = MEMORY_STATUS_STYLE[row.status];
              const practiceVerse = toPracticeVerse(row);
              return (
                <li key={row.verseMemoryId}>
                  <MemoryListRow className="flex items-center gap-3 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setSelected(row.verseRefId)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                          {formatVerseRef(row)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatMemoryStatusSubtitle({
                            status: row.status,
                            statusLabel: style.label,
                            dueAt: row.dueAt,
                            lastReviewedAt: row.lastReviewedAt,
                            now,
                          })}
                        </span>
                      </span>
                    </button>
                    <MemoryVerseListAction
                      status={row.status}
                      verse={practiceVerse}
                      now={now}
                      onLearn={onLearnVerse}
                      onReview={onReviewVerse}
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
        now={now}
        onLearnVerse={(verse) => {
          setLearnOpen(false);
          onLearnVerse(verse);
        }}
        onReviewVerse={(verse) => {
          setLearnOpen(false);
          onReviewVerse(verse);
        }}
      />

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verse detail</DialogTitle>
          </DialogHeader>
          {selected !== null ? (
            <VerseDetail
              verseRefId={selected}
              now={now}
              onLearn={(verse) => {
                setSelected(null);
                onLearnVerse(verse);
              }}
              onReview={(verse) => {
                setSelected(null);
                onReviewVerse(verse);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LearnVerseTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 shrink-0 gap-1 px-2.5 text-xs"
      onClick={onClick}
    >
      <GraduationCap className="h-3.5 w-3.5" aria-hidden />
      Learn a new verse
    </Button>
  );
}
