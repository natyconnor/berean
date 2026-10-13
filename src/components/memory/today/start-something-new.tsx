import { useId, useMemo, useState, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  ChevronRight,
  Layers,
  Plus,
  Search,
} from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../../convex/_generated/api";
import { InternalLink } from "@/components/memory/internal-link";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReferenceSuggestionList } from "@/components/verse-ref/reference-suggestion-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { useReferenceAutocomplete } from "@/hooks/use-reference-autocomplete";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import {
  memorizeSearch,
  type MemorizeSearchResult,
} from "@/lib/memorize-search";
import {
  memorizeTargetSpans,
  resolveMemorizeTarget,
} from "@/lib/memorize-target";
import { memorizeTitleLabel } from "@/lib/memory-copy";
import { memoryPanelDrawerHref } from "@/lib/memory-panel";
import { cn } from "@/lib/utils";
import {
  MEMORIZE_SUGGESTION_POOL,
  MEMORIZE_SUGGESTIONS,
  suggestionCollectionHref,
  suggestionSpans,
  suggestionTarget,
  todaySuggestions,
  type MemorizableSuggestion,
  type MemorizeSuggestion,
} from "../../../../shared/memorize-suggestions";

import { FromYourHearts } from "./from-your-hearts";

type MemorizeStatus = FunctionReturnType<typeof api.verseMemory.memorizeStatus>;

const NO_MATCH_DELAY_MS = 500;
const STATUS_DELAY_MS = 250;

const POOL_TARGETS = MEMORIZE_SUGGESTION_POOL.map((suggestion) => ({
  spans: suggestionSpans(suggestion),
}));

const chipClassName =
  "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-left text-[13px] transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:min-h-11";

/**
 * "Start something new": search a reference, pick a suggestion, make a pack,
 * or memorize one of your hearts.
 */
export function StartSomethingNew({
  scrollRootRef,
}: {
  scrollRootRef: RefObject<HTMLElement | null>;
}) {
  const headingId = useId();
  const [query, setQuery] = useState("");

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-[15px] font-semibold tracking-tight">
          Start something new
        </h2>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground max-sm:h-11"
        >
          <InternalLink href="/memory/presets">
            More suggestions
            <ArrowRight aria-hidden />
          </InternalLink>
        </Button>
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <MemorizeSearch
          label="What do you want to memorize?"
          placeholder="Try Psalm 23 or John 15"
          query={query}
          onQueryChange={setQuery}
        />
        <TodaySuggestionChips />
        <MakeYourOwnPackTile />
        <FromYourHearts
          variant="today"
          query={query}
          scrollRootRef={scrollRootRef}
        />
      </div>
    </section>
  );
}

function destinationHref(
  destination: NonNullable<MemorizeStatus["destination"]>,
): string {
  return memoryPanelDrawerHref(
    destination.kind === "verse"
      ? { kind: "verse", verseRefId: destination.verseRefId }
      : { kind: "pack", packId: destination.packId },
  );
}

type OpenableMatch =
  | { state: "memorizing"; href: string }
  | { state: "partOf"; href: string; container: string };

/**
 * The drawer to open for a match already being memorized, or inside a
 * passage that is. `null` keeps Memorize, which opens the sheet; the sheet
 * explains an overlap.
 */
function openableMatch(
  status: MemorizeStatus | undefined,
): OpenableMatch | null {
  if (!status?.destination) return null;
  const href = destinationHref(status.destination);
  if (status.state === "memorizing") return { state: "memorizing", href };
  if (status.state === "partOf") {
    return { state: "partOf", href, container: status.title ?? "a passage" };
  }
  return null;
}

