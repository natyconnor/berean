import { BookOpen, Pencil } from "lucide-react";
import { ChapterHeader } from "@/components/bible/chapter-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PassageViewMode = "compose" | "read";
type NoteVisibility = "all" | "noted";

interface PassageViewHeaderProps {
  book: string;
  chapter: number;
  isScrolled: boolean;
  passageGridClass: string;
  headerInnerClass: string;
  effectiveViewMode: PassageViewMode;
  isReadMode: boolean;
  hasAnyNotes: boolean;
  noteVisibility: NoteVisibility;
  setViewModeWithNotesReset: (next: PassageViewMode) => void;
  setNoteVisibility: (next: NoteVisibility) => void;
}

export function PassageViewHeader({
  book,
  chapter,
  isScrolled,
  passageGridClass,
  headerInnerClass,
  effectiveViewMode,
  isReadMode,
  hasAnyNotes,
  noteVisibility,
  setViewModeWithNotesReset,
  setNoteVisibility,
}: PassageViewHeaderProps) {
  return (
    <div
      className={cn(
        "shrink-0 bg-background transition-shadow duration-200",
        isScrolled && "shadow-sm",
      )}
      data-passage-dismiss-exempt
    >
      <div className={cn("grid", passageGridClass, headerInnerClass)}>
        <div className="flex items-center">
          <ChapterHeader book={book} chapter={chapter} />
        </div>
        <div className="flex flex-col gap-2 pb-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Notes
            </span>
            <div
              className="inline-flex items-center rounded-md border bg-background p-0.5"
              data-tour-id="passage-view-mode-toggle"
            >
              <Button
                size="xs"
                variant={effectiveViewMode === "compose" ? "secondary" : "ghost"}
                onClick={() => setViewModeWithNotesReset("compose")}
                className="gap-1.5"
              >
                <Pencil className="h-3 w-3" />
                Compose
                <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                  C
                </kbd>
              </Button>
              <Button
                size="xs"
                variant={effectiveViewMode === "read" ? "secondary" : "ghost"}
                onClick={() => setViewModeWithNotesReset("read")}
                className="gap-1.5"
              >
                <BookOpen className="h-3 w-3" />
                Read
                <kbd className="ml-1 rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground">
                  R
                </kbd>
              </Button>
            </div>
          </div>

          {isReadMode &&
            (hasAnyNotes ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Show</span>
                <div className="inline-flex items-center rounded-md border bg-background p-0.5">
                  <Button
                    size="xs"
                    variant={noteVisibility === "all" ? "secondary" : "ghost"}
                    onClick={() => setNoteVisibility("all")}
                  >
                    All Notes
                  </Button>
                  <Button
                    size="xs"
                    variant={
                      noteVisibility === "noted" ? "secondary" : "ghost"
                    }
                    onClick={() => setNoteVisibility("noted")}
                  >
                    Only Noted
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No notes for this chapter
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}
