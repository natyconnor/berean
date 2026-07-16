import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebouncedEsvReferenceValidation } from "@/hooks/use-esv-reference";
import { getChapterVerseCount } from "@/lib/bible-verse-counts";
import { cn } from "@/lib/utils";
import { verseMatchesScope, type VerseScope } from "@/lib/verse-scope-match";
import {
  buildVerseSuggestions,
  formatVerseRef,
  parseVerseRef,
  resolveCanonicalBookName,
  type VerseRef,
  type VerseSuggestionItem,
} from "@/lib/verse-ref-utils";

import type { HeartedVerse, PackableVerse } from "./pack-verse-types";
import { VerseBrowsePicker } from "./verse-browse-picker";

function getReferenceBoundsError(ref: VerseRef): string | null {
  const verseCount = getChapterVerseCount(ref.book, ref.chapter);
  if (verseCount === null) {
    return `${ref.book} ${ref.chapter} is not a valid chapter.`;
  }
  if (ref.endVerse > verseCount) {
    return `${ref.book} ${ref.chapter} only has ${verseCount} verse${
      verseCount === 1 ? "" : "s"
    }.`;
  }
  return null;
}

type PickerTab = "hearted" | "browse";

interface PackVersePickerProps {
  heartedVerses: ReadonlyArray<HeartedVerse>;
  isLoadingHearted: boolean;
  scope?: VerseScope;
  isSelected: (verse: PackableVerse) => boolean;
  isDisabled?: (verse: PackableVerse) => boolean;
  isPending?: (verse: PackableVerse) => boolean;
  onSelect: (verse: PackableVerse) => void;
}

function getReferenceScopeError(
  ref: Pick<PackableVerse, "book" | "chapter">,
  scope?: VerseScope,
): string | null {
  if (!scope || verseMatchesScope(ref, scope)) return null;
  return "Outside this pack's scope.";
}

