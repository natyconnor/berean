import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  collectPassageNotesStartingInRange,
  type NoteWithRef,
} from "@/components/notes/model/note-model";
import { EMPTY_NOTE_BODY } from "@/lib/note-inline-content";
import {
  usePassageNotesUiState,
  type PassageNotesUiState,
} from "./use-passage-notes-ui-state";

const clearSelectionMock = vi.fn();
let mockSelectionStart: number | null = null;
let mockSelectionEnd: number | null = null;

vi.mock("@/hooks/use-verse-selection", () => ({
  useVerseSelection: (
    onComplete: (sel: { startVerse: number; endVerse: number }) => void,
  ) => ({
    selectionStart: mockSelectionStart,
    selectionEnd: mockSelectionEnd,
    isSelecting: false,
    isInSelection: () => false,
    handleMouseDown: () => {},
    handleMouseEnter: () => {},
    handleMouseUp: () => {
      onComplete({ startVerse: 1, endVerse: 1 });
      return true;
    },
    clearSelection: clearSelectionMock,
  }),
}));

function defaultOptions() {
  return {
    book: "Genesis",
    chapter: 1,
    viewMode: "compose" as const,
    setViewMode: vi.fn(),
    isFocusMode: false,
    singleVerseNotes: new Map(),
    passageNotesByAnchor: new Map(),
    verseToPassageAnchor: new Map(),
    onSaveNewNote: vi.fn().mockResolvedValue(undefined),
    onSaveEditNote: vi.fn().mockResolvedValue(undefined),
    onDeleteNote: vi.fn().mockResolvedValue(undefined),
  };
}

function clickElement(el: Element) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(event);
  });
}

describe("usePassageNotesUiState outside-click dismissal", () => {
  let outsideDiv: HTMLDivElement;
  let noteSurface: HTMLDivElement;
  let exemptToolbar: HTMLDivElement;
  let exemptPortal: HTMLDivElement;
  let feedbackFabButton: HTMLButtonElement;
  let devLogPanel: HTMLDivElement;

  beforeEach(() => {
    clearSelectionMock.mockReset();
    mockSelectionStart = null;
    mockSelectionEnd = null;
    outsideDiv = document.createElement("div");
    document.body.appendChild(outsideDiv);

    noteSurface = document.createElement("div");
    noteSurface.setAttribute("data-note-surface", "");
    document.body.appendChild(noteSurface);

    exemptToolbar = document.createElement("div");
    exemptToolbar.setAttribute("data-passage-dismiss-exempt", "");
    document.body.appendChild(exemptToolbar);

    exemptPortal = document.createElement("div");
    exemptPortal.setAttribute("data-passage-dismiss-exempt", "");
    document.body.appendChild(exemptPortal);

    feedbackFabButton = document.createElement("button");
    feedbackFabButton.setAttribute("data-passage-dismiss-exempt", "");
    document.body.appendChild(feedbackFabButton);

    devLogPanel = document.createElement("div");
    devLogPanel.setAttribute("data-passage-dismiss-exempt", "");
    document.body.appendChild(devLogPanel);
  });

  afterEach(() => {
    outsideDiv.remove();
    noteSurface.remove();
    exemptToolbar.remove();
    exemptPortal.remove();
    feedbackFabButton.remove();
    devLogPanel.remove();
  });

  function renderUiState() {
    return renderHook(() => usePassageNotesUiState(defaultOptions()));
  }

  function openVerseNotes(result: { current: PassageNotesUiState }) {
    act(() => {
      result.current.openVerseNotes(1);
    });
    expect(result.current.openVerseKeys.has(1)).toBe(true);
  }

  it("closes open verse notes when clicking ordinary outside space", () => {
    const { result } = renderUiState();
    openVerseNotes(result);

    clickElement(outsideDiv);

    expect(result.current.openVerseKeys.size).toBe(0);
    expect(result.current.selectedVerses.size).toBe(0);
  });

  it("does NOT close verse notes when clicking a note surface", () => {
    const { result } = renderUiState();
    openVerseNotes(result);

    clickElement(noteSurface);

    expect(result.current.openVerseKeys.has(1)).toBe(true);
  });

  it("does NOT close verse notes when clicking dismiss-exempt toolbar", () => {
    const { result } = renderUiState();
    openVerseNotes(result);

    clickElement(exemptToolbar);

    expect(result.current.openVerseKeys.has(1)).toBe(true);
    expect(result.current.selectedVerses.has(1)).toBe(true);
  });

  it("does NOT close verse notes when clicking dismiss-exempt portal content", () => {
    const { result } = renderUiState();
    openVerseNotes(result);

    clickElement(exemptPortal);

    expect(result.current.openVerseKeys.has(1)).toBe(true);
  });

  it("does NOT close verse notes when clicking a child of dismiss-exempt element", () => {
    const child = document.createElement("button");
    exemptToolbar.appendChild(child);

    const { result } = renderUiState();
    openVerseNotes(result);

    clickElement(child);

    expect(result.current.openVerseKeys.has(1)).toBe(true);

    child.remove();
  });

  it("does NOT close verse notes when clicking the feedback fab button", () => {
    const { result } = renderUiState();
    openVerseNotes(result);

    clickElement(feedbackFabButton);

    expect(result.current.openVerseKeys.has(1)).toBe(true);
    expect(result.current.selectedVerses.has(1)).toBe(true);
  });

  it("does NOT close verse notes when clicking inside the dev log panel", () => {
    const panelAction = document.createElement("button");
    devLogPanel.appendChild(panelAction);

    const { result } = renderUiState();
    openVerseNotes(result);

    clickElement(panelAction);

    expect(result.current.openVerseKeys.has(1)).toBe(true);
    expect(result.current.selectedVerses.has(1)).toBe(true);

    panelAction.remove();
  });

  it("preserves dirty editors on outside click", () => {
    const { result } = renderUiState();
    openVerseNotes(result);

    act(() => {
      result.current.handleAddNote(1);
    });

    const editorKey = Array.from(result.current.openEditors.keys())[0];
    expect(editorKey).toBeDefined();

    act(() => {
      result.current.notifyEditorDirty(editorKey, true);
    });
    expect(result.current.hasDirtyEditors).toBe(true);

    clickElement(outsideDiv);

    expect(result.current.openVerseKeys.size).toBe(0);
    expect(result.current.openEditors.has(editorKey)).toBe(true);
  });

  it("does NOT close a dirty draft when clicking an overlay nudge", () => {
    const nudge = document.createElement("button");
    nudge.setAttribute("data-verse-nudge", "end:grow");
    document.body.appendChild(nudge);

    const { result } = renderUiState();
    act(() => {
      result.current.handleAddNote(1);
    });
    const key = Array.from(result.current.openEditors.keys())[0];
    act(() => {
      result.current.notifyEditorDirty(key, true);
    });

    clickElement(nudge);

    expect(result.current.openEditors.has(key)).toBe(true);
    expect(result.current.hasDirtyEditors).toBe(true);
    nudge.remove();
  });
});

