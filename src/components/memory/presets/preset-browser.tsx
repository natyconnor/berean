import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const navigate = useNavigate();
  const progress = useQuery(api.packs.presetProgress, {});
  const startPreset = useMutation(api.packs.startPreset);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function memorizeChapter(preset: ChapterPreset) {
    setError(null);
    setPendingId(preset.id);
    try {
      const result = await startPreset({ presetId: preset.id });
      await navigate({
        to: "/memory/$packId",
        params: { packId: result.packId },
        search: result.created ? { startPassage: true } : {},
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <Link
          to="/memory"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Memory
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Presets</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Start a chapter as a passage, or open a verse collection and choose
          what goes in the pack.
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chapters or collections"
          className="mt-3 max-w-md"
          aria-label="Search presets"
        />
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-10 px-5 pt-6 pb-24">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Collections
            </h2>
            {collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No collections match that search.
              </p>
            ) : (
              <ul className="space-y-2">
                {collections.map((preset) => {
                  const row = progress?.find(
                    (item) => item.presetId === preset.id,
                  );
                  const hearted = row?.heartedPassageIds.length ?? 0;
                  const existingPackId = row?.packId ?? null;
                  const fullyHearted =
                    progress !== undefined && hearted >= preset.passages.length;
                  const alreadyAdded = Boolean(existingPackId) || fullyHearted;
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
                                ? "This collection is already a pack."
                                : "Every passage in this collection is already in your library."
                              : preset.description}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {preset.passages.length} passages
                            {!alreadyAdded && hearted > 0
                              ? ` · ${hearted} already in your library`
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
                              Continue
                            </Link>
                          </Button>
                        ) : fullyHearted ? (
                          <span className="shrink-0 pt-1 text-xs font-medium text-muted-foreground">
                            Added
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

          <section className="space-y-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Chapters
            </h2>
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No chapters match that search.
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
                                  Continue
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="gap-1.5"
                                disabled={pendingId !== null}
                                onClick={() => void memorizeChapter(preset)}
                              >
                                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                                {pendingId === preset.id
                                  ? "Starting…"
                                  : "Memorize"}
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
        </div>
      </ScrollArea>
    </div>
  );
}
