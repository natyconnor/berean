import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import { Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logInteraction } from "@/lib/dev-log";
import { formatVerseRef, toPassageId } from "@/lib/verse-ref-utils";
import { cn } from "@/lib/utils";

export function SavedVersesWorkspace() {
  const saved = useQuery(api.savedVerses.listAll, {});
  const toggleSaved = useMutation(api.savedVerses.toggle);

  const handleUnheart = useCallback(
    (row: {
      _id: Id<"savedVerses">;
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }) => {
      void toggleSaved({
        book: row.book,
        chapter: row.chapter,
        startVerse: row.startVerse,
        endVerse: row.endVerse,
      })
        .then((result) => {
          logInteraction("savedVerses", "list-unheart", {
            savedVerseId: row._id,
            result,
          });
        })
        .catch((err) => {
          logInteraction("savedVerses", "list-unheart-failed", {
            message: err instanceof Error ? err.message : "unknown-error",
          });
        });
    },
    [toggleSaved],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Hearted verses</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Verses and passages you&apos;ve hearted in the reader.
        </p>
      </header>
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-5 py-6">
          {!saved || saved.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 px-4">
              Start storing some verses in your heart by hearting verses!
            </p>
          ) : (
            <ul className="space-y-2">
              {saved.map((row) => {
                const label = formatVerseRef({
                  book: row.book,
                  chapter: row.chapter,
                  startVerse: row.startVerse,
                  endVerse: row.endVerse,
                });
                const passageId = toPassageId(row.book, row.chapter);
                return (
                  <li
                    key={row._id}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm"
                  >
                    <Link
                      to="/passage/$passageId"
                      params={{ passageId }}
                      search={{
                        startVerse: row.startVerse,
                        endVerse: row.endVerse,
                      }}
                      className={cn(
                        "flex-1 min-w-0 text-sm font-medium text-primary hover:underline",
                      )}
                      onClick={() =>
                        logInteraction("savedVerses", "list-open-passage", {
                          passageId,
                        })
                      }
                    >
                      {label}
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300"
                      aria-label={`Unheart ${label}`}
                      onClick={() => handleUnheart(row)}
                    >
                      <Heart className="h-4 w-4 fill-current" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
