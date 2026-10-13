import { useState, type ReactNode } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { MEMORIZE_LABEL, SUGGESTIONS_LABEL } from "@/lib/memory-copy";
import {
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
        onClick={() =>
          memorizeSheet.open({
            kind: "chapters",
            book: preset.book,
            startChapter: preset.startChapter,
            endChapter: preset.endChapter,
            presetId: preset.id,
          })
        }
      >
        {MEMORIZE_LABEL}
      </Button>
    </PresetShell>
  );
}

function CollectionStart({ presetId }: { presetId: string }) {
  const preset = getMemoryPreset(presetId);
  const progress = useQuery(api.packs.presetProgress, {});
  const memorizeSheet = useMemorizeSheet();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const progressRow = progress?.find((item) => item.presetId === presetId);
  const existingPackId = progressRow?.packId ?? null;
  const memorized = new Set(progressRow?.memorizedPassageIds ?? []);

  if (!preset || preset.kind !== "collection") return null;

  const needle = query.trim().toLowerCase();
  const visible = preset.passages.filter((passage) => {
    if (!needle) return true;
    const label = formatPresetPassage(passage).toLowerCase();
    return (
      label.includes(needle) || passage.book.toLowerCase().includes(needle)
    );
  });

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** A single passage is titled by its reference, a set by the collection. */
  const memorize = (mode: "all" | "subset") => {
    const passages =
      mode === "all"
        ? preset.passages
        : preset.passages.filter((passage) => selected.has(passage.id));
    memorizeSheet.open({
      kind: "spans",
      spans: passages.map(passageSpan),
      ...(passages.length > 1 ? { title: preset.title } : {}),
    });
  };

  const selectedCount = selected.size;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <Link
          to="/memory/presets"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {SUGGESTIONS_LABEL}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{preset.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {preset.description} Deleting the pack later keeps the verses hearted.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by book or reference"
            aria-label="Search passages"
            className="sm:max-w-xs"
          />
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="mx-auto max-w-3xl space-y-1 px-5 pt-4 pb-28">
          {visible.map((passage) => (
            <PassageRow
              key={passage.id}
              label={formatPresetPassage(passage)}
              checked={selected.has(passage.id)}
              inLibrary={memorized.has(passage.id)}
              onToggle={() => toggle(passage.id)}
            />
          ))}
          {visible.length === 0 ? (
            <li className="py-8 text-sm text-muted-foreground">
              No passages match that search.
            </li>
          ) : null}
        </ul>
      </ScrollArea>
      <div className="shrink-0 border-t bg-background px-5 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selectedCount === 0
              ? `${preset.passages.length} passages`
              : `${selectedCount} selected`}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedCount > 0 ? (
              <Button onClick={() => memorize("subset")}>
                {MEMORIZE_LABEL} {selectedCount}
              </Button>
            ) : existingPackId ? (
              <Button asChild>
                <Link
                  to="/memory/$packId"
                  params={{ packId: existingPackId }}
                  search={{}}
                >
                  Open
                </Link>
              </Button>
            ) : (
              <Button
                disabled={progress === undefined}
                onClick={() => memorize("all")}
              >
                {MEMORIZE_LABEL} all
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PassageRow({
  label,
  checked,
  inLibrary,
  onToggle,
}: {
  label: string;
  checked: boolean;
  inLibrary: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={onToggle}
          aria-label={label}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {label}
            {inLibrary ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                In your library
              </span>
            ) : null}
          </span>
        </span>
      </label>
    </li>
  );
}
