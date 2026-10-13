import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MEMORIZE_LABEL,
  SUGGESTIONS_LABEL,
  TODAY_LABEL,
} from "@/lib/memory-copy";
import {
  CHAPTER_PRESET_GROUPS,
  chapterPresetVerseCount,
  chapterPresets,
  collectionPresets,
  formatChapterRange,
  type ChapterPreset,
  type ChapterPresetGroup,
} from "../../../../shared/memory-presets";

export function PresetBrowser() {
  const progress = useQuery(api.packs.presetProgress, {});
  const memorizeSheet = useMemorizeSheet();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const collections = collectionPresets().filter((preset) => {
    if (!needle) return true;
    return (
      preset.title.toLowerCase().includes(needle) ||
      preset.description.toLowerCase().includes(needle)
    );
  });
  const chapters = chapterPresets().filter((preset) => {
    if (!needle) return true;
    return (
      preset.title.toLowerCase().includes(needle) ||
      formatChapterRange(preset).toLowerCase().includes(needle) ||
      preset.book.toLowerCase().includes(needle)
    );
  });
  const chaptersByGroup = new Map<ChapterPresetGroup, ChapterPreset[]>();
  for (const group of CHAPTER_PRESET_GROUPS) chaptersByGroup.set(group, []);
  for (const preset of chapters) {
    chaptersByGroup.get(preset.group)?.push(preset);
  }

  function memorizeChapter(preset: ChapterPreset) {
    memorizeSheet.open({
      kind: "chapters",
      book: preset.book,
      startChapter: preset.startChapter,
      endChapter: preset.endChapter,
      presetId: preset.id,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <Link
          to="/memory"
          aria-label={`Back to ${TODAY_LABEL}`}
          className="-ml-1.5 mb-1 inline-flex min-h-11 items-center gap-0.5 rounded-md pr-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-7"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {TODAY_LABEL}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          {SUGGESTIONS_LABEL}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Popular passages and verse packs to memorize.
        </p>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search passages and packs"
          className="mt-3 max-w-md"
          aria-label="Search suggestions"
        />
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-10 px-5 pt-6 pb-24">
          <section className="space-y-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Passages
            </h2>
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No passages match that search.
              </p>
            ) : (
              CHAPTER_PRESET_GROUPS.map((group) => {
                const presets = chaptersByGroup.get(group) ?? [];
                if (presets.length === 0) return null;
                return (
                  <div key={group} className="space-y-2">
                    <h3 className="text-sm font-medium">{group}</h3>
                    <ul className="space-y-1.5">
                      {presets.map((preset) => {
                        const row = progress?.find(
                          (item) => item.presetId === preset.id,
                        );
                        const existing = row?.packId;
                        const verseCount = chapterPresetVerseCount(preset);
                        return (
                          <li
                            key={preset.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {preset.title}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {formatChapterRange(preset)} · {verseCount}{" "}
                                {verseCount === 1 ? "verse" : "verses"}
                              </span>
                            </span>
                            {existing ? (
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  to="/memory/$packId"
                                  params={{ packId: existing }}
                                  search={{}}
                                >
                                  Open
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => memorizeChapter(preset)}
                              >
                                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                                {MEMORIZE_LABEL}
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Packs
            </h2>
            {collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No packs match that search.
              </p>
            ) : (
              <ul className="space-y-2">
                {collections.map((preset) => {
                  const row = progress?.find(
                    (item) => item.presetId === preset.id,
                  );
                  const memorized = row?.memorizedPassageIds.length ?? 0;
                  const existingPackId = row?.packId ?? null;
                  const fullyMemorized =
                    progress !== undefined &&
                    memorized >= preset.passages.length;
                  const alreadyAdded =
                    Boolean(existingPackId) || fullyMemorized;
                  return (
                    <li
                      key={preset.id}
                      className="rounded-xl border bg-card px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{preset.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {alreadyAdded
                              ? existingPackId
                                ? "You already have this pack."
                                : "You're already memorizing every verse in it."
                              : preset.description}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {preset.passages.length} passages
                            {!alreadyAdded && memorized > 0
                              ? ` · ${memorized} already memorizing`
                              : ""}
                          </p>
                        </div>
                        {existingPackId ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                          >
                            <Link
                              to="/memory/$packId"
                              params={{ packId: existingPackId }}
                              search={{}}
                            >
                              Open
                            </Link>
                          </Button>
                        ) : fullyMemorized ? (
                          <span className="shrink-0 pt-1 text-xs font-medium text-muted-foreground">
                            Memorizing
                          </span>
                        ) : progress === undefined ? null : (
                          <Button
                            asChild
                            size="sm"
                            className="shrink-0 gap-1.5"
                          >
                            <Link
                              to="/memory/presets/$presetId"
                              params={{ presetId: preset.id }}
                            >
                              Open
                            </Link>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
