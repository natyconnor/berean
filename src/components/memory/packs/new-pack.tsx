import { useId, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { MemoryPageShell } from "@/components/memory/drawer/memory-page-shell";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMemoryExit } from "@/hooks/use-memory-back";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { MAX_PACK_NAME_LENGTH, spanKey } from "@/lib/memorize-status";
import { resolveMemorizeTarget, spanDisplayTitle } from "@/lib/memorize-target";
import { memorizeTitleLabel, TODAY_LABEL } from "@/lib/memory-copy";
import {
  canCreateNewPack,
  NEW_PACK_CREATE_HINT,
  newPackPlan,
} from "@/lib/memory-new-pack";
import { memoryPanelFullPagePath } from "@/lib/memory-panel";
import { moveItem } from "@/lib/pack-order";
import { cn } from "@/lib/utils";

import { DragHandle, MoveAnnouncer, RowEditControls } from "./reorder-controls";
import {
  dragRowClassName,
  moveAnnouncement,
  useDragReorder,
} from "./use-drag-reorder";
import { VerseSearchAdd } from "./verse-search-add";

const sectionHeadingClassName =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

/**
 * New pack: name it, add verses by reference or from your hearts, order
 * them, and create. Creating memorizes every verse (and hearts it), then
 * opens the pack's page.
 */
export function NewPack({
  startSpan,
  returnTo,
}: {
  /** A verse to start with (Add to pack → New pack…). */
  startSpan: VerseSpan | null;
  /** Where Cancel goes. */
  returnTo?: string;
}) {
  const navigate = useNavigate();
  const sheet = useMemorizeSheet();
  const exit = useMemoryExit(returnTo);
  const createAndMemorize = useMutation(api.packs.createAndMemorize);
  const createLock = useSubmitLock();
  const nameId = useId();
  const listHeadingId = useId();
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const [name, setName] = useState("");
  const [picked, setPicked] = useState<VerseSpan[]>(() =>
    startSpan ? [startSpan] : [],
  );
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pickedKeys = new Set(picked.map(spanKey));
  const ready = canCreateNewPack(name, picked.length);
  const plan = newPackPlan(picked.length);
  const resolved =
    picked.length > 0
      ? resolveMemorizeTarget({ kind: "spans", spans: picked })
      : null;
  const passage = resolved?.mode === "passage" ? resolved : null;

  const add = (span: VerseSpan) => {
    if (pickedKeys.has(spanKey(span))) return;
    setPicked((current) => [...current, span]);
  };
  const remove = (index: number) => {
    setPicked((current) => current.filter((_, at) => at !== index));
    listHeadingRef.current?.focus();
  };
  const move = (from: number, to: number) => {
    const span = picked[from];
    if (!span || to < 0 || to >= picked.length || to === from) return;
    setPicked(moveItem(picked, from, to));
    setAnnouncement(
      moveAnnouncement(spanDisplayTitle(span), to, picked.length),
    );
  };
  const drag = useDragReorder(move);

  const create = () =>
    createLock.submit(async () => {
      if (!ready) return;
      setError(null);
      const packName = name.trim();
      try {
        const { packId } = await createAndMemorize({
          name: packName,
          spans: picked,
          now: Date.now(),
        });
        toast.success(`${packName} is in Today.`);
        void navigate({
          href: memoryPanelFullPagePath({ kind: "pack", packId }),
          replace: true,
        });
      } catch {
        setError("Couldn't create the pack. Please try again.");
      }
    });

  const createButton = (
    <Button
      type="button"
      className="h-11 w-full sm:h-10"
      disabled={!ready}
      loading={createLock.pending}
      onClick={create}
    >
      Create pack
    </Button>
  );

  return (
    <MemoryPageShell
      back={{ label: TODAY_LABEL, href: "/memory" }}
      title="New pack"
      kind="pack"
      subtitle="Pick verses for a theme, a group, or a season"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:gap-y-0">
        <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-5 lg:row-span-2">
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="text-sm font-semibold">
              Name
            </label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  create();
                }
              }}
              placeholder="e.g. Verses on hope"
              maxLength={MAX_PACK_NAME_LENGTH}
              autoComplete="off"
              className="h-10"
            />
          </div>
          <VerseSearchAdd addedKeys={pickedKeys} onAdd={add} />
        </div>

        <section
          aria-labelledby={listHeadingId}
          className="space-y-3 rounded-xl border bg-card p-4 sm:p-5 lg:rounded-b-none lg:border-b-0 lg:pb-3"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2
              ref={listHeadingRef}
              id={listHeadingId}
              tabIndex={-1}
              className={cn(sectionHeadingClassName, "outline-none")}
            >
              In this pack
            </h2>
            {picked.length > 1 ? (
              <span className="hidden text-xs text-muted-foreground pointer-fine:inline">
                Drag to reorder
              </span>
            ) : null}
          </div>

          {picked.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing here yet. Search for a reference or pick from your hearts.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {picked.map((span, index) => {
                const label = spanDisplayTitle(span);
                return (
                  <li
                    key={spanKey(span)}
                    {...drag.rowProps(index)}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5",
                      dragRowClassName(drag.rowState(index, picked.length)),
                    )}
                  >
                    <DragHandle {...drag.handleProps(index)} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {label}
                    </span>
                    <RowEditControls
                      label={label}
                      index={index}
                      count={picked.length}
                      onMove={move}
                      onRemove={() => remove(index)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <MoveAnnouncer message={announcement} />

          {passage ? (
            <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
              This is all of {passage.title}. Memorize it as a passage instead?{" "}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 font-semibold"
                onClick={() =>
                  sheet.open({
                    kind: "chapters",
                    book: passage.book,
                    startChapter: passage.startChapter,
                    endChapter: passage.endChapter,
                  })
                }
              >
                {memorizeTitleLabel(passage.title)}
              </Button>
            </p>
          ) : null}

          {plan ? (
            <div className="rounded-lg bg-muted/70 px-3.5 py-3">
              <p className="text-sm font-semibold">{plan.headline}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {plan.detail}
              </p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            The first steps show up in Today. Memorizing also adds these verses
            to your hearts.
          </p>
        </section>

        {/* Below lg this sticks above the mode dock; in flow it ends the page, so the last verse is never under it. */}
        <div className="space-y-1.5 max-lg:sticky max-lg:bottom-20 max-lg:z-10 max-lg:-mx-5 max-lg:border-t max-lg:bg-background/95 max-lg:px-5 max-lg:py-3 max-lg:backdrop-blur lg:col-start-2 lg:self-start lg:rounded-b-xl lg:border lg:border-t-0 lg:bg-card lg:px-5 lg:pb-5">
          {ready ? (
            createButton
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block w-full" tabIndex={0}>
                  {createButton}
                </span>
              </TooltipTrigger>
              <TooltipContent>{NEW_PACK_CREATE_HINT}</TooltipContent>
            </Tooltip>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-muted-foreground sm:h-9"
            onClick={exit.go}
          >
            Cancel
          </Button>
          {error ? (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </MemoryPageShell>
  );
}
