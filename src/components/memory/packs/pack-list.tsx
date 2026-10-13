import { useState } from "react";
import { Layers, Loader2, Plus } from "lucide-react";
import { usePaginatedQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import { useMemoryPanelFrame } from "@/components/memory/drawer/memory-panel-context";
import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import { MemoryListRow } from "@/components/memory/memory-surface";
import { packListSubtitle } from "@/components/memory/packs/pack-list-subtitle";
import { SUGGESTIONS_LABEL } from "@/lib/memory-copy";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

const INITIAL_PAGE_SIZE = 10;
const LOAD_MORE_PAGE_SIZE = 10;

/**
 * "Passages and packs" on Your verses: every passage and pack with where it
 * stands, plus Suggestions and New pack. Rows open the detail with a way back
 * to Your verses.
 */
export function PackList({
  now,
  title = "Passages and packs",
}: {
  now: number;
  title?: string;
}) {
  const frame = useMemoryPanelFrame();
  const timeZone = getViewerTimeZone();
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const { results, status, loadMore } = usePaginatedQuery(
    api.packs.listMine,
    { now, tzOffsetMinutes },
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
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 max-sm:h-11"
          >
            <InternalLink href="/memory/presets">
              {SUGGESTIONS_LABEL}
            </InternalLink>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 max-sm:h-11"
          >
            <InternalLink href="/memory/new">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New pack
            </InternalLink>
          </Button>
        </div>
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
            Memorize a chapter from the reader, or make a pack of verses you
            want to keep together.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {displayResults.map((pack) => (
              <li key={pack._id}>
                <MemoryListRow>
                  <InternalLink
                    href={frame.hrefFor(
                      { kind: "pack", packId: pack._id },
                      { from: "verses" },
                    )}
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
                        {packListSubtitle(pack.summary, now, timeZone)}
                      </span>
                    </span>
                  </InternalLink>
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