describe("usePassageNotesUiState view mode switch", () => {
  const passageNote: NoteWithRef = {
    noteId: "n1" as Id<"notes">,
    content: "",
    tags: [],
    verseRef: {
      book: "Genesis",
      chapter: 1,
      startVerse: 1,
      endVerse: 2,
    },
    createdAt: 0,
  };

  it("clears notes surface and calls setViewMode when switching with no dirty editors", () => {
    const setViewMode = vi.fn();
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        setViewMode,
        passageNotesByAnchor: new Map([[1, [passageNote]]]),
      }),
    );

    act(() => {
      result.current.openPassageNotes(1);
    });
    expect(result.current.openPassageKeys.has(1)).toBe(true);
    expect(result.current.selectedVerses.size).toBeGreaterThan(0);

    act(() => {
      result.current.setViewModeWithNotesReset("read");
    });

    expect(setViewMode).toHaveBeenCalledWith("read");
    expect(result.current.openPassageKeys.size).toBe(0);
    expect(result.current.selectedVerses.size).toBe(0);
  });

  it("opens discard confirmation when switching with dirty editors; confirm applies mode", () => {
    const setViewMode = vi.fn();
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        setViewMode,
      }),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    const editorKey = Array.from(result.current.openEditors.keys())[0];
    expect(editorKey).toBeDefined();

    act(() => {
      result.current.notifyEditorDirty(editorKey, true);
    });

    act(() => {
      result.current.setViewModeWithNotesReset("read");
    });

    expect(setViewMode).not.toHaveBeenCalled();
    expect(result.current.showDiscardConfirmation).toBe(true);
    expect(result.current.openEditors.has(editorKey)).toBe(true);

    act(() => {
      result.current.confirmDiscard();
    });

    expect(setViewMode).toHaveBeenCalledWith("read");
    expect(result.current.showDiscardConfirmation).toBe(false);
    expect(result.current.openEditors.size).toBe(0);
  });

  it("cancel discard leaves mode unchanged and clears pending switch", () => {
    const setViewMode = vi.fn();
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        setViewMode,
      }),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    const editorKey = Array.from(result.current.openEditors.keys())[0];

    act(() => {
      result.current.notifyEditorDirty(editorKey, true);
    });

    act(() => {
      result.current.setViewModeWithNotesReset("read");
    });

    act(() => {
      result.current.cancelDiscard();
    });

    expect(setViewMode).not.toHaveBeenCalled();
    expect(result.current.showDiscardConfirmation).toBe(false);
    expect(result.current.openEditors.has(editorKey)).toBe(true);
  });
});

