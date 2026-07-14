import { useState } from "react";
import { Layers, Loader2, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MemoryListRow } from "@/components/memory/memory-surface";

const INITIAL_PAGE_SIZE = 10;
const LOAD_MORE_PAGE_SIZE = 10;

/**
 * The Packs section on the Memory home: the user's named verse sets, each row
 * linking to its pack view with live verse + due counts. Scope packs resolve
 * their membership from hearted verses, so counts stay live as verses are
 * hearted/reviewed.
 */
export function PackList({ now }: { now: number }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.packs.listMine,
    { now },
    { initialNumItems: INITIAL_PAGE_SIZE },
  );

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const canLoadMore = status === "CanLoadMore";
  // Hold the last settled page so a refresh doesn't flash a spinner.
  // Adjusting state during render when results settle is the React-documented
  // pattern for deriving held UI state from props.
  const [heldResults, setHeldResults] = useState<typeof results | null>(null);
  if (!isLoadingFirstPage && heldResults !== results) {
    setHeldResults(results);
  }
  const isRefreshingFirstPage = isLoadingFirstPage && heldResults !== null;
  const displayResults = isRefreshingFirstPage ? heldResults : results;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Packs
        </h2>
        <Button asChild size="sm" variant="outline" className="h-7 gap-1.5">
          <Link to="/memory/new">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New pack
          </Link>
        </Button>
      </div>

      {isLoadingFirstPage && !isRefreshingFirstPage ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : displayResults.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center">
          <Layers
            className="mx-auto mb-3 h-6 w-6 text-muted-foreground/70"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            No packs yet. Group verses by scope (a book, chapter, or tag) or
            hand-pick a custom set.
          </p>
          <Button asChild size="sm" className="mt-4 gap-1.5">
            <Link to="/memory/new">
              <Plus className="h-4 w-4" aria-hidden />
              New pack
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {displayResults.map((pack) => (
              <li key={pack._id}>
                <MemoryListRow>
                  <Link
                    to="/memory/$packId"
                    params={{ packId: pack._id }}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {pack.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {pack.kind === "scope" ? "Scope" : "Custom"} ·{" "}
                        {pack.verseCount} verse
                        {pack.verseCount !== 1 ? "s" : ""}
                        {pack.dueCount > 0 ? ` · ${pack.dueCount} due` : ""}
                      </span>
                    </span>
                  </Link>
                </MemoryListRow>
              </li>
            ))}
          </ul>
          {(canLoadMore || isLoadingMore) && (
            <div className="mt-2 flex justify-center">
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
          )}
        </>
      )}
    </section>
  );
}
