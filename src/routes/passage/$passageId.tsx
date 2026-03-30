import { createFileRoute } from "@tanstack/react-router";
import { PassagePage } from "@/components/routes/passage-page";

type PassageSearchMode = "compose" | "read";
type PassageSearchSource = "search";

interface PassageSearchState {
  startVerse?: number;
  endVerse?: number;
  mode?: PassageSearchMode;
  source?: PassageSearchSource;
}

function parsePositiveInt(value: unknown): number | undefined {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return undefined;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : undefined;
}

function validatePassageSearch(
  search: Record<string, unknown>,
): PassageSearchState {
  const startVerse = parsePositiveInt(search.startVerse);
  const endVerseCandidate = parsePositiveInt(search.endVerse);
  const hasRange = typeof startVerse === "number";
  const endVerse =
    hasRange && typeof endVerseCandidate === "number"
      ? Math.max(startVerse, endVerseCandidate)
      : hasRange
        ? startVerse
        : undefined;
  const mode: PassageSearchMode | undefined =
    search.mode === "compose" || search.mode === "read"
      ? search.mode
      : undefined;
  const source: PassageSearchSource | undefined =
    search.source === "search" ? "search" : undefined;

  return {
    startVerse: hasRange ? startVerse : undefined,
    endVerse,
    mode,
    source,
  };
}

export const Route = createFileRoute("/passage/$passageId")({
  validateSearch: validatePassageSearch,
  component: PassagePage,
});
