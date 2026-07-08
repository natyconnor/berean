import { useMemo, useState } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";

import type { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";

export interface HeartedVerse {
  verseRefId: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

interface HeartedVersePickerProps {
  verses: ReadonlyArray<HeartedVerse>;
  isLoading: boolean;
  /** Whether a row currently reads as selected (checkmark). */
  isSelected: (verseRefId: Id<"verseRefs">) => boolean;
  /** Whether a row is disabled (e.g. already a member, or a pending add). */
  isDisabled?: (verseRefId: Id<"verseRefs">) => boolean;
  /** Whether a row is mid-flight (spinner). */
  isPending?: (verseRefId: Id<"verseRefs">) => boolean;
  onSelect: (verse: HeartedVerse) => void;
  emptyLabel?: string;
}

/**
 * A filterable list of the user's hearted verses. Custom packs draw their
 * members from hearted verses, so this is the shared picker used both when
 * staging a new custom pack and when adding verses to an existing one.
 */
export function HeartedVersePicker({
  verses,
  isLoading,
  isSelected,
  isDisabled,
  isPending,
  onSelect,
  emptyLabel = "No hearted verses yet. Heart a verse in the reader first.",
}: HeartedVersePickerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return verses;
    return verses.filter((v) => formatVerseRef(v).toLowerCase().includes(q));
  }, [verses, search]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (verses.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter hearted verses…"
          className="h-9 pl-8"
          aria-label="Filter hearted verses by reference"
        />
      </div>
      <ScrollArea className="h-56 rounded-lg border">
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No hearted verses match “{search.trim()}”.
          </p>
        ) : (
          <ul className="space-y-0.5 p-1.5">
            {filtered.map((verse) => {
              const selected = isSelected(verse.verseRefId);
              const disabled = isDisabled?.(verse.verseRefId) ?? false;
              const pending = isPending?.(verse.verseRefId) ?? false;
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
                    ) : (
                      <Plus
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
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