describe("usePassageNotesUiState single-verse click behavior", () => {
  const passageNote: NoteWithRef = {
    noteId: "p1" as Id<"notes">,
    content: "",
    tags: [],
    verseRef: {
      book: "Genesis",
      chapter: 1,
      startVerse: 1,
      endVerse: 3,
    },
    createdAt: 0,
  };

  it("does not auto-open passage notes when clicking a passage anchor verse", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        passageNotesByAnchor: new Map([[1, [passageNote]]]),
        verseToPassageAnchor: new Map([
          [1, 1],
          [2, 1],
          [3, 1],
        ]),
      }),
    );

    act(() => {
      result.current.handleMouseUp();
    });

    expect(result.current.openPassageKeys.size).toBe(0);
    expect(result.current.openEditors.has("new:1:1")).toBe(true);
  });
});

describe("usePassageNotesUiState read-mode single-editor gate", () => {
  function readModeOptions() {
    return {
      ...defaultOptions(),
      viewMode: "read" as const,
    };
  }

  it("allows opening an editor when none is active", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(readModeOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });

    expect(result.current.openEditors.size).toBe(1);
    expect(result.current.showDiscardConfirmation).toBe(false);
  });

  it("silently replaces a clean editor when opening another", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(readModeOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    expect(result.current.openEditors.size).toBe(1);
    const firstKey = Array.from(result.current.openEditors.keys())[0];

    act(() => {
      result.current.handleAddNote(2);
    });
    expect(result.current.openEditors.size).toBe(1);
    expect(result.current.openEditors.has(firstKey)).toBe(false);
  });

  it("shows discard confirmation when replacing a dirty editor", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(readModeOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    const firstKey = Array.from(result.current.openEditors.keys())[0];

    act(() => {
      result.current.notifyEditorDirty(firstKey, true);
    });

    act(() => {
      result.current.handleAddNote(2);
    });
    expect(result.current.showDiscardConfirmation).toBe(true);
    expect(result.current.openEditors.has(firstKey)).toBe(true);
    expect(result.current.openEditors.size).toBe(1);
  });

  it("confirm discard replaces the dirty editor with the new one", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(readModeOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    const firstKey = Array.from(result.current.openEditors.keys())[0];

    act(() => {
      result.current.notifyEditorDirty(firstKey, true);
    });

    act(() => {
      result.current.handleAddNote(2);
    });

    act(() => {
      result.current.confirmDiscard();
    });

    expect(result.current.showDiscardConfirmation).toBe(false);
    expect(result.current.openEditors.has(firstKey)).toBe(false);
    expect(result.current.openEditors.size).toBe(1);
    const newKey = Array.from(result.current.openEditors.keys())[0];
    expect(newKey).toContain("new:2:2");
  });

  it("cancel discard keeps the original dirty editor", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(readModeOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    const firstKey = Array.from(result.current.openEditors.keys())[0];

    act(() => {
      result.current.notifyEditorDirty(firstKey, true);
    });

    act(() => {
      result.current.handleAddNote(2);
    });

    act(() => {
      result.current.cancelDiscard();
    });

    expect(result.current.showDiscardConfirmation).toBe(false);
    expect(result.current.openEditors.has(firstKey)).toBe(true);
    expect(result.current.openEditors.size).toBe(1);
  });

  it("startEditingNote replaces a clean draft in read mode", () => {
    const noteId = "n1" as Id<"notes">;
    const verseRef = {
      book: "Genesis",
      chapter: 1,
      startVerse: 3,
      endVerse: 3,
    };
    const { result } = renderHook(() =>
      usePassageNotesUiState(readModeOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    expect(result.current.openEditors.size).toBe(1);

    act(() => {
      result.current.startEditingNote(noteId, verseRef, 3, false);
    });
    expect(result.current.openEditors.size).toBe(1);
    expect(result.current.editingNoteIds.has(noteId)).toBe(true);
  });

  it("does not gate in compose mode — multiple editors allowed", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(defaultOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });
    act(() => {
      result.current.handleAddNote(2);
    });

    expect(result.current.openEditors.size).toBe(2);
  });
});

