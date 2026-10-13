import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CardReference } from "@/components/study/study-card-model";
import { withReturn } from "@/lib/memory-return";
import { newPackHref } from "@/lib/memory-new-pack";
import { verseMatchesScope } from "@/lib/verse-scope-match";

type ListedPack = FunctionReturnType<typeof api.packs.listMine>["page"][number];

type PackOption =
  | { kind: "add"; pack: ListedPack }
  | { kind: "contains"; pack: ListedPack; hint: string };

/**
 * Where this verse can go. Custom packs take it; a passage or chapter pack
 * already holds every verse in its chapters, so one that covers this verse is
 * shown but disabled, and one that doesn't is left out.
 */
function packOption(
  pack: ListedPack,
  reference: CardReference,
): PackOption | null {
  if (pack.kind === "custom") return { kind: "add", pack };
  if (!pack.scope || !verseMatchesScope(reference, pack.scope)) return null;
  return {
    kind: "contains",
    pack,
    hint:
      pack.summary.kind === "passage"
        ? "Already part of this passage"
        : "Already part of this pack",
  };
}

/**
 * Add a verse you are memorizing to one of your packs, or start a new pack
 * with it. Adding hearts the verse on the server (`packs.addVerse`).
 */
export function AddToPack({
  reference,
  now,
  returnTo,
}: {
  reference: CardReference;
  now: number;
  /** Where New pack's Cancel comes back to. */
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const { results, status, loadMore } = usePaginatedQuery(
    api.packs.listMine,
    { now, tzOffsetMinutes },
    { initialNumItems: 25 },
  );
  const addVerse = useMutation(api.packs.addVerse);

  const options = results.flatMap((pack) => {
    const option = packOption(pack, reference);
    return option ? [option] : [];
  });

  const [pendingId, setPendingId] = useState<Id<"packs"> | null>(null);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(packId: Id<"packs">) {
    if (pendingId) return;
    setError(null);
    setPendingId(packId);
    try {
      await addVerse({
        id: packId,
        book: reference.book,
        chapter: reference.chapter,
        startVerse: reference.startVerse,
        endVerse: reference.endVerse,
      });
      setAddedIds((prev) => new Set(prev).add(String(packId)));
    } catch {
      setError("Couldn't add to that pack. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 max-sm:h-11">
          <Plus className="h-4 w-4" aria-hidden />
          Add to pack
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1.5">
        <InternalLink
          href={withReturn(newPackHref(reference), returnTo)}
          className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
        >
          <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
          New pack…
        </InternalLink>
        <div aria-hidden className="mx-1 my-1 h-px bg-border" />
        {status === "LoadingFirstPage" ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : options.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No packs yet.
          </p>
        ) : (
          <div className="space-y-1">
            {error ? (
              <p role="alert" className="px-2 py-1 text-xs text-destructive">
                {error}
              </p>
            ) : null}
            <ScrollArea className="max-h-56">
              <ul className="space-y-0.5 pr-1">
                {options.map((option) => (
                  <li key={option.pack._id}>
                    {option.kind === "contains" ? (
                      <button
                        type="button"
                        disabled
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {option.pack.name}
                        </span>
                        <span className="shrink-0 text-xs">{option.hint}</span>
                      </button>
                    ) : (
                      <AddOptionButton
                        name={option.pack.name}
                        pending={pendingId === option.pack._id}
                        added={addedIds.has(String(option.pack._id))}
                        onAdd={() => void handleAdd(option.pack._id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
        {status === "CanLoadMore" ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => loadMore(25)}
          >
            Load more packs
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function AddOptionButton({
  name,
  pending,
  added,
  onAdd,
}: {
  name: string;
  pending: boolean;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending || added}
      onClick={onAdd}
      className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-70"
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {pending ? (
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : added ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Added
        </span>
      ) : (
        <Plus
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
    </button>
  );
}
