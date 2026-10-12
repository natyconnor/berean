import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import type { FunctionReturnType } from "convex/server";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import { Brain, Loader2 } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useNearViewportVisible } from "@/hooks/use-near-viewport-visible";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import {
  groupHeartsByBook,
  heartListLabel,
  heartMatchesBookFilter,
} from "@/lib/heart-list";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { MEMORIZE_LABEL, memorizeTitleLabel } from "@/lib/memory-copy";
import { cn } from "@/lib/utils";
import { toPassageId } from "@/lib/verse-ref-utils";

export type HeartListItem = FunctionReturnType<
  typeof api.savedVerses.listHearted
>["page"][number];

const INITIAL_PAGE_SIZE = 30;
const LOAD_MORE_PAGE_SIZE = 30;

const ABBREVIATIONS = new Map(
  BIBLE_BOOKS.map((book) => [book.name, book.abbreviation]),
);

function heartSpan(item: HeartListItem): VerseSpan {
  return {
    book: item.book,
    chapter: item.chapter,
    startVerse: item.startVerse,
    endVerse: item.endVerse,
  };
}

function heartHref(item: HeartListItem): string {
  const params = new URLSearchParams({
    startVerse: String(item.startVerse),
    endVerse: String(item.endVerse),
  });
  return `/passage/${toPassageId(item.book, item.chapter)}?${params.toString()}`;
}

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

interface HeartedListProps {
  /** Open the heart in the reader. The navigator closes. */
  onOpenHeart: (item: HeartListItem) => void;
  /** Memorize is opening the sheet. The navigator closes. */
  onMemorizeOpen: () => void;
  /** Where focus goes when the Memorize sheet closes. */
  getReturnFocusTarget?: () => HTMLElement | null;
}

/**
 * Go to passage → Hearted: every heart, newest first, grouped by book. Each
 * row opens its passage and offers Memorize, or shows "Memorizing". Up/Down
 * in the filter (or on a row) moves through rows; Enter opens one.
 */
export function HeartedList({
  onOpenHeart,
  onMemorizeOpen,
  getReturnFocusTarget,
}: HeartedListProps) {
  const memorizeSheet = useMemorizeSheet();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const { results, status, loadMore } = usePaginatedQuery(
    api.savedVerses.listHearted,
    {},
    { initialNumItems: INITIAL_PAGE_SIZE },
  );
  const canLoadMore = status === "CanLoadMore";
  const isLoadingMore = status === "LoadingMore";

  const groups = useMemo(
    () =>
      groupHeartsByBook(
        results.filter((item) =>
          heartMatchesBookFilter(
            item.book,
            filter,
            ABBREVIATIONS.get(item.book),
          ),
        ),
      ),
    [results, filter],
  );
  const rows = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const groupStarts = useMemo(() => {
    const starts: number[] = [];
    let start = 0;
    for (const group of groups) {
      starts.push(start);
      start += group.items.length;
    }
    return starts;
  }, [groups]);
  const activeIndex = Math.min(highlightedIndex, rows.length - 1);

  // A page can be all rows of one long passage heart; keep reading until
  // something shows.
  useEffect(() => {
    if (canLoadMore && results.length === 0) {
      loadMore(LOAD_MORE_PAGE_SIZE);
    }
  }, [canLoadMore, results.length, loadMore]);

  const rowElement = (index: number) =>
    viewportRef.current?.querySelector<HTMLElement>(
      `[data-heart-index="${index}"]`,
    ) ?? null;

  const moveHighlight = (index: number) => {
    setHighlightedIndex(index);
    rowElement(index)?.scrollIntoView?.({ block: "nearest" });
  };

  const memorize = (item: HeartListItem) => {
    const returnFocusTo = getReturnFocusTarget?.() ?? null;
    onMemorizeOpen();
    memorizeSheet.open(
      { kind: "spans", spans: [heartSpan(item)] },
      returnFocusTo ? { returnFocusTo } : undefined,
    );
  };

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0) return;
    if (event.key === "Enter") {
      const item = rows[activeIndex];
      if (item) {
        event.preventDefault();
        onOpenHeart(item);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(Math.min(activeIndex + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(Math.max(activeIndex - 1, 0));
    }
  };

  const handleRowsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!(event.target instanceof HTMLElement)) return;
    const row = event.target.closest<HTMLElement>("[data-heart-index]");
    if (!row) return;
    event.preventDefault();
    const index = Number(row.dataset.heartIndex);
    const next =
      event.key === "ArrowDown"
        ? Math.min(index + 1, rows.length - 1)
        : Math.max(index - 1, 0);
    moveHighlight(next);
    rowElement(next)?.querySelector<HTMLElement>("[data-heart-link]")?.focus();
  };

  const loadMoreControl =
    canLoadMore || isLoadingMore ? (
      <div className="flex justify-center p-2">
        <Button
          variant="outline"
          size="sm"
          className="h-11 sm:h-8"
          onClick={() => loadMore(LOAD_MORE_PAGE_SIZE)}
          disabled={!canLoadMore}
        >
          {isLoadingMore ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Loading…
            </>
          ) : (
            "Load more"
          )}
        </Button>
      </div>
    ) : null;

  let body;
  if (status === "LoadingFirstPage") {
    body = (
      <div className="flex justify-center py-16">
        <Loader2
          className="h-5 w-5 animate-spin text-muted-foreground"
          aria-label="Loading hearts"
        />
      </div>
    );
  } else if (results.length === 0 && status === "Exhausted") {
    body = (
      <p className="px-4 py-16 text-center text-sm text-muted-foreground">
        No hearts yet. Tap ♥ beside any verse you love.
      </p>
    );
  } else if (rows.length === 0) {
    body = (
      <>
        {results.length > 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No hearts in a book matching “{filter.trim()}”.
          </p>
        ) : (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              aria-hidden
            />
          </div>
        )}
        {loadMoreControl}
      </>
    );
  } else {
    body = (
      <div className="p-1" onKeyDown={handleRowsKeyDown}>
        {groups.map((group, groupIndex) => (
          <div key={group.book} role="group" aria-label={group.book}>
            <div
              aria-hidden
              className="px-2 py-1 text-xs font-semibold text-muted-foreground"
            >
              {group.book}
            </div>
            <ul>
              {group.items.map((item, itemIndex) => {
                const rowIndex = (groupStarts[groupIndex] ?? 0) + itemIndex;
                return (
                  <HeartRow
                    key={item.savedVerseId}
                    item={item}
                    index={rowIndex}
                    highlighted={rowIndex === activeIndex}
                    viewportRef={viewportRef}
                    onHighlight={() => setHighlightedIndex(rowIndex)}
                    onOpen={() => onOpenHeart(item)}
                    onMemorize={() => memorize(item)}
                  />
                );
              })}
            </ul>
          </div>
        ))}
        {loadMoreControl}
      </div>
    );
  }

  return (
    <>
      <div className="border-b p-2">
        <Input
          placeholder="Filter hearts…"
          aria-label="Filter hearts by book"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleFilterKeyDown}
          className="h-8"
          autoFocus
        />
      </div>
      <ScrollArea className="h-80" viewportRef={viewportRef}>
        {body}
      </ScrollArea>
    </>
  );
}