describe("usePassageNotesUiState editor cancellation", () => {
  const singleVerseNote: NoteWithRef = {
    noteId: "n1" as Id<"notes">,
    content: "",
    tags: [],
    verseRef: {
      book: "Genesis",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    },
    createdAt: 0,
  };

  it("clears verse selection when cancelling a new draft on an empty verse", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(defaultOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });

    const editorKey = Array.from(result.current.openEditors.keys())[0];
    expect(editorKey).toBe("new:1:1");
    expect(result.current.selectedVerses.has(1)).toBe(true);

    act(() => {
      result.current.cancelEditor(editorKey);
    });

    expect(result.current.openEditors.size).toBe(0);
    expect(result.current.selectedVerses.size).toBe(0);
  });

  it("preserves verse selection when cancelling a draft over open existing notes", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        singleVerseNotes: new Map([[1, [singleVerseNote]]]),
      }),
    );

    act(() => {
      result.current.openVerseNotes(1);
      result.current.handleAddNote(1);
    });

    const editorKey = Array.from(result.current.openEditors.keys())[0];
    expect(editorKey).toBe("new:1:1");
    expect(result.current.selectedVerses.has(1)).toBe(true);

    act(() => {
      result.current.cancelEditor(editorKey);
    });

    expect(result.current.openEditors.size).toBe(0);
    expect(result.current.openVerseKeys.has(1)).toBe(true);
    expect(result.current.selectedVerses.has(1)).toBe(true);
  });

  it("clears lingering selection state when the last verse note is deleted", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        singleVerseNotes: new Map([[1, [singleVerseNote]]]),
      }),
    );

    act(() => {
      result.current.openVerseNotes(1);
    });

    expect(result.current.openVerseKeys.has(1)).toBe(true);
    expect(result.current.selectedVerses.has(1)).toBe(true);

    act(() => {
      result.current.handleNoteDeleteCleanup("n1" as Id<"notes">, 1, false);
    });

    expect(result.current.openVerseKeys.has(1)).toBe(false);
    expect(result.current.selectedVerses.has(1)).toBe(false);
    expect(result.current.isPassageSelection).toBe(false);
    expect(clearSelectionMock).toHaveBeenCalled();
  });
});

