import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  usePassageNotesUiState,
  type PassageNotesUiState,
} from "./use-passage-notes-ui-state";

vi.mock("@/hooks/use-verse-selection", () => ({
  useVerseSelection: (onComplete: (sel: { startVerse: number; endVerse: number }) => void) => ({
    selectionStart: null,
    selectionEnd: null,
    isSelecting: false,
    isInSelection: () => false,
    handleMouseDown: (_v: number) => {},
    handleMouseEnter: (_v: number) => {},
    handleMouseUp: () => {
      onComplete({ startVerse: 1, endVerse: 1 });
      return true;
    },
    clearSelection: () => {},
  }),
}));

function defaultOptions() {
  return {
    book: "Genesis",
    chapter: 1,
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

  beforeEach(() => {
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

    return () => {
      outsideDiv.remove();
      noteSurface.remove();
      exemptToolbar.remove();
      exemptPortal.remove();
    };
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
