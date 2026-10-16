import { useState, type FormEvent } from "react";
import { Check, LayersPlus, Loader2, Plus } from "lucide-react";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { InternalLink } from "@/components/memory/internal-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipButton } from "@/components/ui/tooltip-button";
import type { CardReference } from "@/components/study/study-card-model";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { MAX_PACK_NAME_LENGTH } from "@/lib/memorize-status";
import { withReturn } from "@/lib/memory-return";
import { newPackHref } from "@/lib/memory-new-pack";
import { spanInPackScope } from "@/lib/passage-range";
import { cn } from "@/lib/utils";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

type ListedPack = FunctionReturnType<typeof api.packs.listMine>["page"][number];

type PackOption =
  | { kind: "add"; pack: ListedPack }
  | { kind: "contains"; pack: ListedPack; hint: string };

/**
 * Where this verse can go. Custom packs take it; a passage already holds every
 * verse in its range, so one that covers this verse is shown but disabled.
 * Other packs are left out.
 */
function packOption(
  pack: ListedPack,
  reference: CardReference,
): PackOption | null {
  if (pack.kind === "custom") return { kind: "add", pack };
  if (
    pack.summary.kind !== "passage" ||
    !pack.scope ||
    !spanInPackScope(reference, pack.scope, pack.passageRange)
  ) {
    return null;
  }
  return { kind: "contains", pack, hint: "Already part of this passage" };
}

/**
 * Add a verse you are memorizing to one of your packs, or start a new pack
 * with it. Adding hearts the verse on the server (`packs.addVerse`).
 */
export function AddToPack({
  reference,
  now,
  returnTo,
  variant = "button",
  className,
}: {
  reference: CardReference;
  now: number;
  /**
   * When set, New pack… opens the New pack page and its Cancel comes back
   * here. Without it, New pack… names the pack right in the picker.
   */
  returnTo?: string;
  /** `icon`: a compact row action, for session summaries. */
  variant?: "button" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Kept while the picker is closed: the pack list doesn't say which custom
  // packs already hold this verse.
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const label = `Add ${formatVerseRefTitle(reference)} to a pack`;

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <TooltipButton
            tooltip={label}
            aria-label={label}
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0 text-muted-foreground", className)}
          >
            <LayersPlus aria-hidden />
          </TooltipButton>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5 max-sm:h-11", className)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add to pack
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-1.5"
        data-passage-dismiss-exempt
      >
        <AddToPackMenu
          reference={reference}
          now={now}
          returnTo={returnTo}
          addedIds={addedIds}
          onAdded={(packId) =>
            setAddedIds((prev) => new Set(prev).add(String(packId)))
          }
        />
      </PopoverContent>
    </Popover>
  );
}

/** The open picker. Mounted only while open, so a closed one reads nothing. */
function AddToPackMenu({
  reference,
  now,
  returnTo,
  addedIds,
  onAdded,
}: {
  reference: CardReference;
  now: number;
  returnTo?: string;
  addedIds: ReadonlySet<string>;
  onAdded: (packId: Id<"packs">) => void;
}) {
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const { results, status, loadMore } = usePaginatedQuery(
    api.packs.listMine,
    { now, tzOffsetMinutes },
    { initialNumItems: 25 },
  );
  const addVerse = useMutation(api.packs.addVerse);
  const createAndMemorize = useMutation(api.packs.createAndMemorize);

  const options = results.flatMap((pack) => {
    const option = packOption(pack, reference);
    return option ? [option] : [];
  });

  const [pendingId, setPendingId] = useState<Id<"packs"> | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const createLock = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const busy = pendingId !== null || createLock.pending;

  const span = {
    book: reference.book,
    chapter: reference.chapter,
    startVerse: reference.startVerse,
    endVerse: reference.endVerse,
  };

  async function handleAdd(packId: Id<"packs">) {
    if (busy) return;
    setError(null);
    setPendingId(packId);
    try {
      await addVerse({ id: packId, ...span });
      onAdded(packId);
    } catch {
      setError("Couldn't add to that pack. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pendingId !== null) return;
    createLock.submit(async () => {
      setError(null);
      try {
        const { packId } = await createAndMemorize({
          name: trimmed,
          spans: [span],
          now: Date.now(),
        });
        onAdded(packId);
        setNaming(false);
        setName("");
      } catch {
        setError("Couldn't make that pack. Please try again.");
      }
    });
  }

  const rowClassName =
    "flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:bg-muted";

  return (
    <>
      {returnTo !== undefined ? (
        <InternalLink
          href={withReturn(newPackHref(reference), returnTo)}
          className={rowClassName}
        >
          <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
          New pack…
        </InternalLink>
      ) : naming ? (
        <form
          onSubmit={handleCreate}
          className="flex items-center gap-1.5 p-0.5"
        >
          <Input
            autoFocus
            aria-label="New pack name"
            value={name}
            maxLength={MAX_PACK_NAME_LENGTH}
            placeholder="e.g. Verses on hope"
            className="h-8"
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            loading={createLock.pending}
            disabled={name.trim().length === 0 || pendingId !== null}
          >
            Create
          </Button>
        </form>
      ) : (
        <button
          type="button"
          className={rowClassName}
          onClick={() => setNaming(true)}
        >
          <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
          New pack…
        </button>
      )}
      <div aria-hidden className="mx-1 my-1 h-px bg-border" />
      {error ? (
        <p role="alert" className="px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {status === "LoadingFirstPage" ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : options.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">No packs yet.</p>
      ) : (
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
    </>
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
