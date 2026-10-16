import { useId, type RefObject } from "react";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import {
  ChevronDown,
  Layers,
  LayersPlus,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { MemorizePackChoice } from "@/hooks/use-join-memorize-pack";
import { MAX_PACK_NAME_LENGTH } from "@/lib/memorize-status";

/**
 * "Add to a pack (optional)" under a verse's plan. Picks one of your custom
 * packs, or New pack… to name one right here, and says what Start will do
 * with it.
 */
export function MemorizePackChoiceRow({
  choice,
  onChange,
  verseTitle,
  now,
  onSubmit,
  error,
  nameInputRef,
}: {
  choice: MemorizePackChoice | null;
  onChange: (choice: MemorizePackChoice | null) => void;
  /** "Genesis 1:5", for the line that says what Start does. */
  verseTitle: string;
  now: number;
  /** Enter in the new pack's name. */
  onSubmit: () => void;
  /** Why Start stopped, e.g. a new pack with no name yet. */
  error?: string | null;
  nameInputRef?: RefObject<HTMLInputElement | null>;
}) {
  const nameId = useId();
  const noteId = useId();
  const newName = choice?.kind === "new" ? choice.name.trim() : "";

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-11 min-w-0 gap-1.5 text-muted-foreground sm:h-8"
            >
              {choice?.kind === "pack" ? (
                <>
                  <Layers aria-hidden />
                  <span className="truncate text-foreground">
                    {choice.name}
                  </span>
                </>
              ) : choice?.kind === "new" ? (
                <>
                  <LayersPlus aria-hidden />
                  <span className="text-foreground">New pack</span>
                </>
              ) : (
                <>
                  <LayersPlus aria-hidden />
                  <span>
                    Add to a pack{" "}
                    <span className="font-normal">(optional)</span>
                  </span>
                </>
              )}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64"
            data-passage-dismiss-exempt
          >
            <PackChoiceItems now={now} choice={choice} onChange={onChange} />
          </DropdownMenuContent>
        </DropdownMenu>
        {choice ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-sm:size-11"
            aria-label="Don't add to a pack"
            onClick={() => onChange(null)}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      {choice?.kind === "new" ? (
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            New pack name
          </label>
          <Input
            ref={nameInputRef}
            id={nameId}
            autoFocus
            value={choice.name}
            maxLength={MAX_PACK_NAME_LENGTH}
            placeholder="e.g. Verses on hope"
            className="h-11 sm:h-9"
            aria-invalid={error ? true : undefined}
            aria-describedby={noteId}
            onChange={(event) =>
              onChange({ kind: "new", name: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
        </div>
      ) : null}
      {choice ? (
        <p
          id={noteId}
          role={error ? "alert" : undefined}
          className={
            error
              ? "text-xs text-destructive"
              : "flex items-center gap-1.5 text-xs text-muted-foreground"
          }
        >
          {error ?? (
            <>
              <Plus aria-hidden className="size-3.5 shrink-0" />
              {choice.kind === "pack" ? (
                <span>
                  Starting adds {verseTitle} to{" "}
                  <span className="font-medium text-foreground">
                    {choice.name}
                  </span>
                  .
                </span>
              ) : newName ? (
                <span>
                  Starting creates the pack{" "}
                  <span className="font-medium text-foreground">
                    “{newName}”
                  </span>{" "}
                  with {verseTitle}.
                </span>
              ) : (
                <span>
                  Name it, and starting creates the pack with {verseTitle}.
                </span>
              )}
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

/** The open menu. Mounted only while open, so the sheet reads no packs until asked. */
function PackChoiceItems({
  now,
  choice,
  onChange,
}: {
  now: number;
  choice: MemorizePackChoice | null;
  onChange: (choice: MemorizePackChoice | null) => void;
}) {
  const tzOffsetMinutes = new Date(now).getTimezoneOffset();
  const { results, status, loadMore } = usePaginatedQuery(
    api.packs.listMine,
    { now, tzOffsetMinutes },
    { initialNumItems: 25 },
  );
  const packs = results.filter((pack) => pack.kind === "custom");

  return (
    <>
      {status === "LoadingFirstPage" ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : packs.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">No packs yet.</p>
      ) : (
        <DropdownMenuRadioGroup
          value={choice?.kind === "pack" ? String(choice.packId) : ""}
          onValueChange={(value) => {
            const pack = packs.find((candidate) => candidate._id === value);
            if (pack) {
              onChange({ kind: "pack", packId: pack._id, name: pack.name });
            }
          }}
        >
          {packs.map((pack) => (
            <DropdownMenuRadioItem key={pack._id} value={String(pack._id)}>
              <span className="truncate">{pack.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )}
      {status === "CanLoadMore" ? (
        <DropdownMenuItem
          className="justify-center text-muted-foreground"
          onSelect={(event) => {
            event.preventDefault();
            loadMore(25);
          }}
        >
          Load more packs
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() =>
          onChange(choice?.kind === "new" ? choice : { kind: "new", name: "" })
        }
      >
        <Plus aria-hidden />
        New pack…
      </DropdownMenuItem>
    </>
  );
}
