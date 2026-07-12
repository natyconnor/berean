import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache";
import { Loader2 } from "lucide-react";

import {
  PracticeBoard,
  type PracticeVerse,
} from "@/components/memory/practice/practice-board";
import {
  hasPracticeVerseScope,
  type MemoryPracticeSearch,
} from "@/lib/memory-practice-search";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/memory/practice";

import { api } from "../../../convex/_generated/api";

export function MemoryPracticePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const savedVerses = useQuery(api.savedVerses.listAll, {});

  const verses = useMemo(
    () => scopePracticeVerses(savedVerses, search),
    [savedVerses, search],
  );
  const scopeLabel = hasPracticeVerseScope(search)
    ? formatVerseRef(search)
    : "All my hearted verses";

  if (savedVerses === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (verses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-base font-semibold tracking-tight">
            Nothing to practice
          </h1>
          <p className="text-sm text-muted-foreground">
            Heart a verse first, then come back to practice it.
          </p>
          <Link
            to="/memory"
            className="inline-flex text-sm font-medium text-primary hover:underline"
          >
            Back to Memory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PracticeBoard
      verses={verses}
      scopeLabel={scopeLabel}
      onExit={() => void navigate({ to: "/memory" })}
    />
  );
}

function scopePracticeVerses(
  savedVerses:
    | ReadonlyArray<{
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
        memory?: {
          learnStage?: number;
          stageReps?: number;
          status?: PracticeVerse["status"];
        } | null;
      }>
    | undefined,
  search: MemoryPracticeSearch,
): PracticeVerse[] {
  if (savedVerses === undefined) return [];

  const mapped = savedVerses.map((verse) => ({
    reference: {
      book: verse.book,
      chapter: verse.chapter,
      startVerse: verse.startVerse,
      endVerse: verse.endVerse,
    },
    learnStage: verse.memory?.learnStage ?? 0,
    stageReps: verse.memory?.stageReps ?? 0,
    status: verse.memory?.status,
  }));

  if (!hasPracticeVerseScope(search)) {
    return mapped;
  }

  return mapped.filter(
    (verse) =>
      verse.reference.book === search.book &&
      verse.reference.chapter === search.chapter &&
      verse.reference.startVerse === search.startVerse &&
      verse.reference.endVerse === search.endVerse,
  );
}