/** `memorizeStatus` for the match once typing pauses; `undefined` until then. */
function useMatchStatus(
  query: string,
  result: MemorizeSearchResult,
): MemorizeStatus | undefined {
  const statusQuery = useDebouncedValue(query, STATUS_DELAY_MS);
  const settled = statusQuery === query;
  const spans = useMemo(
    () =>
      result.kind === "match"
        ? memorizeTargetSpans(resolveMemorizeTarget(result.target))
        : [],
    [result],
  );
  const status = useQuery(
    api.verseMemory.memorizeStatus,
    settled && spans.length > 0 ? { spans } : "skip",
  );
  return settled ? status : undefined;
}

const matchRowClassName =
  "mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Verses to preview under a match; whole chapters have none. */
function previewSpans(result: MemorizeSearchResult): VerseSpan[] | null {
  if (result.kind !== "match" || result.target.kind !== "spans") return null;
  return result.target.spans;
}

/**
 * A labelled reference search. Partial text suggests books, chapters, and
 * verses; a match opens the Memorize sheet, or its drawer when it is already
 * being memorized.
 */
export function MemorizeSearch({
  label,
  placeholder,
  query,
  onQueryChange,
  className,
}: {
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  className?: string;
}) {
  const inputId = useId();
  const sheet = useMemorizeSheet();
  const navigate = useNavigate();
  const result = useMemo(() => memorizeSearch(query), [query]);
  const autocomplete = useReferenceAutocomplete({
    query,
    onQueryChange,
    enabled: result.kind !== "match",
  });
  const settledQuery = useDebouncedValue(query, NO_MATCH_DELAY_MS);
  const showNoMatch =
    result.kind === "noMatch" &&
    settledQuery === query &&
    autocomplete.suggestions.length === 0;
  const openable = openableMatch(useMatchStatus(query, result));
  const spans = previewSpans(result);

  const openMatch = () => {
    if (result.kind !== "match") return;
    if (openable) {
      void navigate({ href: openable.href });
    } else {
      sheet.open(result.target);
    }
  };

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          spellCheck={false}
          {...autocomplete.inputProps}
          value={query}
          placeholder={placeholder}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (autocomplete.onKeyDown(event)) return;
            if (event.key === "Enter" && result.kind === "match") {
              event.preventDefault();
              openMatch();
            }
          }}
          className={cn(
            "h-12 bg-card pl-10 text-base md:text-[15px]",
            query.length === 0 && "sm:pr-64",
          )}
        />
        {query.length === 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3.5 hidden -translate-y-1/2 text-xs text-muted-foreground sm:block"
          >
            A verse, a passage, or a whole chapter
          </span>
        ) : null}
        {autocomplete.open ? (
          <ReferenceSuggestionList
            id={autocomplete.listboxId}
            label="Reference suggestions"
            suggestions={autocomplete.suggestions}
            activeIndex={autocomplete.activeIndex}
            optionId={autocomplete.optionId}
            onHighlight={autocomplete.highlightIndex}
            onAccept={autocomplete.accept}
            className="absolute inset-x-0 top-full z-30 mt-1.5"
          />
        ) : null}
      </div>
      <div aria-live="polite">
        {result.kind === "match" && openable ? (
          <InternalLink
            href={openable.href}
            className={cn(matchRowClassName, "bg-card hover:bg-accent")}
          >
            <Brain aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold">
                {result.title}
                {openable.state === "memorizing" ? (
                  <>
                    {" "}
                    <MemorizingBadge />
                  </>
                ) : null}
              </span>
              {openable.state === "partOf" ? (
                <>
                  {" "}
                  <span className="block text-xs text-muted-foreground">
                    Part of {openable.container}
                  </span>
                </>
              ) : null}
            </span>{" "}
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
              Open
              <ChevronRight aria-hidden className="size-4" />
            </span>
          </InternalLink>
        ) : result.kind === "match" ? (
          <button
            type="button"
            onClick={openMatch}
            className={cn(
              matchRowClassName,
              "border-primary/30 bg-primary/5 hover:bg-primary/10",
            )}
          >
            <Brain aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {memorizeTitleLabel(result.title)}
              </span>{" "}
              <span className="block text-xs text-muted-foreground">
                {result.planLine}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
          </button>
        ) : null}
        {showNoMatch ? (
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t find that reference. Try a book and chapter, like
            Psalm 23.
          </p>
        ) : null}
      </div>
      {spans ? <MatchVersePreview spans={spans} /> : null}
    </div>
  );
}

