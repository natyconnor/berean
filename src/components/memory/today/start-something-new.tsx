import { useId, useMemo, useState, type RefObject } from "react";
import {
  ArrowRight,
  Brain,
  ChevronRight,
  Layers,
  Plus,
  Search,
} from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import { InternalLink } from "@/components/memory/internal-link";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { memorizeSearch } from "@/lib/memorize-search";
import {
  memorizeTargetSpans,
  resolveMemorizeTarget,
} from "@/lib/memorize-target";
import { memorizeTitleLabel } from "@/lib/memory-copy";
import { memoryPanelDrawerHref } from "@/lib/memory-panel";
import { cn } from "@/lib/utils";
import {
  MEMORIZE_SUGGESTIONS,
  suggestionCollectionHref,
  suggestionTarget,
  type MemorizeSuggestion,
} from "../../../../shared/memorize-suggestions";

import { FromYourHearts } from "./from-your-hearts";

const NO_MATCH_DELAY_MS = 500;

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
        <SuggestionChips suggestions={MEMORIZE_SUGGESTIONS} checkMemorizing />
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

/** A labelled reference search; a match opens the Memorize sheet. */
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
  const result = useMemo(() => memorizeSearch(query), [query]);
  const settledQuery = useDebouncedValue(query, NO_MATCH_DELAY_MS);
  const showNoMatch = result.kind === "noMatch" && settledQuery === query;

  const openMatch = () => {
    if (result.kind === "match") sheet.open(result.target);
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
          value={query}
          placeholder={placeholder}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
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
      </div>
      <div aria-live="polite">
        {result.kind === "match" ? (
          <button
            type="button"
            onClick={openMatch}
            className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-left transition-colors outline-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
    </div>
  );
}

export function SuggestionChips({
  suggestions,
  checkMemorizing,
}: {
  suggestions: readonly MemorizeSuggestion[];
  /** Ask whether each one is already being memorized (not needed on first run). */
  checkMemorizing: boolean;
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
            <SuggestionChip
              suggestion={suggestion}
              checkMemorizing={checkMemorizing}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function SuggestionChip({
  suggestion,
  checkMemorizing,
}: {
  suggestion: Exclude<MemorizeSuggestion, { kind: "collection" }>;
  checkMemorizing: boolean;
}) {
  const sheet = useMemorizeSheet();
  const target = useMemo(() => suggestionTarget(suggestion), [suggestion]);
  const spans = useMemo(
    () => (target ? memorizeTargetSpans(resolveMemorizeTarget(target)) : []),
    [target],
  );
  const status = useQuery(
    api.verseMemory.memorizeStatus,
    checkMemorizing && spans.length > 0 ? { spans } : "skip",
  );

  const title = (
    <span className={cn(suggestion.kind === "chapter" && "font-semibold")}>
      {suggestion.title}
    </span>
  );
  const meta =
    suggestion.kind === "chapter"
      ? `${suggestion.verseCount} verses`
      : suggestion.detail;

  const destination =
    status && status.state !== "none" ? status.destination : undefined;
  if (destination) {
    return (
      <InternalLink
        href={memoryPanelDrawerHref(
          destination.kind === "verse"
            ? { kind: "verse", verseRefId: destination.verseRefId }
            : { kind: "pack", packId: destination.packId },
        )}
        className={chipClassName}
      >
        {title}{" "}
        <span className="rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
          Memorizing
        </span>
      </InternalLink>
    );
  }

  return (
    <button
      type="button"
      className={chipClassName}
      onClick={() => {
        if (target) sheet.open(target);
      }}
    >
      {title}
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