function HeartRow({
  item,
  index,
  highlighted,
  viewportRef,
  onHighlight,
  onOpen,
  onMemorize,
}: {
  item: HeartListItem;
  index: number;
  highlighted: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  onHighlight: () => void;
  onOpen: () => void;
  onMemorize: () => void;
}) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const nearViewport = useNearViewportVisible(rowRef, viewportRef);
  const label = heartListLabel(item);

  return (
    <li
      ref={rowRef}
      data-heart-index={index}
      onMouseEnter={onHighlight}
      className={cn(
        "relative flex min-h-12 items-center gap-2 rounded-sm px-2 py-1.5 transition-colors",
        highlighted ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <div className="min-w-0 flex-1">
        <a
          href={heartHref(item)}
          data-heart-link
          onFocus={onHighlight}
          onClick={(event) => {
            if (isModifiedClick(event)) return;
            event.preventDefault();
            onOpen();
          }}
          className="block truncate rounded-sm text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-sm after:content-[''] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          {label}
        </a>
        <HeartVerseLine span={heartSpan(item)} enabled={nearViewport} />
      </div>
      {item.inMemory ? (
        <span className="shrink-0 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
          Memorizing
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative z-10 size-11 sm:h-8 sm:w-auto"
          aria-label={memorizeTitleLabel(label)}
          onClick={onMemorize}
        >
          <Brain aria-hidden />
          <span className="hidden sm:inline">{MEMORIZE_LABEL}</span>
        </Button>
      )}
    </li>
  );
}

function HeartVerseLine({
  span,
  enabled,
}: {
  span: VerseSpan;
  enabled: boolean;
}) {
  const { data, loading, error } = useEsvReference(span, { enabled });
  if (!enabled || loading) {
    return (
      <div
        aria-hidden
        className={cn(
          "mt-1 h-3.5 w-3/4 rounded bg-muted",
          loading && "animate-pulse",
        )}
      />
    );
  }
  if (error) {
    return (
      <p className="text-xs text-muted-foreground">
        Couldn&apos;t load verse text.
      </p>
    );
  }
  const text = data?.verses.map((verse) => verse.text.trim()).join(" ");
  if (!text) return null;
  return (
    <p className="truncate font-serif text-sm text-muted-foreground">{text}</p>
  );
}