/**
 * A matched run of verses in the reader's serif, three lines at most. A
 * range across chapters reads its first two chapters' verses; the clamp
 * hides the rest.
 */
function MatchVersePreview({ spans }: { spans: readonly VerseSpan[] }) {
  const first = useEsvReference(spans[0] ?? null);
  const second = useEsvReference(spans[1] ?? null);
  if (first.loading || second.loading) {
    return (
      <div aria-hidden className="mt-2.5 space-y-1.5 px-1">
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  const text = [first.data, second.data]
    .flatMap((data) => data?.verses ?? [])
    .map((verse) => verse.text.trim())
    .join(" ");
  if (!text) return null;
  return (
    <p className="mt-2.5 line-clamp-3 px-1 font-serif text-[15px] leading-relaxed text-foreground/85">
      {text}
    </p>
  );
}

function MemorizingBadge() {
  return (
    <span className="rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
      Memorizing
    </span>
  );
}

function isStarted(status: MemorizeStatus | undefined): boolean {
  return status?.state === "memorizing" || status?.state === "partOf";
}

/**
 * Today's chips: suggestions not already being memorized, filled from the
 * wider pool, then the collection. The curated list shows while loading.
 */
function TodaySuggestionChips() {
  const statuses = useQuery(api.verseMemory.memorizeStatuses, {
    targets: POOL_TARGETS,
  });
  const suggestions = useMemo(() => {
    if (!statuses) return MEMORIZE_SUGGESTIONS;
    const started = new Set(
      MEMORIZE_SUGGESTION_POOL.filter((_, index) =>
        isStarted(statuses[index]),
      ).map((suggestion) => suggestion.id),
    );
    return todaySuggestions(started);
  }, [statuses]);
  return <SuggestionChips suggestions={suggestions} />;
}

export function SuggestionChips({
  suggestions,
}: {
  suggestions: readonly MemorizeSuggestion[];
}) {
  return (
    <ul aria-label="Suggestions" className="mt-3 flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} className="max-w-full">
          {suggestion.kind === "collection" ? (
            <InternalLink
              href={suggestionCollectionHref(suggestion.presetId)}
              className={chipClassName}
            >
              <Layers aria-hidden className="size-3.5 shrink-0" />
              {suggestion.title}{" "}
              <span className="text-xs text-muted-foreground">pack</span>
            </InternalLink>
          ) : (
            <SuggestionChip suggestion={suggestion} />
          )}
        </li>
      ))}
    </ul>
  );
}

function SuggestionChip({ suggestion }: { suggestion: MemorizableSuggestion }) {
  const sheet = useMemorizeSheet();
  const meta =
    suggestion.kind === "chapter"
      ? (suggestion.detail ?? `${suggestion.verseCount} verses`)
      : suggestion.detail;

  return (
    <button
      type="button"
      className={chipClassName}
      onClick={() => {
        const target = suggestionTarget(suggestion);
        if (target) sheet.open(target);
      }}
    >
      <span className={cn(suggestion.kind === "chapter" && "font-semibold")}>
        {suggestion.title}
      </span>
      {meta ? (
        <>
          {" "}
          <span className="text-xs text-muted-foreground">{meta}</span>
        </>
      ) : null}
    </button>
  );
}

export function MakeYourOwnPackTile() {
  return (
    <InternalLink
      href="/memory/new"
      className="mt-3.5 flex max-w-[460px] items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5 transition-colors outline-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:max-w-none"
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
      >
        <Plus className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Make your own pack</span>{" "}
        <span className="block text-xs text-muted-foreground">
          Pick verses for a theme, a group, or a season
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="ml-auto size-4 shrink-0 text-muted-foreground"
      />
    </InternalLink>
  );
}