describe("usePassageNotesUiState focus mode save behavior", () => {
  const singleVerseNote: NoteWithRef = {
    noteId: "single-1" as Id<"notes">,
    content: "",
    tags: [],
    verseRef: {
      book: "Genesis",
      chapter: 1,
      startVerse: 1,
      endVerse: 1,
    },
    createdAt: 0,
  };

  const passageNote: NoteWithRef = {
    noteId: "passage-3" as Id<"notes">,
    content: "",
    tags: [],
    verseRef: {
      book: "Genesis",
      chapter: 1,
      startVerse: 3,
      endVerse: 5,
    },
    createdAt: 0,
  };

  it("keeps only the most recently opened verse when focus mode is enabled", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        singleVerseNotes: new Map([
          [1, [singleVerseNote]],
          [
            2,
            [
              {
                ...singleVerseNote,
                noteId: "single-2" as Id<"notes">,
                verseRef: {
                  ...singleVerseNote.verseRef,
                  startVerse: 2,
                  endVerse: 2,
                },
              },
            ],
          ],
        ]),
      }),
    );

    act(() => {
      result.current.openVerseNotes(1);
      result.current.openVerseNotes(2);
    });

    act(() => {
      result.current.normalizeForFocusMode();
    });

    expect(result.current.openVerseKeys).toEqual(new Set([2]));
    expect(result.current.openPassageKeys.size).toBe(0);
    expect(result.current.selectedVerses).toEqual(new Set([2]));
  });

  it("keeps only the most recently opened passage when focus mode is enabled", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        passageNotesByAnchor: new Map([
          [3, [passageNote]],
          [
            7,
            [
              {
                ...passageNote,
                noteId: "passage-7" as Id<"notes">,
                verseRef: {
                  ...passageNote.verseRef,
                  startVerse: 7,
                  endVerse: 8,
                },
              },
            ],
          ],
        ]),
      }),
    );

    act(() => {
      result.current.openPassageNotes(3);
      result.current.openPassageNotes(7);
    });

    act(() => {
      result.current.normalizeForFocusMode();
    });

    expect(result.current.openPassageKeys).toEqual(new Set([7]));
    expect(result.current.openVerseKeys.size).toBe(0);
    expect(result.current.selectedVerses).toEqual(new Set([7, 8]));
  });

  it("prefers the focused editor over a newer non-editor target", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        singleVerseNotes: new Map([
          [1, [singleVerseNote]],
          [
            2,
            [
              {
                ...singleVerseNote,
                noteId: "single-2" as Id<"notes">,
                verseRef: {
                  ...singleVerseNote.verseRef,
                  startVerse: 2,
                  endVerse: 2,
                },
              },
            ],
          ],
        ]),
      }),
    );

    act(() => {
      result.current.handleAddNote(1);
    });

    act(() => {
      result.current.openVerseNotes(2);
      result.current.handleEditorFocus("new:1:1");
    });

    act(() => {
      result.current.normalizeForFocusMode();
    });

    expect(result.current.openEditors.has("new:1:1")).toBe(true);
    expect(result.current.openEditors.size).toBe(1);
    expect(result.current.openVerseKeys).toEqual(new Set([1]));
    expect(result.current.selectedVerses).toEqual(new Set([1]));
  });

  it("prefers the current selection when no editor is focused", () => {
    mockSelectionStart = 4;
    mockSelectionEnd = 6;

    const { result, rerender } = renderHook(() =>
      usePassageNotesUiState(defaultOptions()),
    );

    act(() => {
      result.current.openVerseNotes(2);
    });

    rerender();

    act(() => {
      result.current.normalizeForFocusMode();
    });

    expect(result.current.openPassageKeys).toEqual(new Set([4]));
    expect(result.current.openVerseKeys.size).toBe(0);
    expect(result.current.selectedVerses).toEqual(new Set([4, 5, 6]));
  });

  it("preserves dirty non-focused editors during normalization", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(defaultOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
      result.current.handleAddNote(2);
    });

    act(() => {
      result.current.notifyEditorDirty("new:1:1", true);
      result.current.notifyEditorDirty("new:2:2", true);
      result.current.handleEditorFocus("new:2:2");
    });

    act(() => {
      result.current.normalizeForFocusMode();
    });

    expect(result.current.openEditors.size).toBe(2);
    expect(result.current.openEditors.has("new:1:1")).toBe(true);
    expect(result.current.openEditors.has("new:2:2")).toBe(true);
    expect(result.current.hasDirtyEditors).toBe(true);
    expect(result.current.openVerseKeys).toEqual(new Set([2]));
    expect(result.current.selectedVerses).toEqual(new Set([1, 2]));
  });

  it("retains the focused dirty editor during normalization", () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(defaultOptions()),
    );

    act(() => {
      result.current.handleAddNote(3);
    });

    act(() => {
      result.current.notifyEditorDirty("new:3:3", true);
      result.current.handleEditorFocus("new:3:3");
    });

    act(() => {
      result.current.normalizeForFocusMode();
    });

    expect(result.current.openEditors.has("new:3:3")).toBe(true);
    expect(result.current.hasDirtyEditors).toBe(true);
    expect(result.current.selectedVerses).toEqual(new Set([3]));
  });

  it("advances to the next verse draft after saving a single-verse note", async () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        isFocusMode: true,
      }),
    );

    act(() => {
      result.current.handleAddNote(1);
    });

    await act(async () => {
      await result.current.handleSaveNew(
        {
          book: "Genesis",
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
        },
        EMPTY_NOTE_BODY,
        [],
      );
    });

    expect(result.current.openEditors.size).toBe(1);
    expect(result.current.openEditors.has("new:2:2")).toBe(true);
    expect(result.current.selectedVerses).toEqual(new Set([2]));
    expect(result.current.openPassageKeys.size).toBe(0);
    expect(result.current.openVerseKeys.size).toBe(0);
  });

  it("opens the next verse notes when the auto-advanced verse already has notes", async () => {
    const nextVerseNote: NoteWithRef = {
      noteId: "n2" as Id<"notes">,
      content: "",
      tags: [],
      verseRef: {
        book: "Genesis",
        chapter: 1,
        startVerse: 2,
        endVerse: 2,
      },
      createdAt: 0,
    };

    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        isFocusMode: true,
        singleVerseNotes: new Map([[2, [nextVerseNote]]]),
      }),
    );

    act(() => {
      result.current.handleAddNote(1);
    });

    await act(async () => {
      await result.current.handleSaveNew(
        {
          book: "Genesis",
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
        },
        EMPTY_NOTE_BODY,
        [],
      );
    });

    expect(result.current.openEditors.size).toBe(1);
    expect(result.current.openEditors.has("new:2:2")).toBe(true);
    expect(result.current.selectedVerses).toEqual(new Set([2]));
    expect(result.current.openVerseKeys).toEqual(new Set([2]));
    expect(result.current.openPassageKeys.size).toBe(0);
  });

  it("stops at the end of the chapter when saving the final verse", async () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        isFocusMode: true,
      }),
    );

    act(() => {
      result.current.handleAddNote(31);
    });

    await act(async () => {
      await result.current.handleSaveNew(
        {
          book: "Genesis",
          chapter: 1,
          startVerse: 31,
          endVerse: 31,
        },
        EMPTY_NOTE_BODY,
        [],
      );
    });

    expect(result.current.openEditors.size).toBe(0);
    expect(result.current.openVerseKeys).toEqual(new Set([31]));
    expect(result.current.openPassageKeys.size).toBe(0);
  });

  it("keeps passage-note saves unchanged in focus mode", async () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        isFocusMode: true,
      }),
    );

    act(() => {
      result.current.startCreatingPassageNote({
        book: "Genesis",
        chapter: 1,
        startVerse: 3,
        endVerse: 5,
      });
    });

    await act(async () => {
      await result.current.handleSaveNew(
        {
          book: "Genesis",
          chapter: 1,
          startVerse: 3,
          endVerse: 5,
        },
        EMPTY_NOTE_BODY,
        [],
      );
    });

    expect(result.current.openEditors.size).toBe(0);
    expect(result.current.openPassageKeys).toEqual(new Set([3]));
    expect(result.current.openVerseKeys.size).toBe(0);
  });

  it("keeps non-focus single-verse saves unchanged", async () => {
    const { result } = renderHook(() =>
      usePassageNotesUiState(defaultOptions()),
    );

    act(() => {
      result.current.handleAddNote(1);
    });

    await act(async () => {
      await result.current.handleSaveNew(
        {
          book: "Genesis",
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
        },
        EMPTY_NOTE_BODY,
        [],
      );
    });

    expect(result.current.openEditors.size).toBe(0);
    expect(result.current.openEditors.has("new:2:2")).toBe(false);
    expect(result.current.openVerseKeys).toEqual(new Set([1]));
  });
});

