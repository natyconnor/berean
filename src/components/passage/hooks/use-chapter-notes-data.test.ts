import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteBody } from "@/lib/note-inline-content";
import { useChapterNotesData } from "./use-chapter-notes-data";

const useQueryMock = vi.fn<(reference: unknown, args?: unknown) => unknown>();
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

  it("forwards edit and delete operations to their mutations", async () => {
    useQueryMock.mockReturnValue([]);
    updateNoteMock.mockResolvedValue(undefined);
    removeNoteMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChapterNotesData("Genesis", 1));
    const body = { segments: [] } as unknown as NoteBody;

    await act(async () => {
      await result.current.saveEditedNote("note-7", body, ["updated"]);
      await result.current.deleteNote("note-7");
    });

    expect(updateNoteMock).toHaveBeenCalledWith({
      id: "note-7",
      body,
      tags: ["updated"],
    });
    expect(removeNoteMock).toHaveBeenCalledWith({ id: "note-7" });
  });
});
