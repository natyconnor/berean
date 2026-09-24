import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import { useChapterNotesData } from "./use-chapter-notes-data";

const useQueryMock = vi.fn<(...args: unknown[]) => unknown>();
const createNoteMock = vi.fn();
const updateNoteMock = vi.fn();
const removeNoteMock = vi.fn();
const findOrCreateRefMock = vi.fn();
const linkNoteMock = vi.fn();

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: string) => {
    switch (reference) {
      case "api.notes.create":
        return createNoteMock;
      case "api.notes.update":
        return updateNoteMock;
      case "api.notes.remove":
        return removeNoteMock;
      case "api.verseRefs.findOrCreate":
        return findOrCreateRefMock;
      case "api.noteVerseLinks.link":
        return linkNoteMock;
      default:
        throw new Error(`Unexpected mutation reference: ${reference}`);
    }
  },
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    noteVerseLinks: {
      getNotesForChapter: "api.noteVerseLinks.getNotesForChapter",
      link: "api.noteVerseLinks.link",
    },
    notes: {
      create: "api.notes.create",
      update: "api.notes.update",
      remove: "api.notes.remove",
    },
    verseRefs: {
      findOrCreate: "api.verseRefs.findOrCreate",
    },
  },
}));

describe("useChapterNotesData", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    createNoteMock.mockReset();
    updateNoteMock.mockReset();
    removeNoteMock.mockReset();
    findOrCreateRefMock.mockReset();
    linkNoteMock.mockReset();
  });

  it("builds single-verse and passage note maps from chapter query data", () => {
    useQueryMock.mockReturnValue([
      {
        verseRef: {
          book: "Genesis",
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
        },
        notes: [
          {
            _id: "note-1",
            content: "Single verse note",
            tags: ["creation"],
            createdAt: 10,
            updatedAt: 10,
          },
        ],
      },
      {
        verseRef: {
          book: "Genesis",
          chapter: 1,
          startVerse: 2,
          endVerse: 3,
        },
        notes: [
          {
            _id: "note-2",
            content: "Passage note",
            tags: ["context"],
            createdAt: 20,
            updatedAt: 20,
          },
        ],
      },
    ]);

    const { result } = renderHook(() => useChapterNotesData("Genesis", 1));

    expect(useQueryMock).toHaveBeenCalledWith(
      "api.noteVerseLinks.getNotesForChapter",
      {
        book: "Genesis",
        chapter: 1,
      },
    );
    expect(result.current.singleVerseNotes.get(1)).toEqual([
      {
        noteId: "note-1",
        content: "Single verse note",
        tags: ["creation"],
        verseRef: {
          book: "Genesis",
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
        },
        createdAt: 10,
      },
    ]);
    expect(result.current.passageNotesByAnchor.get(2)).toEqual([
      {
        noteId: "note-2",
        content: "Passage note",
        tags: ["context"],
        verseRef: {
          book: "Genesis",
          chapter: 1,
          startVerse: 2,
          endVerse: 3,
        },
        createdAt: 20,
      },
    ]);
    expect(result.current.verseToPassageAnchor.get(2)).toBe(2);
    expect(result.current.verseToPassageAnchor.get(3)).toBe(2);
    expect(result.current.chapterScopedNotes).toEqual([]);
  });

  it("maps a retargeted single-to-span note as a full passage hover range", () => {
    useQueryMock.mockReturnValue([
      {
        verseRef: {
          book: "John",
          chapter: 1,
          startVerse: 12,
          endVerse: 13,
        },
        notes: [
          {
            _id: "note-was-single",
            content: "Children of God",
            tags: [],
            createdAt: 10,
            updatedAt: 20,
          },
        ],
      },
    ]);

    const { result } = renderHook(() => useChapterNotesData("John", 1));

    expect(result.current.singleVerseNotes.get(12)).toBeUndefined();
    expect(result.current.passageNotesByAnchor.get(12)?.[0]?.verseRef).toEqual({
      book: "John",
      chapter: 1,
      startVerse: 12,
      endVerse: 13,
    });
    expect(result.current.verseToPassageAnchor.get(12)).toBe(12);
    expect(result.current.verseToPassageAnchor.get(13)).toBe(12);
  });

  it("separates chapter-scoped notes from verse 1 notes", () => {
    useQueryMock.mockReturnValue([
      {
        verseRef: {
          book: "John",
          chapter: 3,
          startVerse: 1,
          endVerse: 1,
          scope: "chapter",
        },
        notes: [
          {
            _id: "chapter-note",
            content: "Whole chapter",
            tags: ["overview"],
            createdAt: 30,
            updatedAt: 30,
          },
        ],
      },
      {
        verseRef: {
          book: "John",
          chapter: 3,
          startVerse: 1,
          endVerse: 1,
        },
        notes: [
          {
            _id: "verse-1-note",
            content: "Verse one only",
            tags: [],
            createdAt: 40,
            updatedAt: 40,
          },
        ],
      },
    ]);

    const { result } = renderHook(() => useChapterNotesData("John", 3));

    expect(result.current.chapterScopedNotes).toEqual([
      {
        noteId: "chapter-note",
        content: "Whole chapter",
        tags: ["overview"],
        verseRef: {
          book: "John",
          chapter: 3,
          startVerse: 1,
          endVerse: 1,
          scope: "chapter",
        },
        createdAt: 30,
      },
    ]);
    expect(result.current.singleVerseNotes.get(1)).toEqual([
      {
        noteId: "verse-1-note",
        content: "Verse one only",
        tags: [],
        verseRef: {
          book: "John",
          chapter: 3,
          startVerse: 1,
          endVerse: 1,
        },
        createdAt: 40,
      },
    ]);
  });

  it("creates and links a new note in order", async () => {
    useQueryMock.mockReturnValue([]);
    const callOrder: string[] = [];
    createNoteMock.mockImplementation(() => {
      callOrder.push("create");
      return Promise.resolve("note-new");
    });
    findOrCreateRefMock.mockImplementation(() => {
      callOrder.push("findRef");
      return Promise.resolve("ref-1");
    });
    linkNoteMock.mockImplementation(() => {
      callOrder.push("link");
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useChapterNotesData("Genesis", 1));
    const body = { segments: [] } as unknown as NoteBody;

    await act(async () => {
      await result.current.saveNewNote(
        {
          book: "Genesis",
          chapter: 1,
          startVerse: 4,
          endVerse: 5,
        },
        body,
        ["promise"],
      );
    });

    expect(createNoteMock).toHaveBeenCalledWith({
      body,
      tags: ["promise"],
    });
    expect(findOrCreateRefMock).toHaveBeenCalledWith({
      book: "Genesis",
      chapter: 1,
      startVerse: 4,
      endVerse: 5,
    });
    expect(linkNoteMock).toHaveBeenCalledWith({
      noteId: "note-new",
      verseRefId: "ref-1",
    });
    expect(callOrder).toEqual(["create", "findRef", "link"]);
  });

  it("passes scope when creating a chapter-scoped note", async () => {
    useQueryMock.mockReturnValue([]);
    createNoteMock.mockResolvedValue("note-chapter");
    findOrCreateRefMock.mockResolvedValue("ref-chapter");
    linkNoteMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChapterNotesData("John", 3));
    const body = { segments: [] } as unknown as NoteBody;

    await act(async () => {
      await result.current.saveNewNote(
        {
          book: "John",
          chapter: 3,
          startVerse: 1,
          endVerse: 1,
          scope: "chapter",
        },
        body,
        ["overview"],
      );
    });

    expect(findOrCreateRefMock).toHaveBeenCalledWith({
      book: "John",
      chapter: 3,
      startVerse: 1,
      endVerse: 1,
      scope: "chapter",
    });
  });

  it("forwards edit and delete operations to their mutations", async () => {
    useQueryMock.mockReturnValue([]);
    updateNoteMock.mockResolvedValue(undefined);
    removeNoteMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChapterNotesData("Genesis", 1));
    const body = { segments: [] } as unknown as NoteBody;
    const noteId = "note-7" as Id<"notes">;

    await act(async () => {
      await result.current.saveEditedNote(noteId, body, ["updated"]);
      await result.current.deleteNote(noteId);
    });

    expect(updateNoteMock).toHaveBeenCalledWith({
      id: noteId,
      body,
      tags: ["updated"],
    });
    expect(removeNoteMock).toHaveBeenCalledWith({ id: noteId });
  });

  it("forwards a retargeted verseRef on save edit", async () => {
    useQueryMock.mockReturnValue([]);
    updateNoteMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChapterNotesData("John", 1));
    const body = { segments: [] } as unknown as NoteBody;
    const noteId = "note-16" as Id<"notes">;
    const verseRef = {
      book: "John",
      chapter: 1,
      startVerse: 16,
      endVerse: 17,
    };

    await act(async () => {
      await result.current.saveEditedNote(noteId, body, ["updated"], verseRef);
    });

    expect(updateNoteMock).toHaveBeenCalledWith({
      id: noteId,
      body,
      tags: ["updated"],
      verseRef,
    });
  });
});