function johnRef(startVerse: number, endVerse: number) {
  return { book: "John", chapter: 1, startVerse, endVerse };
}

describe("usePassageNotesUiState retargetNewDraft", () => {
  function renderJohn() {
    return renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        book: "John",
        chapter: 1,
      }),
    );
  }

  it("keeps the create-time key, dirty bit, and snapshot across 16 → 16–17 → 15–17", () => {
    const { result } = renderJohn();

    act(() => {
      result.current.handleAddNote(16);
    });
    expect(result.current.openEditors.has("new:16:16")).toBe(true);

    act(() => {
      result.current.notifyEditorDirty("new:16:16", true);
    });

    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(16, 17), {
        body: "Draft stays",
        tags: ["hope"],
      });
    });
    expect(result.current.inPlaceRetargetActive).toBe(false);
    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(15, 17), {
        body: "Draft stays",
        tags: ["hope"],
      });
    });

    const slot = result.current.openEditors.get("new:16:16");
    expect(slot?.kind).toBe("new");
    if (slot?.kind !== "new") return;
    expect(slot.editorKey).toBe("new:16:16");
    expect(slot.verseRef).toEqual(johnRef(15, 17));
    expect(slot.snapshot).toEqual({ body: "Draft stays", tags: ["hope"] });
    expect(result.current.hasDirtyEditors).toBe(true);
    expect(result.current.retargetingEditorKey).toBe("new:16:16");
    expect(result.current.inPlaceRetargetActive).toBe(true);
    expect(result.current.newDraftsByAnchor.get(15)?.[0]).toMatchObject({
      editorKey: "new:16:16",
      snapshot: { body: "Draft stays", tags: ["hope"] },
    });
    expect(result.current.newDraftsByAnchor.has(16)).toBe(false);
    expect(result.current.selectedVerses).toEqual(new Set([15, 16, 17]));
    expect(result.current.isPassageSelection).toBe(true);
    expect(result.current.expandedPassageRanges).toEqual([
      { anchorVerse: 15, startVerse: 15, endVerse: 17 },
    ]);
  });

  it("no-ops when the span is unchanged or the key is an edit slot", () => {
    const { result } = renderJohn();
    act(() => {
      result.current.handleAddNote(16);
    });
    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(16, 16), {
        body: "ignored",
        tags: [],
      });
    });
    const slot = result.current.openEditors.get("new:16:16");
    expect(slot?.kind).toBe("new");
    if (slot?.kind === "new") expect(slot.snapshot).toBeUndefined();
    expect(result.current.retargetingEditorKey).toBeNull();
    expect(result.current.inPlaceRetargetActive).toBe(false);

    act(() => {
      result.current.startEditingNote(
        "note-16" as Id<"notes">,
        johnRef(16, 16),
        16,
        false,
      );
    });
    const editSlot = result.current.openEditors.get("edit:note-16");
    act(() => {
      result.current.retargetNewDraft("edit:note-16", johnRef(15, 16), {
        body: "nope",
        tags: [],
      });
    });
    expect(result.current.openEditors.get("edit:note-16")).toEqual(editSlot);
  });

  it("does not arm in-place retarget motion on first 1→2 grouping", () => {
    const { result } = renderJohn();
    act(() => {
      result.current.handleAddNote(16);
    });
    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(16, 17), {
        body: "first group",
        tags: [],
      });
    });
    expect(result.current.retargetingEditorKey).toBe("new:16:16");
    expect(result.current.inPlaceRetargetActive).toBe(false);
    expect(result.current.expandedPassageRanges).toEqual([
      { anchorVerse: 16, startVerse: 16, endVerse: 17 },
    ]);
  });

  it("treats the current span as occupancy and allocates a new key for the freed verse", () => {
    const { result } = renderJohn();
    act(() => {
      result.current.handleAddNote(16);
    });
    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(16, 17), {
        body: "kept",
        tags: [],
      });
    });
    act(() => {
      result.current.startCreatingPassageNote(johnRef(16, 17));
    });
    expect(result.current.openEditors.size).toBe(1);

    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(17, 17), {
        body: "kept",
        tags: [],
      });
    });
    act(() => {
      result.current.handleAddNote(16);
    });

    expect(result.current.openEditors.size).toBe(2);
    const moved = result.current.openEditors.get("new:16:16");
    expect(moved?.kind).toBe("new");
    if (moved?.kind === "new") expect(moved.verseRef).toEqual(johnRef(17, 17));
    const reopened = result.current.openEditors.get("new:16:16:2");
    expect(reopened?.kind).toBe("new");
    if (reopened?.kind === "new") {
      expect(reopened.verseRef).toEqual(johnRef(16, 16));
    }
  });

  it("saves and cancels a retargeted draft by its original key at the new span", async () => {
    const onSaveNewNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        book: "John",
        chapter: 1,
        onSaveNewNote,
      }),
    );

    act(() => {
      result.current.handleAddNote(16);
    });
    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(16, 17), {
        body: "kept",
        tags: ["a"],
      });
    });

    await act(async () => {
      await result.current.handleSaveNew(johnRef(16, 17), EMPTY_NOTE_BODY, [
        "a",
      ]);
    });

    expect(onSaveNewNote).toHaveBeenCalledWith(
      johnRef(16, 17),
      EMPTY_NOTE_BODY,
      ["a"],
    );
    expect(result.current.openEditors.size).toBe(0);
    expect(result.current.retargetingEditorKey).toBeNull();
    expect(result.current.inPlaceRetargetActive).toBe(false);

    act(() => {
      result.current.handleAddNote(16);
    });
    act(() => {
      result.current.retargetNewDraft("new:16:16", johnRef(15, 16), {
        body: "kept",
        tags: [],
      });
    });
    act(() => {
      result.current.cancelEditor("new:16:16");
    });
    expect(result.current.openEditors.size).toBe(0);
  });
});

