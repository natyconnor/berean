import { useMemo, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react/cache";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CardReference } from "@/components/study/study-card-model";

/**
 * A compact control (used from the Library drill-down) that adds the given
 * verse to one of the user's custom packs. Adding hearts the verse as a
 * server-side invariant (`packs.addVerse`), so no client-side heart is needed.
 */
export function AddToPack({
  reference,
  now,
}: {
  reference: CardReference;
  now: number;
}) {
  const [open, setOpen] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.packs.listMine,
    { now },
    { initialNumItems: 25 },
  );
  const addVerse = useMutation(api.packs.addVerse);

  const customPacks = useMemo(
    () => results.filter((pack) => pack.kind === "custom"),
    [results],
  );

  const [pendingId, setPendingId] = useState<Id<"packs"> | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  async function handleAdd(packId: Id<"packs">) {
    if (pendingId) return;
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
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden />
          Add to pack
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        {status === "LoadingFirstPage" ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : customPacks.length === 0 ? (
          <div className="space-y-3 px-1 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              No custom packs yet. Create one to hand-pick verses.
            </p>
            <Button asChild size="sm" className="w-full gap-1.5">
              <Link to="/memory/new">
                <Plus className="h-4 w-4" aria-hidden />
                New pack
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Custom packs
            </p>
            <ScrollArea className="max-h-56">
              <ul className="space-y-0.5 pr-1">
                {customPacks.map((pack) => {
                  const added = addedIds.has(String(pack._id));
                  const isPending = pendingId === pack._id;
                  return (
                    <li key={pack._id}>
                      <button
                        type="button"
                        disabled={isPending || added}
                        onClick={() => void handleAdd(pack._id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-70"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {pack.name}
                        </span>
                        {isPending ? (
                          <Loader2
                            className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                            aria-hidden
                          />
                        ) : added ? (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-primary"
                            aria-hidden
                          />
                        ) : (
                          <Plus
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
            {status === "CanLoadMore" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => loadMore(25)}
              >
                Load more packs
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
