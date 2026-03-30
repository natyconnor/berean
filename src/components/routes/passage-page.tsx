import { PassageView } from "@/components/passage/passage-view";
import { parsePassageId } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/passage/$passageId";

export function PassagePage() {
  const { passageId } = Route.useParams();
  const search = Route.useSearch();
  const { book, chapter } = parsePassageId(passageId);

  return (
    <PassageView
      book={book}
      chapter={chapter}
      focusRange={
        typeof search.startVerse === "number" &&
        typeof search.endVerse === "number"
          ? { startVerse: search.startVerse, endVerse: search.endVerse }
          : null
      }
      forcedViewMode={search.mode}
      focusSource={search.source}
    />
  );
}
