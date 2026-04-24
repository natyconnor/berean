import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import { TagFilterControl } from "@/components/search/tag-filter-control";
import { StudyScopePresets } from "./study-scope-presets";
import {
  StudyScopeBookPicker,
  type ChapterRange,
} from "./study-scope-book-picker";
import { formatScopeSummary, type StudyScope } from "./study-scope-summary";
import type { TagMatchMode } from "@/lib/tag-utils";

export function StudyScopeBuilder() {
  const navigate = useNavigate();
  const resolveTagStyle = useStarterTagBadgeStyle();
  const catalog = useQuery(api.tags.listCatalog);
  const createSession = useMutation(api.studySessions.create);

  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [chapterRanges, setChapterRanges] = useState<Map<string, ChapterRange>>(
    new Map(),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>("any");
  const [isCreating, setIsCreating] = useState(false);

  const availableTags = useMemo(
    () => (catalog ?? []).map((entry) => entry.tag),
    [catalog],
  );

  const scope: StudyScope = useMemo(
    () => ({
      books: selectedBooks,
      chapterRanges:
        chapterRanges.size > 0
          ? Array.from(chapterRanges.entries()).map(([book, r]) => ({
              book,
              startChapter: r.start,
              endChapter: r.end,
            }))
          : undefined,
      tags: selectedTags,
      tagMatchMode,
    }),
    [selectedBooks, chapterRanges, selectedTags, tagMatchMode],
  );

  const scopeForPreview = useMemo(
    () => ({
      books: scope.books,
      chapterRanges: scope.chapterRanges ?? [],
      tags: scope.tags,
      tagMatchMode: scope.tagMatchMode,
    }),
    [scope],
  );

  const preview = useQuery(api.studySessions.previewCounts, {
    scope: scopeForPreview,
  });

  const summaryText = formatScopeSummary(scope);

  const handleToggleBook = useCallback((bookName: string) => {
    setSelectedBooks((prev) =>
      prev.includes(bookName)
        ? prev.filter((b) => b !== bookName)
        : [...prev, bookName],
    );
  }, []);

  const handleSetBooks = useCallback((books: string[]) => {
    setSelectedBooks(books);
    setChapterRanges(new Map());
  }, []);

  const handleSetChapterRange = useCallback(
    (book: string, range: ChapterRange | null) => {
      setChapterRanges((prev) => {
        const next = new Map(prev);
        if (range) {
          next.set(book, range);
        } else {
          next.delete(book);
        }
        return next;
      });
    },
    [],
  );

  const handleSelectPreset = useCallback(
    (books: string[]) => {
      handleSetBooks(books);
    },
    [handleSetBooks],
  );

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const id = await createSession({
        name: summaryText,
        scope: scopeForPreview,
      });
      void navigate({
        to: "/study/$sessionId",
        params: { sessionId: id },
      });
    } finally {
      setIsCreating(false);
    }
  }, [createSession, navigate, scopeForPreview, summaryText]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-3">
        <Link
          to="/study"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Study
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          New Study Session
        </h1>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-8">
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Passage Scope
              </h2>
              <p className="text-xs text-muted-foreground">
                Choose which books and chapters to study.
              </p>
            </div>
            <StudyScopePresets
              selectedBooks={selectedBooks}
              onSelectPreset={handleSelectPreset}
            />
            <StudyScopeBookPicker
              selectedBooks={selectedBooks}
              chapterRanges={chapterRanges}
              onToggleBook={handleToggleBook}
              onSetBooks={handleSetBooks}
              onSetChapterRange={handleSetChapterRange}
            />
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Tags
              </h2>
              <p className="text-xs text-muted-foreground">
                Optionally filter to notes with specific tags.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex gap-1">
                <Button
                  size="xs"
                  variant={tagMatchMode === "any" ? "secondary" : "outline"}
                  onClick={() => setTagMatchMode("any")}
                >
                  Any
                </Button>
                <Button
                  size="xs"
                  variant={tagMatchMode === "all" ? "secondary" : "outline"}
                  onClick={() => setTagMatchMode("all")}
                >
                  All
                </Button>
              </div>
              <TagFilterControl
                availableTags={availableTags}
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
                onClear={handleClearTags}
                resolveTagStyle={resolveTagStyle}
              />
            </div>
          </section>
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t bg-muted/30 px-5 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{summaryText}</p>
            {preview && (
              <p className="text-xs text-muted-foreground">
                {preview.notesCount} note{preview.notesCount !== 1 ? "s" : ""}
                {", "}
                {preview.savedVersesCount} hearted verse
                {preview.savedVersesCount !== 1 ? "s" : ""}
                {", "}
                {preview.teachPassagesCount} passage
                {preview.teachPassagesCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating\u2026" : "Start Session"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
