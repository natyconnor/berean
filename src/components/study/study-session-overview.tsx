import { Link } from "@tanstack/react-router";
import { BookHeart, Heart, Layers, NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEsvReference } from "@/hooks/use-esv-reference";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import { formatVerseRef, toPassageId } from "@/lib/verse-ref-utils";

export interface OverviewSavedVerse {
  _id: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface OverviewNote {
  noteId: string;
  content: string;
  tags: string[];
  updatedAt: number;
  refs: ReadonlyArray<{
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  }>;
}

interface StudySessionOverviewProps {
  savedVerses: ReadonlyArray<OverviewSavedVerse>;
  notes: ReadonlyArray<OverviewNote>;
  teachPassagesCount: number;
  isResolved: boolean;
}

export function StudySessionOverview({
  savedVerses,
  notes,
  teachPassagesCount,
  isResolved,
}: StudySessionOverviewProps) {
  if (isResolved && savedVerses.length === 0 && notes.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-sm text-muted-foreground">
          No content matches this scope yet. Try broadening your scope or adding
          notes and hearting verses in the reader.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BookHeart className="h-3.5 w-3.5 text-rose-500/80 dark:text-rose-400/80" />
          <span>
            <span className="font-medium tabular-nums text-foreground/80">
              {savedVerses.length}
            </span>{" "}
            {savedVerses.length === 1 ? "hearted verse" : "hearted verses"}
          </span>
        </span>
        <span className="text-muted-foreground/40" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1.5">
          <NotebookPen className="h-3.5 w-3.5" />
          <span>
            <span className="font-medium tabular-nums text-foreground/80">
              {notes.length}
            </span>{" "}
            {notes.length === 1 ? "note" : "notes"}
          </span>
        </span>
        <span className="text-muted-foreground/40" aria-hidden>
          ·
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          title="Distinct linked passages in this scope (one card each in Teach)"
        >
          <Layers className="h-3.5 w-3.5" />
          <span>
            <span className="font-medium tabular-nums text-foreground/80">
              {teachPassagesCount}
            </span>{" "}
            {teachPassagesCount === 1 ? "passage" : "passages"}
          </span>
        </span>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <HeartedVersesColumn savedVerses={savedVerses} />
        <NotesColumn notes={notes} />
      </div>
    </div>
  );
}

function ColumnHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function EmptyColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/30 px-4 py-8 text-center">
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

function HeartedVersesColumn({
  savedVerses,
}: {
  savedVerses: ReadonlyArray<OverviewSavedVerse>;
}) {
  return (
    <section className="space-y-3">
      <ColumnHeader
        icon={<BookHeart className="h-3.5 w-3.5" />}
        label="Hearted Verses"
        count={savedVerses.length}
      />
      {savedVerses.length === 0 ? (
        <EmptyColumn>
          No hearted verses in this scope. Tap the heart beside a verse in the
          reader to save it here.
        </EmptyColumn>
      ) : (
        <ul className="space-y-2">
          {savedVerses.map((sv) => (
            <SavedVerseOverviewCard key={sv._id} verse={sv} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SavedVerseOverviewCard({ verse }: { verse: OverviewSavedVerse }) {
  const label = formatVerseRef({
    book: verse.book,
    chapter: verse.chapter,
    startVerse: verse.startVerse,
    endVerse: verse.endVerse,
  });
  const passageId = toPassageId(verse.book, verse.chapter);
  const { data, loading, error } = useEsvReference({
    book: verse.book,
    chapter: verse.chapter,
    startVerse: verse.startVerse,
    endVerse: verse.endVerse,
  });

  return (
    <li className="group relative flex items-start gap-1 rounded-lg border bg-card pr-3 py-2.5 shadow-sm transition-colors hover:border-primary/30">
      <span
        className="mt-0.5 ml-1 flex h-8 w-8 shrink-0 items-center justify-center text-red-500 dark:text-red-400"
        aria-hidden
      >
        <Heart className="h-4 w-4 fill-current" />
      </span>
      <div className="flex-1 min-w-0 space-y-1 pt-1">
        <Link
          to="/passage/$passageId"
          params={{ passageId }}
          search={{
            startVerse: verse.startVerse,
            endVerse: verse.endVerse,
          }}
          className="block text-sm font-medium text-primary hover:underline"
        >
          {label}
        </Link>
        <SavedVerseText loading={loading} error={error} data={data} />
      </div>
    </li>
  );
}

function SavedVerseText({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data: { verses: Array<{ number: number; text: string }> } | null;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5" aria-hidden>
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Could not load verse text.
      </p>
    );
  }
  if (!data || data.verses.length === 0) return null;
  return (
    <p className="font-serif text-sm leading-relaxed text-foreground">
      {data.verses.map((verse, i) => (
        <span key={verse.number}>
          {i > 0 ? " " : ""}
          <span className="mr-0.5 align-top font-sans text-[10px] font-semibold text-muted-foreground">
            {verse.number}
          </span>
          {verse.text}
        </span>
      ))}
    </p>
  );
}

function NotesColumn({ notes }: { notes: ReadonlyArray<OverviewNote> }) {
  return (
    <section className="space-y-3">
      <ColumnHeader
        icon={<NotebookPen className="h-3.5 w-3.5" />}
        label="Notes"
        count={notes.length}
      />
      {notes.length === 0 ? (
        <EmptyColumn>
          No notes in this scope yet. Write notes in the reader to see them
          here.
        </EmptyColumn>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <NoteOverviewCard key={note.noteId} note={note} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteOverviewCard({ note }: { note: OverviewNote }) {
  const resolveTagStyle = useStarterTagBadgeStyle();
  const primaryRef = note.refs[0];
  const extraRefs = Math.max(0, note.refs.length - 1);
  const passageId = primaryRef
    ? toPassageId(primaryRef.book, primaryRef.chapter)
    : null;
  const refLabel = primaryRef ? formatVerseRef(primaryRef) : null;

  return (
    <li
      className={cn(
        "rounded-lg border bg-card px-4 py-3 shadow-sm space-y-1.5",
        "transition-colors hover:border-primary/30",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        {refLabel && passageId && primaryRef ? (
          <Link
            to="/passage/$passageId"
            params={{ passageId }}
            search={{
              startVerse: primaryRef.startVerse,
              endVerse: primaryRef.endVerse,
            }}
            className="text-xs font-medium text-primary hover:underline truncate"
          >
            {refLabel}
            {extraRefs > 0 && (
              <span className="ml-1 font-normal text-muted-foreground">
                +{extraRefs} more
              </span>
            )}
          </Link>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {formatRelativeTime(note.updatedAt)}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground line-clamp-4 whitespace-pre-wrap">
        {note.content}
      </p>
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {note.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px]"
              style={resolveTagStyle(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </li>
  );
}
