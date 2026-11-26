import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Heart } from "lucide-react";
import { usePaginatedQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import { HeartGrid } from "@/components/memory/today/from-your-hearts";
import { Input } from "@/components/ui/input";
import { SearchClearButton } from "@/components/ui/search-clear-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { heartSpan, type HeartItem } from "@/hooks/use-not-memorizing-hearts";
import { heartMatchesSearch } from "@/lib/memorize-search";
import { TODAY_LABEL, YOUR_HEARTS_LABEL } from "@/lib/memory-copy";
import { sortByVerseRef } from "../../../../shared/compare-verse-refs";

/** Heart rows read per page; every page loads, so search sees them all. */
const PAGE_SIZE = 100;

type BookGroup = { book: string; items: HeartItem[] };

/** Hearts in Bible order, one group per book. */
function groupByBook(items: readonly HeartItem[]): BookGroup[] {
  const groups: BookGroup[] = [];
  for (const item of sortByVerseRef(items)) {
    const last = groups.at(-1);
    if (last?.book === item.book) {
      last.items.push(item);
    } else {
      groups.push({ book: item.book, items: [item] });
    }
  }
  return groups;
}

/**
 * Every hearted verse the user is not memorizing, in Bible order and grouped
 * by book, each with Memorize. Loads all of the user's hearts page by page so
 * the filter searches all of them. Today's "From your hearts" links here.
 */
export function HeartsPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.savedVerses.listHearted,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const [query, setQuery] = useState("");
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "CanLoadMore") loadMore(PAGE_SIZE);
  }, [status, loadMore]);

  const hearts = useMemo(
    () => results.filter((item) => !item.inMemory),
    [results],
  );
  const groups = useMemo(
    () =>
      groupByBook(
        hearts.filter((item) => heartMatchesSearch(heartSpan(item), query)),
      ),
    [hearts, query],
  );
  const loadingFirst = status === "LoadingFirstPage";
  const loadingRest = !loadingFirst && status !== "Exhausted";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b py-4">
        <div className="mx-auto max-w-4xl px-4 sm:px-5">
          <Link
            to="/memory"
            aria-label={`Back to ${TODAY_LABEL}`}
            className="-ml-1.5 mb-1 inline-flex min-h-11 items-center gap-0.5 rounded-md pr-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-7"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {TODAY_LABEL}
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Heart
              aria-hidden
              className="size-4 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
            />
            {YOUR_HEARTS_LABEL}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Verses you&apos;ve hearted that you aren&apos;t memorizing yet.
          </p>
          {hearts.length > 0 ? (
            <div className="relative mt-3 max-w-md">
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by book or reference"
                className="pr-10"
                aria-label="Filter hearts"
              />
              {query.length > 0 ? (
                <SearchClearButton onClear={() => setQuery("")} />
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1" viewportRef={scrollRootRef}>
        <div className="mx-auto max-w-4xl px-4 pt-6 pb-24 sm:px-5">
          {loadingFirst ? (
            <div
              aria-busy="true"
              aria-label="Loading hearts"
              className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  aria-hidden
                  className="h-32 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : groups.length > 0 ? (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.book} aria-label={group.book}>
                  <h2 className="mb-2.5 flex items-baseline gap-2 text-sm font-semibold">
                    {group.book}
                    <span className="text-xs font-normal text-muted-foreground">
                      {group.items.length}
                    </span>
                  </h2>
                  <HeartGrid
                    items={group.items}
                    scrollRootRef={scrollRootRef}
                    className="sm:grid-cols-2 lg:grid-cols-3"
                  />
                </section>
              ))}
            </div>
          ) : loadingRest ? null : hearts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Tap the heart beside a verse in the reader, and
              it waits here until you&apos;re ready to memorize it.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hearts match that search.
            </p>
          )}
          {loadingRest ? (
            <p
              aria-live="polite"
              className="mt-6 text-xs text-muted-foreground"
            >
              Loading more hearts…
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
