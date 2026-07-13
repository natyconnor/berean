import type { JSX } from "react";
import { Layers, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { StudyCard } from "./study-card-model";

export function StudyDeckEmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Layers className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight">No cards yet</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          No cards available for this activity. Try switching activities or
          broadening your scope.
        </p>
      </div>
    </div>
  );
}

interface StudyDeckCompleteStateProps {
  cards: StudyCard[];
  scopeLabel: string;
  onRestart: () => void;
}

export function StudyDeckCompleteState({
  cards,
  scopeLabel,
  onRestart,
}: StudyDeckCompleteStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight">
          Session complete
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {buildCompletionMessage(cards, scopeLabel)}
        </p>
      </div>
      <Button onClick={onRestart} variant="outline" className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Restart deck
      </Button>
    </div>
  );
}

function buildCompletionMessage(
  cards: StudyCard[],
  scopeLabel: string,
): string {
  const verseCount = cards.filter((c) => c.type === "verse-memory").length;
  const noteCount = cards.filter((c) => c.type === "teach").length;

  const parts: string[] = [];
  if (verseCount > 0) {
    parts.push(`${verseCount} hearted verse${verseCount !== 1 ? "s" : ""}`);
  }
  if (noteCount > 0) {
    parts.push(`${noteCount} passage${noteCount !== 1 ? "s" : ""}`);
  }

  const subjects =
    parts.length === 0
      ? "your cards"
      : parts.length === 1
        ? parts[0]
        : `${parts[0]} and ${parts[1]}`;

  const scope = scopeLabel.trim();
  return scope
    ? `You reviewed ${subjects} in ${scope}.`
    : `You reviewed ${subjects}.`;
}
