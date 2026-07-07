import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { usePaginatedQuery } from "convex/react";
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
import type { MemoryStatus } from "@/lib/memory-scheduler";
import { VerseDetail } from "./verse-detail";

type LibrarySort = "dueAt" | "status" | "recent";

const SORTS: Array<{ key: LibrarySort; label: string }> = [
  { key: "dueAt", label: "Due" },
  { key: "status", label: "Status" },
  { key: "recent", label: "Recent" },
];

const STATUS_STYLES: Record<MemoryStatus, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-[var(--chart-3)]" },
  learning: { label: "Learning", dot: "bg-[var(--chart-4)]" },
  reviewing: { label: "Reviewing", dot: "bg-[var(--chart-1)]" },
  mastered: { label: "Mastered", dot: "bg-[var(--chart-2)]" },
};

const INITIAL_PAGE_SIZE = 20;
const LOAD_MORE_PAGE_SIZE = 20;

function formatDueLabel(dueAt: number, now: number): string {
  const diff = dueAt - now;
  if (diff <= 0) return "Due now";
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * The Library: every hearted verse with its memory state and next-due date,
 * sortable + paginated (`usePaginatedQuery` over `verseMemory.listLibrary`),
 * with a drill-down dialog.
 *
 * Search is client-side over the loaded pages' reference labels (it does not
 * fetch unloaded pages) — a documented v1 limitation.
 */
export function StudyLibrary({ now }: { now: number }) {
  const [sort, setSort] = useState<LibrarySort>("dueAt");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Id<"verseRefs"> | null>(null);

  const { results, status, loadMore } = usePaginatedQuery(
    api.verseMemory.listLibrary,
    { sort },
    { initialNumItems: INITIAL_PAGE_SIZE },
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter((row) =>
      formatVerseRef(row).toLowerCase().includes(q),
    );
  }, [results, search]);

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const canLoadMore = status === "CanLoadMore";
  const isExhausted = status === "Exhausted";
  const hasResults = results.length > 0;

  // `listLibrary` can legitimately return an empty page while more pages exist
  // (e.g. a paginated slice whose rows all filtered out to un-hearted memory
  // rows). Auto-advance past such empty slices so a user with hearted verses
  // isn't stuck on a false empty state with nothing to click.
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
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Library
        </h2>
        <div className="flex items-center gap-1">
          {SORTS.map((s) => (
            <Button
              key={s.key}
              variant={sort === s.key ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter loaded verses…"
          className="h-9 pl-8"
          aria-label="Filter hearted verses by reference"
        />
      </div>

      {isLoadingFirstPage ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !hasResults && isExhausted ? (
        // Genuinely empty: the query is exhausted and no rows loaded anywhere.
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No hearted verses yet. Heart a verse in the reader to start building
            your library.
          </p>
        </div>
      ) : !hasResults ? (
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
          <ul className="space-y-1.5">
            {filtered.map((row) => {
              const style = STATUS_STYLES[row.status];
              return (
                <li key={row.verseMemoryId}>
                  <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
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
                          {style.label} · {formatDueLabel(row.dueAt, now)}
                        </span>
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {loadMoreControl}
        </>
      )}

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
            <VerseDetail verseRefId={selected} now={now} />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
