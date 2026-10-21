import { createRef, type ComponentProps, type ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { PassageHeartInfo } from "@/lib/passage-heart-info";

import type { PassageNotesInteraction } from "./hooks/use-passage-notes-interaction";
import { PassageViewBody } from "./passage-view-body";

// Monday, October 12, 2026, noon UTC.
const NOW = Date.UTC(2026, 9, 12, 12);

const { openSheet } = vi.hoisted(() => ({ openSheet: vi.fn() }));

vi.mock("@/hooks/use-live-now", () => ({ useLiveNow: () => NOW }));
vi.mock("@/hooks/use-drag-auto-scroll", () => ({ useDragAutoScroll: vi.fn() }));
vi.mock("@/lib/use-theme", () => ({ useTheme: () => ({ darkMode: false }) }));
vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: openSheet }),
}));
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
  interactionOverrides: Partial<PassageNotesInteraction> = {},
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
    passageNotesInteraction: { ...interaction(), ...interactionOverrides },
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
  const body = (saved: SavedSpan[]) => (
    <TooltipProvider delayDuration={0}>
      <PassageViewBody {...props} savedVersesForChapter={saved} />
    </TooltipProvider>
  );
  const view = render(body(savedVersesForChapter));
  /** The chapter's hearts as the server now has them. */
  const setSaved = (saved: SavedSpan[]) => view.rerender(body(saved));
  return { ...view, onToggleSaved, setSaved };
}

function verseRow(container: HTMLElement, verseNumber: number): HTMLElement {
  const row = container.querySelector<HTMLElement>(
    `[data-verse-number="${verseNumber}"]`,
  );
  if (!row) throw new Error(`No row for verse ${verseNumber}`);
  return row;
}

/** jsdom lays nothing out; a zero rect reads as scrolled out of view. */
function placeOnScreen(element: HTMLElement): HTMLElement {
  element.getBoundingClientRect = () => new DOMRect(300, 200, 36, 36);
  return element;
}

function heartPopover() {
  return screen.queryByRole("dialog", { name: "In your hearts" });
}

function savedPopover() {
  return screen.queryByRole("dialog", { name: "Saved to your hearts" });
}

beforeAll(() => {
  // `hideWhenDetached` clips to the viewport, which jsdom sizes 0×0.
  for (const [key, value] of [
    ["clientWidth", 1024],
    ["clientHeight", 768],
  ] as const) {
    Object.defineProperty(document.documentElement, key, {
      configurable: true,
      value,
    });
  }
});

