import { useId, useRef, useState, type RefObject } from "react";
import { Check, Heart, Plus, Search } from "lucide-react";
import { usePaginatedQuery, useQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useNearViewportVisible } from "@/hooks/use-near-viewport-visible";
import { spanCoveredBy, type VerseSpan } from "@/lib/hearted-verse-coverage";
import { heartMatchesSearch, parseReferenceSpan } from "@/lib/memorize-search";
import { spanKey } from "@/lib/memorize-status";
import { spanDisplayTitle } from "@/lib/memorize-target";
import { cn } from "@/lib/utils";

type Mode = "search" | "hearts";

const HEARTS_PAGE_SIZE = 30;

const SEARCH_PLACEHOLDER = "A reference like John 14:27";

function toSpan(item: VerseSpan): VerseSpan {
  return {
    book: item.book,
    chapter: item.chapter,
    startVerse: item.startVerse,
    endVerse: item.endVerse,
  };
}

export interface VerseSearchAddProps {
  /** `spanKey`s of verses already in the pack. */
  addedKeys: ReadonlySet<string>;
  /** `spanKey`s being added right now. */
  pendingKeys?: ReadonlySet<string>;
  onAdd: (span: VerseSpan) => void;
  autoFocus?: boolean;
  /** Esc inside: close the inline row instead of the drawer around it. */
  onEscape?: () => void;
  className?: string;
}

/**
 * Find verses to add to a pack: search by reference, or pick from your
 * hearts. Each row shows the reference, one line of text, a red heart when
 * hearted, and + Add / ✓ Added. References only; there is no word search.
 */
export function VerseSearchAdd({
  addedKeys,
  pendingKeys,
  onAdd,
  autoFocus = false,
  onEscape,
  className,
}: VerseSearchAddProps) {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const headingId = useId();
  const hearts = usePaginatedQuery(
    api.savedVerses.listHearted,
    {},
    { initialNumItems: HEARTS_PAGE_SIZE },
  );
  // A memorized passage's heart is a whole passage, not a verse to add.
  const heartSpans = hearts.results
    .filter((item) => item.passage === undefined)
    .map(toSpan);
  const heartCount = `${heartSpans.length}${
    hearts.status === "CanLoadMore" || hearts.status === "LoadingMore"
      ? "+"
      : ""
  }`;

  const rowProps = (span: VerseSpan) => {
    const key = spanKey(span);
    return {
      span,
      added: addedKeys.has(key),
      pending: pendingKeys?.has(key) ?? false,
      onAdd: () => onAdd(span),
    };
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn("space-y-2.5", className)}
      {...(onEscape ? { "data-keep-drawer-on-escape": "" } : {})}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !onEscape) return;
        event.preventDefault();
        onEscape();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          Add verses
        </h3>
        <div
          role="group"
          aria-label="Find verses"
          className="inline-flex rounded-lg bg-muted p-0.5"
        >
          {(["search", "hearts"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors max-sm:min-h-9",
                mode === option
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "search"
                ? "Search"
                : `From your hearts · ${heartCount}`}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={autoFocus}
          placeholder={
            mode === "search" ? SEARCH_PLACEHOLDER : "Filter your hearts"
          }
          aria-label={
            mode === "search" ? "Search by reference" : "Filter your hearts"
          }
          className="h-10 pl-9"
        />
      </div>

      {mode === "search" ? (
        <ReferenceResult query={query} rowProps={rowProps} />
      ) : (
        <HeartResults
          query={query}
          spans={heartSpans}
          loading={hearts.status === "LoadingFirstPage"}
          canLoadMore={hearts.status === "CanLoadMore"}
          onLoadMore={() => hearts.loadMore(HEARTS_PAGE_SIZE)}
          rowProps={rowProps}
        />
      )}
    </section>
  );
}

type RowProps = (span: VerseSpan) => {
  span: VerseSpan;
  added: boolean;
  pending: boolean;
  onAdd: () => void;
};

const resultListClassName =
  "divide-y overflow-hidden rounded-lg border bg-card";

