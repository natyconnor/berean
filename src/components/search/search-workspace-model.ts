export interface SearchVerseRef {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface SearchResultNote {
  noteId: string;
  content: string;
  tags: string[];
}

export interface SearchResultGroup {
  key: string;
  ref: SearchVerseRef | null;
  notes: SearchResultNote[];
}

export const SEARCH_TUTORIAL_DEMO_QUERY = "beloved";
export const SEARCH_TUTORIAL_DEMO_TAGS = ["love", "faith"];
export const SEARCH_TUTORIAL_DEMO_NOTE_ID = "tutorial-demo-note";
export const SEARCH_TUTORIAL_DEMO_GROUPS: SearchResultGroup[] = [
  {
    key: "tutorial-john-3",
    ref: {
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 18,
    },
    notes: [
      {
        noteId: SEARCH_TUTORIAL_DEMO_NOTE_ID,
        content:
          "Believing in the Son is not abstract here. The note connects love, faith, and life together.",
        tags: SEARCH_TUTORIAL_DEMO_TAGS,
      },
    ],
  },
];