beforeEach(() => {
  openSheet.mockReset();
});

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
      name: "Unheart",
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
      name: "Unheart",
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
      name: "Memorizing: Fill in the blanks. Unheart",
    });
    expect(heart.querySelector("[data-ring-progress]")).not.toBeNull();
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.hover(heart);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe("Memorizing\u00A0· Fill in the blanks");
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
        name: "Memorized: next review Thu. Unheart",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(verseRow(container, 9)).getByRole("button", {
        name: "Mastered. Unheart",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("asks the memorizing confirm before unhearting a learning verse", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved } = renderBody([
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

    const heart = placeOnScreen(
      within(verseRow(container, 2)).getByRole("button", {
        name: "Memorizing: Fill in the blanks. Unheart",
      }),
    );
    await user.click(heart);
    expect(
      screen.getByRole("alertdialog", { name: "Unheart Psalm 16:2?" }),
    ).toHaveTextContent("Unhearting also stops memorizing it.");
    expect(heartPopover()).not.toBeInTheDocument();
    expect(onToggleSaved).not.toHaveBeenCalled();
    await user.hover(heart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("PassageViewBody – hearts not being memorized", () => {
  it("offers Memorize or Unheart on a hearted verse, and Unheart unhearts", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved } = renderBody([VERSE_8_HEART]);

    const heart = placeOnScreen(
      within(verseRow(container, 8)).getByRole("button", {
        name: "Memorize or unheart",
      }),
    );
    expect(heart.querySelector("[data-mastery-ring]")).toBeNull();
    expect(heart).toHaveAttribute("aria-pressed", "true");
    await user.hover(heart);
    expect(
      await screen.findByRole("tooltip", { name: "Memorize or unheart" }),
    ).toBeInTheDocument();

    await user.click(heart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(heartPopover()).toHaveAccessibleDescription("Memorize Psalm 16:8?");
    await user.hover(heart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memorize" })).toHaveFocus();
    expect(onToggleSaved).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Unheart" }));
    expect(onToggleSaved).toHaveBeenCalledExactlyOnceWith(8, 8);
    expect(heartPopover()).not.toBeInTheDocument();
    expect(heart).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the Memorize sheet for that verse from the popover", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved } = renderBody([VERSE_8_HEART]);

    const heart = placeOnScreen(
      within(verseRow(container, 8)).getByRole("button", {
        name: "Memorize or unheart",
      }),
    );
    await user.click(heart);
    await user.click(screen.getByRole("button", { name: "Memorize" }));

    expect(openSheet).toHaveBeenCalledWith(
      {
        kind: "spans",
        spans: [{ book: "Psalms", chapter: 16, startVerse: 8, endVerse: 8 }],
      },
      { returnFocusTo: heart },
    );
    expect(onToggleSaved).not.toHaveBeenCalled();
  });

  it("offers the same on a range pill instead of Remove this passage?", async () => {
    const user = userEvent.setup();
    const { onToggleSaved } = renderBody([
      { startVerse: 5, endVerse: 6, stopsMemorizing: false },
    ]);

    await user.click(
      placeOnScreen(
        screen.getByRole("button", {
          name: "Hearted passage: verses 5–6. Memorize or unheart",
        }),
      ),
    );
    expect(heartPopover()).toHaveAccessibleDescription(
      "Memorize Psalm 16:5–6?",
    );
    expect(
      screen.queryByRole("dialog", { name: "Remove this passage?" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unheart" }));
    expect(onToggleSaved).toHaveBeenCalledExactlyOnceWith(5, 6);
  });

  it("offers the same from the selection bar, which has no Memorize", async () => {
    const user = userEvent.setup();
    const { onToggleSaved } = renderBody(
      [{ startVerse: 5, endVerse: 6, stopsMemorizing: false }],
      [
        verse(4),
        {
          kind: "passageGroup",
          anchorVerse: 5,
          verses: [5, 6].map((verseNumber) => ({
            verseNumber,
            text: `Psalm 16 verse ${verseNumber}`,
          })),
          passageNotes: [],
          singleNotesByVerse: new Map(),
        },
        verse(7),
      ],
      { selectedVerses: new Set([5, 6]), isPassageSelection: true },
    );

    const bar = screen.getByRole("toolbar", {
      name: "Selected verses, Psalm 16:5–6",
    });
    expect(
      within(bar).queryByRole("button", { name: "Memorize" }),
    ).not.toBeInTheDocument();

    await user.click(
      placeOnScreen(
        within(bar).getByRole("button", {
          name: "Hearted. Memorize or unheart",
        }),
      ),
    );
    expect(heartPopover()).toHaveAccessibleDescription(
      "Memorize Psalm 16:5–6?",
    );
    await user.click(screen.getByRole("button", { name: "Unheart" }));
    expect(onToggleSaved).toHaveBeenCalledExactlyOnceWith(5, 6);
  });

  it("just unhearts a verse its memorized passage already covers", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved } = renderBody([
      PASSAGE_HEART,
      VERSE_8_HEART,
    ]);

    await user.click(
      placeOnScreen(
        within(verseRow(container, 8)).getByRole("button", {
          name: "Unheart",
        }),
      ),
    );
    expect(onToggleSaved).toHaveBeenCalledExactlyOnceWith(8, 8);
    expect(heartPopover()).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("PassageViewBody – clicking a heart again while Saved to your hearts shows", () => {
  const HEART_5_6: SavedSpan = {
    startVerse: 5,
    endVerse: 6,
    stopsMemorizing: false,
  };
  const SELECTING_5_6: Partial<PassageNotesInteraction> = {
    selectedVerses: new Set([5, 6]),
    isPassageSelection: true,
  };
  const GROUPED_5_6: BodyProps["filteredVerses"] = [
    verse(4),
    {
      kind: "passageGroup",
      anchorVerse: 5,
      verses: [5, 6].map((verseNumber) => ({
        verseNumber,
        text: `Psalm 16 verse ${verseNumber}`,
      })),
      passageNotes: [],
      singleNotesByVerse: new Map(),
    },
    verse(7),
  ];

  function verseHeart(container: HTMLElement, verseNumber: number) {
    return placeOnScreen(
      within(verseRow(container, verseNumber)).getByRole("button", {
        name: /^(Heart Verse|Memorize or unheart)$/,
      }),
    );
  }

  function barHeart() {
    const bar = screen.getByRole("toolbar", {
      name: "Selected verses, Psalm 16:5–6",
    });
    return placeOnScreen(
      within(bar).getByRole("button", { name: "Heart Verses" }),
    );
  }

  it("just unhearts a verse", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved, setSaved } = renderBody([]);
    const heart = verseHeart(container, 3);

    await user.click(heart);
    expect(savedPopover()).toHaveAccessibleDescription("Memorize Psalm 16:3?");
    setSaved([{ startVerse: 3, endVerse: 3, stopsMemorizing: false }]);
    // The heart is disabled while its pop plays.
    await waitFor(() => expect(heart).toBeEnabled());

    await user.click(heart);
    expect(onToggleSaved.mock.calls).toEqual([
      [3, 3],
      [3, 3],
    ]);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(savedPopover()).not.toBeInTheDocument();
    expect(heartPopover()).not.toBeInTheDocument();
  });

  it("just unhearts a verse whose heart hasn't reached the server yet", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved } = renderBody([]);
    const heart = verseHeart(container, 3);

    await user.click(heart);
    await waitFor(() => expect(heart).toBeEnabled());
    await user.click(heart);

    expect(onToggleSaved).toHaveBeenCalledTimes(2);
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(savedPopover()).not.toBeInTheDocument();
    expect(heartPopover()).not.toBeInTheDocument();
  });

  it("just unhearts a range from its pill", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved, setSaved } = renderBody(
      [],
      undefined,
      SELECTING_5_6,
    );

    await user.click(verseHeart(container, 5));
    expect(savedPopover()).toHaveAccessibleDescription(
      "Memorize Psalm 16:5–6?",
    );
    setSaved([HEART_5_6]);

    await user.click(
      placeOnScreen(
        screen.getByRole("button", {
          name: "Hearted passage: verses 5–6. Memorize or unheart",
        }),
      ),
    );
    expect(onToggleSaved.mock.calls).toEqual([
      [5, 6],
      [5, 6],
    ]);
    expect(savedPopover()).not.toBeInTheDocument();
    expect(heartPopover()).not.toBeInTheDocument();
  });

  it("just unhearts a range from the selection bar's Hearted", async () => {
    const user = userEvent.setup();
    const { onToggleSaved, setSaved } = renderBody(
      [],
      GROUPED_5_6,
      SELECTING_5_6,
    );
    const heart = barHeart();

    await user.click(heart);
    expect(savedPopover()).toHaveAccessibleDescription(
      "Memorize Psalm 16:5–6?",
    );
    setSaved([HEART_5_6]);
    expect(heart).toHaveAccessibleName("Hearted. Memorize or unheart");

    await user.click(heart);
    expect(onToggleSaved.mock.calls).toEqual([
      [5, 6],
      [5, 6],
    ]);
    expect(savedPopover()).not.toBeInTheDocument();
    expect(heartPopover()).not.toBeInTheDocument();
  });

  it("just unhearts from the selection bar before the heart reaches the server", async () => {
    const user = userEvent.setup();
    const { onToggleSaved } = renderBody([], GROUPED_5_6, SELECTING_5_6);
    const heart = barHeart();

    await user.click(heart);
    await user.click(heart);

    expect(onToggleSaved).toHaveBeenCalledTimes(2);
    expect(savedPopover()).not.toBeInTheDocument();
    expect(heartPopover()).not.toBeInTheDocument();
  });

  it("offers Memorize for a different heart", async () => {
    const user = userEvent.setup();
    const { container, onToggleSaved } = renderBody([]);

    await user.click(verseHeart(container, 3));
    await user.click(verseHeart(container, 4));

    expect(onToggleSaved.mock.calls).toEqual([
      [3, 3],
      [4, 4],
    ]);
    expect(savedPopover()).toHaveAccessibleDescription("Memorize Psalm 16:4?");
  });
});

describe("PassageViewBody – verse heart tooltip", () => {
  it("shows Heart Verse on hover, below verses 1–2 and above later verses", async () => {
    const user = userEvent.setup();
    const { container } = renderBody([]);

    const verse1 = placeOnScreen(
      within(verseRow(container, 1)).getByRole("button", {
        name: "Heart Verse",
      }),
    );
    expect(verse1).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.hover(verse1);
    const below = await screen.findByRole("tooltip", { name: "Heart Verse" });
    expect(below).toHaveAttribute("data-side", "bottom");

    await user.unhover(verse1);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    const verse5 = placeOnScreen(
      within(verseRow(container, 5)).getByRole("button", {
        name: "Heart Verse",
      }),
    );
    await user.hover(verse5);
    const above = await screen.findByRole("tooltip", { name: "Heart Verse" });
    expect(above).toHaveAttribute("data-side", "top");
  });

  it("keeps the tooltip closed while Saved to your hearts is open", async () => {
    const user = userEvent.setup();
    const { container } = renderBody([]);
    const heart = placeOnScreen(
      within(verseRow(container, 5)).getByRole("button", {
        name: "Heart Verse",
      }),
    );

    await user.hover(heart);
    expect(
      await screen.findByRole("tooltip", { name: "Heart Verse" }),
    ).toBeInTheDocument();

    await user.click(heart);
    expect(savedPopover()).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.hover(heart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