describe("usePassageNotesUiState retargetEditNote", () => {
  const savedNoteId = "note-16" as Id<"notes">;

  function renderJohn() {
    return renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        book: "John",
        chapter: 1,
      }),
    );
  }

  it("updates a saved note's live verseRef and arms grouping", () => {
    const { result } = renderJohn();
    act(() => {
      result.current.startEditingNote(savedNoteId, johnRef(16, 16), 16, false);
    });

    act(() => {
      result.current.retargetEditNote(savedNoteId, johnRef(16, 17), {
        body: "Saved body",
        tags: ["hope"],
      });
    });

    const slot = result.current.openEditors.get("edit:note-16");
    expect(slot?.kind).toBe("edit");
    if (slot?.kind !== "edit") return;
    expect(slot.verseRef).toEqual(johnRef(16, 17));
    expect(slot.originalVerseRef).toEqual(johnRef(16, 16));
    expect(slot.snapshot).toEqual({ body: "Saved body", tags: ["hope"] });
    expect(result.current.savedEditOverrides.get(savedNoteId)?.rangeDirty).toBe(
      true,
    );
    expect(result.current.inPlaceRetargetActive).toBe(false);
    expect(result.current.expandedPassageRanges).toEqual([
      { anchorVerse: 16, startVerse: 16, endVerse: 17 },
    ]);
    expect(result.current.editComposersByAnchor.get(16)?.[0]?.noteId).toBe(
      savedNoteId,
    );
  });

  it("passes the retargeted verseRef on save and skips it when unchanged", async () => {
    const onSaveEditNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        book: "John",
        chapter: 1,
        onSaveEditNote,
      }),
    );

    act(() => {
      result.current.startEditingNote(savedNoteId, johnRef(16, 16), 16, false);
    });
    await act(async () => {
      await result.current.handleSaveEdit(savedNoteId, EMPTY_NOTE_BODY, [
        "hope",
      ]);
    });
    expect(onSaveEditNote).toHaveBeenCalledWith(
      savedNoteId,
      EMPTY_NOTE_BODY,
      ["hope"],
      undefined,
    );

    act(() => {
      result.current.startEditingNote(savedNoteId, johnRef(16, 16), 16, false);
    });
    act(() => {
      result.current.retargetEditNote(savedNoteId, johnRef(15, 16), {
        body: "Saved body",
        tags: ["hope"],
      });
    });
    await act(async () => {
      await result.current.handleSaveEdit(savedNoteId, EMPTY_NOTE_BODY, [
        "hope",
      ]);
    });
    expect(onSaveEditNote).toHaveBeenLastCalledWith(
      savedNoteId,
      EMPTY_NOTE_BODY,
      ["hope"],
      johnRef(15, 16),
    );
  });
});

