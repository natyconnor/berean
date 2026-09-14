export type ChapterNotesOptionId =
  "header-rail" | "chapter-row" | "notes-tray" | "pinned-dock";

export interface ChapterNotesOption {
  id: ChapterNotesOptionId;
  title: string;
  shortLabel: string;
  summary: string;
  entryPoint: string;
  placement: string;
  tradeoffs: string[];
}

export const CHAPTER_NOTES_OPTIONS: ChapterNotesOption[] = [
  {
    id: "header-rail",
    title: "Header-aligned rail",
    shortLabel: "A · Rail",
    summary:
      "Chapter notes live in a sticky slot at the top of the notes column, aligned with the chapter header. Create from a Chapter + next to Notes.",
    entryPoint: "Chapter + control beside the Notes label",
    placement: "Sticky top of the notes column",
    tradeoffs: [
      "Clearest separation from verse/passage notes",
      "Competes with Focus / Compose chrome for header space",
      "Feels like a third note type (verse / passage / chapter)",
    ],
  },
  {
    id: "chapter-row",
    title: "Chapter as a row",
    shortLabel: "B · Row",
    summary:
      "Treat the chapter like verse 0: a noteable row above v1 with the same + affordance. The bubble sits in the notes column beside that row.",
    entryPoint: "Same + pattern as verses, on a Chapter row",
    placement: "Inline with a dedicated chapter row above v1",
    tradeoffs: [
      "Lowest conceptual leap — notes always attach to a row",
      "Scrolls away with the top of the chapter",
      "Easy to miss if you are already mid-chapter",
    ],
  },
  {
    id: "notes-tray",
    title: "Notes header tray",
    shortLabel: "C · Tray",
    summary:
      "The Notes heading becomes a chapter-notes tray. Open it to read or write chapter notes without mixing them into the verse bubble stream.",
    entryPoint: "Click Notes / chapter chip in the notes header",
    placement: "Expandable tray under the sticky Notes header",
    tradeoffs: [
      "Always reachable from the sticky header while scrolling",
      "Hidden until opened — weaker ambient awareness",
      "Reuses Notes chrome instead of inventing a new surface",
    ],
  },
  {
    id: "pinned-dock",
    title: "Pinned chapter dock",
    shortLabel: "D · Dock",
    summary:
      "A slim sticky dock under the chapter header stays put while you scroll. Expand it to write or review chapter notes without leaving your place.",
    entryPoint: "Sticky dock under John 3",
    placement: "Pinned under the chapter header (full width)",
    tradeoffs: [
      "Best for long chapters — never scrolls away",
      "Uses vertical space even when collapsed",
      "Sits closer to reading than to the notes column",
    ],
  },
];