function ReferenceResult({
  query,
  rowProps,
}: {
  query: string;
  rowProps: RowProps;
}) {
  const result = parseReferenceSpan(query);
  const match = result.kind === "match" ? result.span : null;
  const chapterHearts = useQuery(
    api.savedVerses.listForChapter,
    match ? { book: match.book, chapter: match.chapter } : "skip",
  );

  if (result.kind === "empty") {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        Type a reference, like John 14:27 or Romans 8:28–30.
      </p>
    );
  }
  if (result.kind === "noMatch") {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        No verse matches “{query.trim()}”. Try a reference like John 14:27.
      </p>
    );
  }
  if (result.kind === "outOfRange") {
    return (
      <p className="px-1 text-xs text-muted-foreground">{result.message}</p>
    );
  }

  return (
    <ul className={resultListClassName}>
      <VerseAddRow
        {...rowProps(result.span)}
        hearted={spanCoveredBy(result.span, (chapterHearts ?? []).map(toSpan))}
        textEnabled
      />
    </ul>
  );
}

function HeartResults({
  query,
  spans,
  loading,
  canLoadMore,
  onLoadMore,
  rowProps,
}: {
  query: string;
  spans: VerseSpan[];
  loading: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  rowProps: RowProps;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (loading) {
    return (
      <div aria-busy="true" className="space-y-1.5" aria-label="Loading hearts">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }
  if (spans.length === 0) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        No hearts yet. Heart verses in the reader to find them here.
      </p>
    );
  }

  const matches = spans.filter((span) => heartMatchesSearch(span, query));
  return (
    <div className="space-y-2">
      {matches.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          None of your hearts match “{query.trim()}”.
        </p>
      ) : (
        <div ref={scrollRef} className="max-h-80 overflow-y-auto rounded-lg">
          <ul className={resultListClassName}>
            {matches.map((span) => (
              <LazyHeartRow
                key={spanKey(span)}
                scrollRef={scrollRef}
                {...rowProps(span)}
              />
            ))}
          </ul>
        </div>
      )}
      {canLoadMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={onLoadMore}
        >
          Show more hearts
        </Button>
      ) : null}
    </div>
  );
}

function LazyHeartRow({
  scrollRef,
  ...props
}: ReturnType<RowProps> & { scrollRef: RefObject<HTMLDivElement | null> }) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const visible = useNearViewportVisible(rowRef, scrollRef);
  return (
    <VerseAddRow {...props} rowRef={rowRef} hearted textEnabled={visible} />
  );
}

function VerseAddRow({
  span,
  hearted,
  added,
  pending,
  onAdd,
  textEnabled,
  rowRef,
}: ReturnType<RowProps> & {
  hearted: boolean;
  textEnabled: boolean;
  rowRef?: RefObject<HTMLLIElement | null>;
}) {
  const label = spanDisplayTitle(span);
  return (
    <li ref={rowRef} className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{label}</span>
          {hearted ? (
            <Heart
              role="img"
              aria-label="Hearted"
              className="size-3 shrink-0 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
            />
          ) : null}
        </p>
        <VerseLine span={span} enabled={textEnabled} />
      </div>
      {added ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden className="size-3.5" />
          Added
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label={`Add ${label}`}
          loading={pending}
          onClick={onAdd}
          className="shrink-0 max-sm:h-11 max-sm:px-3"
        >
          <Plus aria-hidden />
          Add
        </Button>
      )}
    </li>
  );
}

function VerseLine({ span, enabled }: { span: VerseSpan; enabled: boolean }) {
  const { data, loading, error } = useEsvReference(span, { enabled });
  if (error) return null;
  const text = data?.verses.map((verse) => verse.text.trim()).join(" ");
  if (text) {
    return (
      <p className="truncate font-serif text-sm text-foreground/80">{text}</p>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "mt-1 h-3.5 w-3/4 rounded bg-muted",
        (loading || !enabled) && "animate-pulse",
      )}
    />
  );
}
