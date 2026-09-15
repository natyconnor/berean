import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import { useChapterNotesPanel } from "./use-chapter-notes-panel";

const body = { segments: [] } as unknown as NoteBody;

function makeNote(
  overrides: Partial<NoteWithRef> & Pick<NoteWithRef, "noteId" | "content">,
): NoteWithRef {
  return {
    tags: [],
    createdAt: 1,
    verseRef: {
      book: "John",
      chapter: 3,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    },
    ...overrides,
  };
}

describe("useChapterNotesPanel", () => {
  it("opens existing notes from the header chrome and collapses when toggled", () => {
    const onSaveNew = vi.fn();
    const onSaveEdit = vi.fn();
    const onDelete = vi.fn();
    const notes = [makeNote({ noteId: "n1" as Id<"notes">, content: "A" })];

    const { result } = renderHook(() =>
      useChapterNotesPanel({
        book: "John",
        chapter: 3,
        notes,
        onSaveNew,
        onSaveEdit,
        onDelete,
      }),
    );

    expect(result.current.overlayOpen).toBe(false);

    act(() => {
      result.current.handleHeaderToggle();
    });
    expect(result.current.overlayOpen).toBe(true);
    expect(result.current.drafting).toBe(false);

    act(() => {
      result.current.handleHeaderToggle();
    });
    expect(result.current.overlayOpen).toBe(false);
  });

  it("starts a draft from the header when there are no chapter notes", () => {
    const { result } = renderHook(() =>
      useChapterNotesPanel({
        book: "John",
        chapter: 3,
        notes: [],
        onSaveNew: vi.fn(),
        onSaveEdit: vi.fn(),
        onDelete: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleHeaderToggle();
    });

    expect(result.current.overlayOpen).toBe(true);
    expect(result.current.drafting).toBe(true);
  });

  it("keeps the overlay open after saving a draft", async () => {
    const onSaveNew = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ notes }) =>
        useChapterNotesPanel({
          book: "John",
          chapter: 3,
          notes,
          onSaveNew,
          onSaveEdit: vi.fn(),
          onDelete: vi.fn(),
        }),
      { initialProps: { notes: [] as NoteWithRef[] } },
    );

    act(() => {
      result.current.startDraft();
    });

    await act(async () => {
      await result.current.saveDraft(body, ["tag"]);
    });

    expect(onSaveNew).toHaveBeenCalled();
    expect(result.current.drafting).toBe(false);
    expect(result.current.open).toBe(true);

    rerender({
      notes: [makeNote({ noteId: "n1" as Id<"notes">, content: "Saved" })],
    });
    expect(result.current.overlayOpen).toBe(true);
  });
});
