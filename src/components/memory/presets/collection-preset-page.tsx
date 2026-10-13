import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { groupByBibleSection, type BibleSection } from "@/lib/bible-sections";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { MEMORIZE_LABEL, SUGGESTIONS_LABEL } from "@/lib/memory-copy";
import { cn } from "@/lib/utils";
import {
  chapterPresetTarget,
  chapterPresetVerseCount,
  formatChapterRange,
  formatPresetPassage,
  getMemoryPreset,
  type PresetPassage,
} from "../../../../shared/memory-presets";

function passageSpan(passage: PresetPassage): VerseSpan {
  return {
    book: passage.book,
    chapter: passage.chapter,
    startVerse: passage.startVerse,
    endVerse: passage.endVerse,
  };
}

export function CollectionPresetPage() {
  const { presetId } = useParams({ from: "/memory/presets/$presetId" });
  const preset = getMemoryPreset(presetId);
  if (!preset) {
    return (
      <PresetShell>
        <p className="text-sm text-muted-foreground">
          That suggestion isn&apos;t available.
        </p>
      </PresetShell>
    );
  }
  if (preset.kind === "chapter") {
    return <ChapterStart presetId={preset.id} />;
  }
  return <CollectionStart presetId={preset.id} />;
}

function PresetShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <Link
          to="/memory/presets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {SUGGESTIONS_LABEL}
        </Link>
      </header>
      <div className="mx-auto w-full max-w-3xl px-5 pt-6">{children}</div>
    </div>
  );
}