describe("usePassageNotesUiState draft overlap with saved passages", () => {
  const saved715: NoteWithRef = {
    noteId: "john-7-15" as Id<"notes">,
    content: "Saved 7–15",
    tags: [],
    verseRef: johnRef(7, 15),
    createdAt: 1,
  };
  const saved1215: NoteWithRef = {
    noteId: "john-12-15" as Id<"notes">,
    content: "Saved 12–15",
    tags: [],
    verseRef: johnRef(12, 15),
    createdAt: 1,
  };

  function renderJohnWithPassages(
    passageNotesByAnchor: Map<number, NoteWithRef[]>,
  ) {
    return renderHook(() =>
      usePassageNotesUiState({
        ...defaultOptions(),
        book: "John",
        chapter: 1,
        passageNotesByAnchor,
      }),
    );
  }

  it("collapses an expanded saved passage when a draft grows into it", () => {
    const { result } = renderJohnWithPassages(new Map([[7, [saved715]]]));

    act(() => {
      result.current.openPassageNotes(7);
    });
    expect(result.current.openPassageKeys).toEqual(new Set([7]));
    expect(result.current.expandedPassageRanges).toEqual([
      { anchorVerse: 7, startVerse: 7, endVerse: 15 },
    ]);

    act(() => {
      result.current.handleAddNote(4);
    });
    act(() => {
      result.current.retargetNewDraft("new:4:4", johnRef(4, 11), {
        body: "draft",
        tags: [],
      });
    });

    expect(result.current.openPassageKeys.size).toBe(0);
    expect(result.current.expandedPassageRanges).toEqual([
      { anchorVerse: 4, startVerse: 4, endVerse: 11 },
    ]);
    expect(result.current.newDraftsByAnchor.get(4)?.[0]?.verseRef).toEqual(
      johnRef(4, 11),
    );
  });

  it("keeps a closed saved note collapsed and on the draft group when its start is covered", () => {
    const byAnchor = new Map([[12, [saved1215]]]);
    const { result } = renderJohnWithPassages(byAnchor);

    act(() => {
      result.current.handleAddNote(4);
    });
    act(() => {
      result.current.retargetNewDraft("new:4:4", johnRef(4, 12), {
        body: "draft",
        tags: [],
      });
    });

    expect(result.current.openPassageKeys.size).toBe(0);
    expect(result.current.expandedPassageRanges).toEqual([
      { anchorVerse: 4, startVerse: 4, endVerse: 12 },
    ]);
    expect(collectPassageNotesStartingInRange(byAnchor, 4, 12)).toEqual([
      saved1215,
    ]);
  });

  it("collapses an intersecting open passage for a fresh multi-verse draft", () => {
    const { result } = renderJohnWithPassages(new Map([[7, [saved715]]]));

    act(() => {
      result.current.openPassageNotes(7);
    });
    act(() => {
      result.current.startCreatingPassageNote(johnRef(4, 11));
    });

    expect(result.current.openPassageKeys.size).toBe(0);
    expect(result.current.expandedPassageRanges).toEqual([
      { anchorVerse: 4, startVerse: 4, endVerse: 11 },
    ]);
  });
});
