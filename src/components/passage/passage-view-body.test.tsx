import { createRef, type ComponentProps, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { PassageHeartInfo } from "@/lib/passage-heart-info";

import type { PassageNotesInteraction } from "./hooks/use-passage-notes-interaction";
import { PassageViewBody } from "./passage-view-body";

// Monday, October 12, 2026, noon UTC.
const NOW = Date.UTC(2026, 9, 12, 12);

vi.mock("@/hooks/use-live-now", () => ({ useLiveNow: () => NOW }));
vi.mock("@/hooks/use-drag-auto-scroll", () => ({ useDragAutoScroll: vi.fn() }));
vi.mock("@/lib/use-theme", () => ({ useTheme: () => ({ darkMode: false }) }));
vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: vi.fn() }),
}));
vi.mock("./hooks/use-heart-memorize-nudge", () => ({
  useHeartMemorizeNudge: () => ({ heartClicked: vi.fn(), nudge: {} }),
}));
vi.mock("./heart-memorize-nudge", () => ({ HeartMemorizeNudge: () => null }));
vi.mock("./chapter-notes-chrome", () => ({ ChapterNotesChrome: () => null }));
vi.mock("@/components/bible/chapter-pager", () => ({
  ChapterPager: () => null,
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/notes/note-editor", () => ({ NoteEditor: () => null }));

type BodyProps = ComponentProps<typeof PassageViewBody>;
type SavedSpan = NonNullable<BodyProps["savedVersesForChapter"]>[number];

function interaction(): PassageNotesInteraction {
  return {
    selectedVerses: new Set(),
    passageDraftVerses: new Set(),
    expandedPassageRanges: [],
    hasDirtyEditors: false,
    notifyEditorDirty: vi.fn(),
    hoveredVerse: null,
    hoveredSingleBubble: null,
    hoveredPassageBubble: null,
    openVerseKeys: new Set(),
    openPassageKeys: new Set(),
    openEditors: new Map(),
    currentFocusTarget: null,
    editingNoteIds: new Set(),
    newDraftsByAnchor: new Map(),
    editComposersByAnchor: new Map(),
    savedEditOverrides: new Map(),
    retargetingEditorKey: null,
    inPlaceRetargetActive: false,
    isPassageSelection: false,
    chapterScopedNotes: [],
    // ChapterNotesChrome is mocked, so the panel is never read.
    chapterNotesPanel: {} as PassageNotesInteraction["chapterNotesPanel"],
    singleVerseNotes: new Map(),
    passageNotesByAnchor: new Map(),
    verseToPassageAnchor: new Map(),
    containerRef: createRef<HTMLDivElement>(),
    isDragging: false,
    isInSelection: () => false,
    handleVerseMouseDown: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    handleMouseUp: vi.fn(),
    handleSingleBubbleMouseEnter: vi.fn(),
    handleSingleBubbleMouseLeave: vi.fn(),
    handlePassageBubbleMouseEnter: vi.fn(),
    handlePassageBubbleMouseLeave: vi.fn(),
    handleAddNote: vi.fn(),
    handleSaveNew: vi.fn().mockResolvedValue(undefined),
    retargetNewDraft: vi.fn(),
    retargetEditNote: vi.fn(),
    handleSaveEdit: vi.fn().mockResolvedValue(undefined),
    handleDelete: vi.fn().mockResolvedValue(undefined),
    handleNoteDeleteCleanup: vi.fn(),
    handleClickAway: vi.fn(),
    requestClearSelection: vi.fn(),
    cancelEditor: vi.fn(),
    openVerseNotes: vi.fn(),
    closeVerseNotes: vi.fn(),
    openPassageNotes: vi.fn(),
    closePassageNotes: vi.fn(),
    startEditingNote: vi.fn(),
    startCreatingPassageNote: vi.fn(),
    handleEditorFocus: vi.fn(),
    normalizeForFocusMode: vi.fn(),
    showDiscardConfirmation: false,
    confirmDiscard: vi.fn(),
    cancelDiscard: vi.fn(),
    setViewModeWithNotesReset: vi.fn(),
  };
}

function verse(
  verseNumber: number,
  extra: { heading?: string; subheading?: string } = {},
): BodyProps["filteredVerses"][number] {
  return {
    kind: "single",
    verseNumber,
    text: `Psalm 16 verse ${verseNumber}`,
    singleNotes: [],
    passageNotes: [],
    ...extra,
  };
}

/** Psalm 16 as a passage: 4 of 11 learned, 5–6 learning, 7–11 up next. */
function psalm16Passage(): PassageHeartInfo {
  return {
    passageMemoryId: "pm_16",
    packId: "pack_16",
    title: "Psalm 16",
    status: "building",
    dueAt: NOW,
    learnedVerses: 4,
    totalVerses: 11,
    chapterCount: 1,
    isFirstChapter: true,
    isLastChapter: true,
    startVerse: 1,
    endVerse: 11,
    verseStates: Array.from({ length: 11 }, (_, i) => ({
      verse: i + 1,
      state: i < 4 ? "memorized" : i < 6 ? "learning" : "upNext",
    })),
  };
}

function renderBody(
  savedVersesForChapter: SavedSpan[],
  filteredVerses = Array.from({ length: 11 }, (_, i) => verse(i + 1)),
) {
  const onToggleSaved = vi.fn();
  const props: BodyProps = {
    book: "Psalms",
    chapter: 16,
    dataCopyright: "",
    passageKey: "Psalms-16",
    containerClass: "",
    topGridClass: "",
    passageGridClass: "",
    viewportRef: createRef<HTMLDivElement>(),
    filteredVerses,
    showSectionHeaders: true,
    passageNotesInteraction: interaction(),
    effectiveViewMode: "read",
    isFocusMode: false,
    focusGlowAmount: 0,
    hasFocusRange: false,
    focusRange: null,
    reenteringFromGroup: new Set(),
    highlightsByVerse: new Map(),
    forceAddButtonVisible: false,
    onCreateHighlight: vi.fn(),
    onDeleteHighlight: vi.fn(),
    onRecolorHighlight: vi.fn(),
    savedVersesForChapter,
    onToggleSaved,
    tourActive: false,
  };
  const view = render(
    <TooltipProvider delayDuration={0}>
      <PassageViewBody {...props} />
    </TooltipProvider>,
  );
  return { ...view, onToggleSaved };
}

function verseRow(container: HTMLElement, verseNumber: number): HTMLElement {
  const row = container.querySelector<HTMLElement>(
    `[data-verse-number="${verseNumber}"]`,
  );
  if (!row) throw new Error(`No row for verse ${verseNumber}`);
  return row;
}

const PASSAGE_HEART: SavedSpan = {
  startVerse: 1,
  endVerse: 11,
  stopsMemorizing: true,
  passageMemoryId: "pm_16",
  passage: psalm16Passage(),
};

/** Psalm 16:8 hearted on its own before the passage; absorbed, so not in Memory. */
const VERSE_8_HEART: SavedSpan = {
  startVerse: 8,
  endVerse: 8,
  stopsMemorizing: false,
  memory: {
    status: "reviewing",
    learnStage: 3,
    intervalDays: 10,
    dueAt: NOW + 3 * 24 * 60 * 60 * 1000,
    inMemory: false,
  },
};

describe("PassageViewBody – memorized passage heart and rail", () => {
  it("shows one passage heart with a partial ring instead of a range pill", () => {
    renderBody([PASSAGE_HEART, VERSE_8_HEART]);

    const hearts = screen.getAllByRole("button", { name: /hearted\. / });
    expect(hearts).toHaveLength(1);
    expect(hearts[0]).toHaveAccessibleName(
      "Psalm 16, hearted. Memorizing: 4 of 11 verses learned. Remove heart",
    );
    expect(hearts[0]?.querySelector("[data-ring-progress]")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Hearted passage/ }),
    ).not.toBeInTheDocument();
  });

  it("draws a segment per verse: solid, dashed, then faint", () => {
    const { container } = renderBody([PASSAGE_HEART]);

    const lanes = Array.from(container.querySelectorAll("[data-passage-rail]"));
    expect(lanes.map((lane) => lane.getAttribute("data-passage-rail"))).toEqual(
      [
        ...Array<string>(4).fill("solid"),
        ...Array<string>(2).fill("dashed"),
        ...Array<string>(5).fill("faint"),
      ],
    );
    // The rail just ends under the last verse: its segment and nothing else.
    expect(lanes.at(-1)?.children).toHaveLength(1);
  });

  it("keeps an individually hearted verse's own heart, with no ring", () => {
    const { container } = renderBody([PASSAGE_HEART, VERSE_8_HEART]);

    const ownHeart = within(verseRow(container, 8)).getByRole("button", {
      name: "Remove from hearted verses",
    });
    expect(ownHeart.querySelector("[data-mastery-ring]")).toBeNull();
  });

  it("keeps inner hearts ringless even when that verse is still in Memory", () => {
    const { container } = renderBody([
      PASSAGE_HEART,
      {
        ...VERSE_8_HEART,
        memory: { ...VERSE_8_HEART.memory!, inMemory: true },
      },
    ]);

    const ownHeart = within(verseRow(container, 8)).getByRole("button", {
      name: "Remove from hearted verses",
    });
    expect(ownHeart.querySelector("[data-mastery-ring]")).toBeNull();
  });

  it("runs the rail past a section heading inside the passage", () => {
    const verses = Array.from({ length: 11 }, (_, i) =>
      i + 1 === 5
        ? verse(5, { heading: "The Lord Is My Portion" })
        : verse(i + 1),
    );
    const { container } = renderBody([PASSAGE_HEART], verses);

    expect(container.querySelectorAll("[data-passage-rail]")).toHaveLength(12);
  });

  it("unhearts the passage's heart row after the memorizing confirm", async () => {
    const user = userEvent.setup();
    const { onToggleSaved } = renderBody([PASSAGE_HEART]);

    await user.click(screen.getByRole("button", { name: /Psalm 16, hearted/ }));
    await user.click(screen.getByRole("button", { name: "Unheart and stop" }));
    expect(onToggleSaved).toHaveBeenCalledWith(1, 11);
  });

  it("shows only the rail slice in a later chapter of the passage", () => {
    const { container } = renderBody([
      {
        ...PASSAGE_HEART,
        passage: { ...psalm16Passage(), isFirstChapter: false },
      },
    ]);

    expect(
      screen.queryByRole("button", { name: /hearted\. / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hearted passage/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-passage-rail]")).toHaveLength(11);
  });

  it("falls back to a range pill when the passage's pack is gone", () => {
    renderBody([{ ...PASSAGE_HEART, passage: undefined }]);

    expect(
      screen.getByRole("button", { name: /Hearted passage: verses 1–11/ }),
    ).toBeInTheDocument();
  });
});

describe("PassageViewBody – memorizing verse hearts", () => {
  it("names the step on a learning verse's heart", async () => {
    const user = userEvent.setup();
    const { container } = renderBody([
      {
        startVerse: 2,
        endVerse: 2,
        stopsMemorizing: true,
        memory: {
          status: "learning",
          learnStage: 2,
          stageReps: 0,
          intervalDays: 0,
          dueAt: NOW - 1,
          inMemory: true,
        },
      },
    ]);

    const heart = within(verseRow(container, 2)).getByRole("button", {
      name: "Remove from hearted verses (memorizing, Fill in the blanks)",
    });
    expect(heart.querySelector("[data-ring-progress]")).not.toBeNull();
    await user.hover(heart);
    expect(
      within(verseRow(container, 2)).getByText(
        "Memorizing · Fill in the blanks",
      ),
    ).toBeInTheDocument();
  });

  it("names the next review on a memorized verse and just Mastered after", () => {
    const { container } = renderBody([
      {
        ...VERSE_8_HEART,
        memory: { ...VERSE_8_HEART.memory!, inMemory: true },
      },
      {
        startVerse: 9,
        endVerse: 9,
        stopsMemorizing: true,
        memory: {
          status: "mastered",
          learnStage: 3,
          intervalDays: 40,
          dueAt: NOW + 40 * 24 * 60 * 60 * 1000,
          inMemory: true,
        },
      },
    ]);

    expect(
      within(verseRow(container, 8)).getByRole("button", {
        name: "Remove from hearted verses (memorized, next review Thu)",
      }),
    ).toBeInTheDocument();
    expect(
      within(verseRow(container, 8)).getByText("Memorized · next review Thu"),
    ).toBeInTheDocument();
    expect(
      within(verseRow(container, 9)).getByRole("button", {
        name: "Remove from hearted verses (mastered)",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the plain Heart / Unheart wording for a verse not in Memory", () => {
    const { container } = renderBody([VERSE_8_HEART]);

    const heart = within(verseRow(container, 8)).getByRole("button", {
      name: "Remove from hearted verses",
    });
    expect(heart.querySelector("[data-mastery-ring]")).toBeNull();
    expect(
      within(verseRow(container, 8)).getByText("Unheart"),
    ).toBeInTheDocument();
  });
});