export function PackVersePicker({
  heartedVerses,
  isLoadingHearted,
  scope,
  isSelected,
  isDisabled,
  isPending,
  onSelect,
}: PackVersePickerProps) {
  const [referenceInput, setReferenceInput] = useState("");
  const [heartedSearch, setHeartedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PickerTab>("hearted");

  const parsedRef = useMemo(
    () => parseVerseRef(referenceInput),
    [referenceInput],
  );
  const parsedRefBoundsError = parsedRef
    ? getReferenceBoundsError(parsedRef)
    : null;
  const parsedRefScopeError = parsedRef
    ? getReferenceScopeError(parsedRef, scope)
    : null;
  const validation = useDebouncedEsvReferenceValidation(
    parsedRef && !parsedRefBoundsError && !parsedRefScopeError
      ? parsedRef
      : null,
  );

  const suggestions = useMemo((): VerseSuggestionItem[] => {
    if (parsedRef) {
      if (parsedRefBoundsError || parsedRefScopeError) return [];
      return [
        {
          kind: "reference",
          key: `ref:${formatVerseRef(parsedRef)}`,
          label: formatVerseRef(parsedRef),
          description: "Add this verse",
          ref: parsedRef,
        },
      ];
    }

    const trimmedInput = referenceInput.trim();
    const hasStructuredReferenceInput =
      /\d/.test(trimmedInput) ||
      (referenceInput.endsWith(" ") &&
        resolveCanonicalBookName(trimmedInput) !== null);
    if (hasStructuredReferenceInput) return [];

    return buildVerseSuggestions(referenceInput)
      .filter((suggestion) => suggestion.kind === "book")
      .slice(0, 5);
  }, [parsedRef, parsedRefBoundsError, parsedRefScopeError, referenceInput]);

  const scopedHeartedVerses = useMemo(
    () =>
      scope
        ? heartedVerses.filter((verse) => verseMatchesScope(verse, scope))
        : heartedVerses,
    [heartedVerses, scope],
  );

  const filteredHearted = useMemo(() => {
    const q = heartedSearch.trim().toLowerCase();
    if (!q) return scopedHeartedVerses;
    return scopedHeartedVerses.filter((verse) =>
      formatVerseRef(verse).toLowerCase().includes(q),
    );
  }, [heartedSearch, scopedHeartedVerses]);

  const referenceStatus = useMemo(() => {
    if (!parsedRef) return null;
    if (parsedRefBoundsError || parsedRefScopeError) {
      return {
        tone: "destructive" as const,
        label:
          parsedRefBoundsError ?? parsedRefScopeError ?? "Invalid reference",
      };
    }
    if (validation.status === "valid") {
      const preview = validation.data?.verses
        .map((verse) => verse.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return preview
        ? { tone: "muted" as const, label: preview }
        : { tone: "muted" as const, label: "Valid reference" };
    }
    if (
      validation.status === "debouncing" ||
      validation.status === "checking"
    ) {
      return { tone: "muted" as const, label: "Checking reference…" };
    }
    if (validation.status === "invalid") {
      return {
        tone: "destructive" as const,
        label: "That reference doesn't appear to exist.",
      };
    }
    if (validation.status === "unavailable") {
      return {
        tone: "muted" as const,
        label: "Reference parsed. Preview is temporarily unavailable.",
      };
    }
    return null;
  }, [parsedRef, parsedRefBoundsError, parsedRefScopeError, validation]);

  function selectReference(ref: VerseRef) {
    if (
      getReferenceBoundsError(ref) ||
      getReferenceScopeError(ref, scope) ||
      isDisabled?.(ref) ||
      isPending?.(ref)
    ) {
      setReferenceInput(formatVerseRef(ref));
      return;
    }
    onSelect(ref);
    setReferenceInput("");
  }

  const typedDisabled = parsedRef
    ? Boolean(parsedRefBoundsError) ||
      Boolean(parsedRefScopeError) ||
      (isDisabled?.(parsedRef) ?? false)
    : true;
  const typedPending = parsedRef ? (isPending?.(parsedRef) ?? false) : false;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={referenceInput}
            onChange={(event) => setReferenceInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && parsedRef && !typedDisabled) {
                event.preventDefault();
                selectReference(parsedRef);
              }
            }}
            placeholder='Add a verse or range, e.g. "John 3:16-18"'
            aria-label="Add verse by reference"
          />
          <Button
            type="button"
            onClick={() => {
              if (parsedRef) selectReference(parsedRef);
            }}
            disabled={!parsedRef || typedDisabled || typedPending}
            className="w-16 shrink-0"
          >
            {typedPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              "Add"
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {scope
            ? "Verses you heart in this scope join the pack automatically."
            : "Adding a verse hearts it for Memory."}
        </p>
        {referenceStatus ? (
          <p
            className={cn(
              "line-clamp-2 text-xs",
              referenceStatus.tone === "destructive"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {referenceStatus.label}
          </p>
        ) : null}
        {suggestions.length > 0 ? (
          <div className="rounded-lg border p-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.key}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => {
                  if (suggestion.kind === "reference" && suggestion.ref) {
                    selectReference(suggestion.ref);
                  } else if (suggestion.kind === "book" && suggestion.book) {
                    setReferenceInput(`${suggestion.book} `);
                  }
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {suggestion.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {suggestion.kind === "reference"
                      ? "Add this verse"
                      : "Complete book name"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {scope ? (
        // Scope packs auto-include every hearted verse inside their scope, so
        // there's nothing to "pick" from a hearted list — the only meaningful
        // action is discovering and hearting *new* verses within the scope.
        <VerseBrowsePicker
          scope={scope}
          isSelected={isSelected}
          isDisabled={isDisabled}
          isPending={isPending}
          onSelect={onSelect}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["hearted", "browse"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={activeTab === tab}
              >
                {tab === "hearted" ? "Hearted" : "Browse"}
              </button>
            ))}
          </div>

          {activeTab === "hearted" ? (
            <HeartedTab
              verses={filteredHearted}
              isLoading={isLoadingHearted}
              rawCount={scopedHeartedVerses.length}
              isScoped={scope !== undefined}
              search={heartedSearch}
              onSearchChange={setHeartedSearch}
              isSelected={isSelected}
              isDisabled={isDisabled}
              isPending={isPending}
              onSelect={onSelect}
            />
          ) : (
            <VerseBrowsePicker
              scope={scope}
              isSelected={isSelected}
              isDisabled={isDisabled}
              isPending={isPending}
              onSelect={onSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}

function HeartedTab({
  verses,
  isLoading,
  rawCount,
  isScoped,
  search,
  onSearchChange,
  isSelected,
  isDisabled,
  isPending,
  onSelect,
}: {
  verses: ReadonlyArray<HeartedVerse>;
  isLoading: boolean;
  rawCount: number;
  isScoped: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  isSelected: (verse: PackableVerse) => boolean;
  isDisabled?: (verse: PackableVerse) => boolean;
  isPending?: (verse: PackableVerse) => boolean;
  onSelect: (verse: PackableVerse) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rawCount === 0) {
    return (
      <div className="rounded-lg border px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {isScoped
            ? "No hearted verses in this scope yet. Type a reference above or browse to add one."
            : "No hearted verses yet. Type a reference above or browse to add one."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter hearted verses…"
          className="h-9 pl-8"
          aria-label="Filter hearted verses by reference"
        />
      </div>
      <ScrollArea className="h-56 rounded-lg border">
        {verses.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No hearted verses match “{search.trim()}”. Type the reference above
            to add it directly.
          </p>
        ) : (
          <ul className="space-y-0.5 p-1.5">
            {verses.map((verse) => {
              const selected = isSelected(verse);
              const disabled = isDisabled?.(verse) ?? false;
              const pending = isPending?.(verse) ?? false;
              return (
                <li key={verse.verseRefId}>
                  <button
                    type="button"
                    disabled={disabled || pending}
                    onClick={() => onSelect(verse)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted",
                      (disabled || pending) && "opacity-60",
                    )}
                    aria-pressed={selected}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {formatVerseRef(verse)}
                    </span>
                    {pending ? (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    ) : selected ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
