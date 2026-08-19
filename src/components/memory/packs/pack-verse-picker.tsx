import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { verseMatchesScope, type VerseScope } from "@/lib/verse-scope-match";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { sortByVerseRef } from "../../../../shared/compare-verse-refs";

import type { HeartedVerse, PackableVerse } from "./pack-verse-types";
import { VerseBrowsePicker } from "./verse-browse-picker";

type PickerTab = "hearted" | "browse";

interface PackVersePickerProps {
  heartedVerses: ReadonlyArray<HeartedVerse>;
  isLoadingHearted: boolean;
  scope?: VerseScope;
  confirmLabel?: string;
  defaultTab?: PickerTab;
  isSelected: (verse: PackableVerse) => boolean;
  isDisabled?: (verse: PackableVerse) => boolean;
  isPending?: (verse: PackableVerse) => boolean;
  onSelect: (verse: PackableVerse) => void;
}

export function PackVersePicker({
  heartedVerses,
  isLoadingHearted,
  scope,
  confirmLabel,
  defaultTab = "hearted",
  isSelected,
  isDisabled,
  isPending,
  onSelect,
}: PackVersePickerProps) {
  const [heartedSearch, setHeartedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PickerTab>(defaultTab);

  const scopedHeartedVerses = useMemo(() => {
    const scoped = scope
      ? heartedVerses.filter((verse) => verseMatchesScope(verse, scope))
      : heartedVerses;
    return sortByVerseRef(scoped);
  }, [heartedVerses, scope]);

  const filteredHearted = useMemo(() => {
    const q = heartedSearch.trim().toLowerCase();
    if (!q) return scopedHeartedVerses;
    return scopedHeartedVerses.filter((verse) =>
      formatVerseRef(verse).toLowerCase().includes(q),
    );
  }, [heartedSearch, scopedHeartedVerses]);

  return (
    <div className="space-y-4">
      {scope ? (
        // Scope packs auto-include every hearted verse inside their scope, so
        // there's nothing to "pick" from a hearted list — the only meaningful
        // action is discovering and hearting *new* verses within the scope.
        <VerseBrowsePicker
          scope={scope}
          heartedVerses={heartedVerses}
          confirmLabel={confirmLabel}
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
              heartedVerses={heartedVerses}
              confirmLabel={confirmLabel}
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
            ? "No hearted verses in this scope yet. Browse to add one."
            : "No hearted verses yet. Browse to add one."}
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
            No hearted verses match “{search.trim()}”. Browse to add it.
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