function ChapterStart({ presetId }: { presetId: string }) {
  const preset = getMemoryPreset(presetId);
  const memorizeSheet = useMemorizeSheet();
  if (!preset || preset.kind !== "chapter") return null;
  const verseCount = chapterPresetVerseCount(preset);

  return (
    <PresetShell>
      <h1 className="text-lg font-semibold tracking-tight">{preset.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatChapterRange(preset)} · {verseCount}{" "}
        {verseCount === 1 ? "verse" : "verses"}
      </p>
      <Button
        className="mt-4"
        onClick={() => memorizeSheet.open(chapterPresetTarget(preset))}
      >
        {MEMORIZE_LABEL}
      </Button>
    </PresetShell>
  );
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Every passage starts selected except the ones already memorizing, which
 * can't be selected. Select all, Deselect all, and the section checkboxes
 * act on the passages the search shows.
 */
function CollectionStart({ presetId }: { presetId: string }) {
  const preset = getMemoryPreset(presetId);
  const progress = useQuery(api.packs.presetProgress, {});
  const memorizeSheet = useMemorizeSheet();
  const [query, setQuery] = useState("");
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  if (!preset || preset.kind !== "collection") return null;

  const loading = progress === undefined;
  const progressRow = progress?.find((item) => item.presetId === presetId);
  const existingPackId = progressRow?.packId ?? null;
  const memorizingIds = new Set(progressRow?.memorizedPassageIds ?? []);
  const isMemorizing = (passage: PresetPassage) =>
    memorizingIds.has(passage.id);
  const isSelected = (passage: PresetPassage) =>
    !isMemorizing(passage) && !deselected.has(passage.id);

  const selectedPassages = preset.passages.filter(isSelected);
  const selectedCount = selectedPassages.length;
  const memorizingCount = preset.passages.filter(isMemorizing).length;
  const selectableCount = preset.passages.length - memorizingCount;

  const needle = query.trim().toLowerCase();
  const visible = preset.passages.filter((passage) => {
    if (!needle) return true;
    const label = formatPresetPassage(passage).toLowerCase();
    return (
      label.includes(needle) || passage.book.toLowerCase().includes(needle)
    );
  });
  const groups = groupByBibleSection(visible, (passage) => passage.book);
  const visibleSelectable = visible.filter((passage) => !isMemorizing(passage));
  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every(isSelected);

  const setSelected = (
    passages: readonly PresetPassage[],
    selected: boolean,
  ) => {
    setDeselected((current) => {
      const next = new Set(current);
      for (const passage of passages) {
        if (selected) next.delete(passage.id);
        else next.add(passage.id);
      }
      return next;
    });
  };

  /** A single passage is titled by its reference, a set by the collection. */
  const memorize = () => {
    if (selectedPassages.length === 0) return;
    memorizeSheet.open({
      kind: "spans",
      spans: selectedPassages.map(passageSpan),
      ...(selectedPassages.length > 1 ? { title: preset.title } : {}),
    });
  };

  const memorizeBlocker = loading
    ? null
    : selectableCount === 0
      ? "You're already memorizing every passage here"
      : selectedCount === 0
        ? "Select at least one passage"
        : null;
  const memorizeButton = (
    <Button disabled={loading || selectedCount === 0} onClick={memorize}>
      {MEMORIZE_LABEL} {selectedCount}
    </Button>
  );
  const description = `${preset.description} Deleting the pack later keeps the verses hearted.`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3 sm:py-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/memory/presets"
              aria-label={`Back to ${SUGGESTIONS_LABEL}`}
              className="-ml-1.5 inline-flex min-h-11 items-center gap-0.5 rounded-md pr-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-7"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {SUGGESTIONS_LABEL}
            </Link>
            {memorizeBlocker ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex rounded-md" tabIndex={0}>
                    {memorizeButton}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{memorizeBlocker}</TooltipContent>
              </Tooltip>
            ) : (
              memorizeButton
            )}
          </div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            {preset.title}
          </h1>
          <p className="mt-0.5 hidden max-w-3xl text-sm text-muted-foreground sm:block">
            {description}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by book or reference"
              aria-label="Search passages"
              className="h-9 min-w-0 flex-1 sm:max-w-xs"
            />
            <Button
              variant="outline"
              className="shrink-0"
              disabled={visibleSelectable.length === 0}
              onClick={() =>
                setSelected(visibleSelectable, !allVisibleSelected)
              }
            >
              {allVisibleSelected ? "Deselect all" : "Select all"}
            </Button>
          </div>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-5xl space-y-4 px-5 pt-4 pb-28 sm:pt-5">
          <p className="text-sm text-muted-foreground sm:hidden">
            {description}
          </p>
          {existingPackId ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
              <p className="text-sm">You already have this pack.</p>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link
                  to="/memory/$packId"
                  params={{ packId: existingPackId }}
                  search={{}}
                >
                  Open pack
                </Link>
              </Button>
            </div>
          ) : null}
          {memorizingCount > 0 && selectableCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {`${memorizingCount} ${plural(memorizingCount, "passage", "passages")} you're already memorizing ${plural(memorizingCount, "is", "are")} left out.`}
            </p>
          ) : null}
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No passages match that search.
            </p>
          ) : (
            groups.map(({ section, items }) => (
              <SectionCard
                key={section.id}
                section={section}
                passages={items}
                isMemorizing={isMemorizing}
                isSelected={isSelected}
                onSelect={setSelected}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SectionCard({
  section,
  passages,
  isMemorizing,
  isSelected,
  onSelect,
}: {
  section: BibleSection;
  passages: readonly PresetPassage[];
  isMemorizing: (passage: PresetPassage) => boolean;
  isSelected: (passage: PresetPassage) => boolean;
  onSelect: (passages: readonly PresetPassage[], selected: boolean) => void;
}) {
  const headingId = useId();
  const checkboxId = useId();
  const selectable = passages.filter((passage) => !isMemorizing(passage));
  const selectedCount = selectable.filter(isSelected).length;
  const memorizingCount = passages.length - selectable.length;
  const allSelected =
    selectable.length > 0 && selectedCount === selectable.length;
  const count =
    selectable.length === 0
      ? `${memorizingCount} memorizing`
      : `${selectedCount} of ${selectable.length}${
          memorizingCount > 0 ? ` · ${memorizingCount} memorizing` : ""
        }`;

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <IndeterminateCheckbox
          id={checkboxId}
          className="size-4 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          disabled={selectable.length === 0}
          onChange={() => onSelect(selectable, !allSelected)}
          aria-label={`All passages in ${section.title}`}
        />
        <h2 id={headingId} className="min-w-0 text-sm font-semibold">
          <label htmlFor={checkboxId} className="cursor-pointer">
            {section.title}
          </label>
        </h2>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <ul className="gap-x-4 p-2 sm:columns-2 lg:columns-3">
        {passages.map((passage) => (
          <PassageRow
            key={passage.id}
            label={formatPresetPassage(passage)}
            checked={isSelected(passage)}
            memorizing={isMemorizing(passage)}
            onToggle={() => onSelect([passage], !isSelected(passage))}
          />
        ))}
      </ul>
    </section>
  );
}

/** A checkbox that shows a dash when some, not all, of its group is chosen. */
function IndeterminateCheckbox({
  indeterminate,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { indeterminate: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" {...props} />;
}

function PassageRow({
  label,
  checked,
  memorizing,
  onToggle,
}: {
  label: string;
  checked: boolean;
  memorizing: boolean;
  onToggle: () => void;
}) {
  const tagId = useId();
  return (
    <li className="break-inside-avoid">
      <label
        className={cn(
          "flex min-h-10 items-center gap-2.5 rounded-md px-2 text-sm sm:min-h-8",
          memorizing
            ? "text-muted-foreground"
            : "cursor-pointer hover:bg-muted/60",
        )}
      >
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-primary"
          checked={checked}
          disabled={memorizing}
          onChange={onToggle}
          aria-label={label}
          aria-describedby={memorizing ? tagId : undefined}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        {memorizing ? (
          <span
            id={tagId}
            className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
          >
            Memorizing
          </span>
        ) : null}
      </label>
    </li>
  );
}
