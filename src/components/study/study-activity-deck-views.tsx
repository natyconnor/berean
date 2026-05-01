import { RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyCard } from "./study-card-model";

export function StudyDeckEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        No cards available for this activity.
      </p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Try switching activities or broadening your scope.
      </p>
    </div>
  );
}

interface StudyDeckCompleteStateProps {
  cards: StudyCard[];
  scopeLabel: string;
  onRestart: () => void;
  onShuffle: () => void;
}

export function StudyDeckCompleteState({
  cards,
  scopeLabel,
  onRestart,
  onShuffle,
}: StudyDeckCompleteStateProps) {
  const totalCards = cards.length;
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h3 className="text-xl font-semibold">Session complete</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {buildCompletionMessage(cards, scopeLabel)}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onRestart} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Restart deck
        </Button>
        {totalCards >= 2 && (
          <Button onClick={onShuffle} variant="outline" className="gap-2">
            <Shuffle className="h-4 w-4" />
            Shuffle
          </Button>
        )}
      </div>
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
