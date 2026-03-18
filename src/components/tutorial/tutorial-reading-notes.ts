import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";

const TUTORIAL_READING_PREVIEWS = [
  "John opens with Jesus already present before creation.",
  "The light keeps breaking into darkness without being overcome.",
  "John the Baptist points away from himself toward the true light.",
  "The Word arrives in the world he made, and many still miss him.",
  "Receiving Jesus is pictured as a new birth from God.",
  "Grace and truth arrive in fullness through the Word made flesh.",
  "John keeps centering his witness on someone greater than himself.",
  "The first chapter keeps building expectancy around who Jesus is.",
  "Every scene pushes the reader toward recognition and response.",
  "Reading mode gives your notes room to breathe beside the passage.",
];

export const TUTORIAL_READING_BOOK = "John";
export const TUTORIAL_READING_CHAPTER = 1;

export function buildTutorialReadingNotes(
  book: string,
  chapter: number,
): Map<number, NoteWithRef[]> {
  return new Map(
    TUTORIAL_READING_PREVIEWS.map((content, index) => {
      const verseNumber = index + 1;
      return [
        verseNumber,
        [
          {
            noteId: `tutorial-reading-${verseNumber}` as Id<"notes">,
            content,
            tags: [],
            verseRef: {
              book,
              chapter,
              startVerse: verseNumber,
              endVerse: verseNumber,
            },
            createdAt: 0,
          },
        ],
      ];
    }),
  );
}
