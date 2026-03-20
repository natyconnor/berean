import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { useEsvReference } from "@/hooks/use-esv-reference";
import {
  formatVerseRef,
  type VerseRef,
} from "@/lib/verse-ref-utils";
import { HighlightedText } from "@/components/search/highlighted-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  SearchResultGroup,
  SearchVerseRef,
} from "./search-workspace-model";

interface SearchResultGroupRowProps {
  group: SearchResultGroup;
  selectedNoteId: string | undefined;
  normalizedQuery: string;
  onSelectNote: (noteId: string) => void;
  onJumpToRef: (ref: SearchVerseRef) => void;
  resolveTagStyle: (tag: string) => CSSProperties | undefined;
  isTutorialDemo?: boolean;
  markTourTargets?: boolean;
}

function toVerseRefLabel(ref: SearchVerseRef): string {
  const normalizedRef: VerseRef = {
    book: ref.book,
    chapter: ref.chapter,
    startVerse: ref.startVerse,
    endVerse: ref.endVerse,
  };
  return formatVerseRef(normalizedRef);
}

export function SearchResultGroupRow({
  group,
  selectedNoteId,
  normalizedQuery,
  onSelectNote,
  onJumpToRef,
  resolveTagStyle,
  isTutorialDemo = false,
  markTourTargets = false,
}: SearchResultGroupRowProps) {
  const ref = group.ref;
  const { data, loading, error, query } = useEsvReference(ref);

  return (
    <div className="grid gap-3 rounded-md border bg-card p-3 lg:grid-cols-[minmax(340px,1fr)_minmax(360px,1.1fr)]">
      <div
        className="space-y-2 rounded-sm border bg-background p-2"
        {...(markTourTargets
          ? { "data-tour-id": "search-demo-scripture-context" }
          : {})}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {ref ? toVerseRefLabel(ref) : "Unlinked notes"}
          </h3>
          {ref && (
            <div className="flex gap-1">
              <Button
                size="xs"
                onClick={() => onJumpToRef(ref)}
                {...(markTourTargets
                  ? { "data-tour-id": "search-demo-go-to-verse" }
                  : {})}
              >
                Go to verse
              </Button>
            </div>
          )}
        </div>
        {isTutorialDemo ? (
          <Badge variant="outline" className="text-[10px]">
            Tutorial demo
          </Badge>
        ) : null}

        {query && (
          <p className="text-xs text-muted-foreground">
            Showing exact verse range: {query}
          </p>
        )}

        {!ref ? (
          <p className="text-sm text-muted-foreground">
            These notes are not linked to verse references yet.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading scripture context...
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data || data.verses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scripture context available.
          </p>
        ) : (
          <div className="space-y-0.5">
            {data.verses.map((verse) => (
              <button
                key={verse.number}
                type="button"
                className={cn(
                  "grid w-full grid-cols-[2rem_1fr] gap-2 rounded-sm px-2 py-1.5 text-left transition-colors",
                  "bg-sky-100/70 ring-1 ring-sky-400/30 hover:bg-sky-100 dark:bg-sky-900/20 dark:ring-sky-500/40 dark:hover:bg-sky-900/30",
                )}
                onClick={() => onJumpToRef(ref)}
              >
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {verse.number}
                </span>
                <p className="font-serif text-base leading-relaxed">
                  {verse.text}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {group.notes.map((note) => {
          const isSelected = selectedNoteId === note.noteId;
          return (
            <button
              key={note.noteId}
              type="button"
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left transition-colors",
                isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-transparent hover:bg-muted",
              )}
              onClick={() => onSelectNote(note.noteId)}
              {...(markTourTargets
                ? { "data-tour-id": "search-demo-result" }
                : {})}
            >
              {isTutorialDemo ? (
                <Badge variant="outline" className="mb-2 text-[10px]">
                  Tutorial demo
                </Badge>
              ) : null}
              <p className="text-sm leading-relaxed">
                <HighlightedText text={note.content} query={normalizedQuery} />
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {note.tags.map((tag) => (
                  <Badge
                    key={`${note.noteId}-${tag}`}
                    variant="outline"
                    className="text-[10px]"
                    style={resolveTagStyle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
