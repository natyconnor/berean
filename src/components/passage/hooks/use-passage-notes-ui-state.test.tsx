import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
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
