import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchWorkspace } from "./search-workspace";

const openTabMock = vi.fn();
const selectNoteMock = vi.fn();
const useQueryMock = vi.fn<(reference: unknown, args?: unknown) => unknown>();

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    tags: {
      listCatalog: "api.tags.listCatalog",
    },
    notes: {
      searchWorkspace: "api.notes.searchWorkspace",
    },
  },
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    openTab: openTabMock,
  }),
}));

vi.mock("@/components/tutorial/tutorial-context", () => ({
  useTutorial: () => ({
    isTourActive: () => false,
  }),
}));

vi.mock("@/lib/tag-color-styles", () => ({
  useStarterTagBadgeStyle: () => () => undefined,
}));

vi.mock("./hooks/use-search-workspace-routing", () => ({
  useSearchWorkspaceRouting: () => ({
    query: "beloved",
    matchMode: "any",
    selectedTags: ["love"],
    selectedNoteId: undefined,
    normalizedQuery: "beloved",
    hasTextQuery: true,
    shouldSearch: true,
    updateQuery: vi.fn(),
    updateMatchMode: vi.fn(),
    toggleTag: vi.fn(),
    clearTags: vi.fn(),
    selectNote: selectNoteMock,
  }),
}));

vi.mock("./hooks/use-search-workspace-persistence", () => ({
  useSearchWorkspacePersistence: vi.fn(),
}));

vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: () => ({
    data: {
      verses: [
        { number: 16, text: "For God so loved the world" },
        { number: 17, text: "God did not send his Son into the world..." },
      ],
    },
    loading: false,
    error: null,
    query: "John 3:16-17",
  }),
}));

vi.mock("@/components/search/tag-filter-control", () => ({
  TagFilterControl: () => <div data-testid="tag-filter-control" />,
}));

describe("SearchWorkspace", () => {
  beforeEach(() => {
    openTabMock.mockReset();
    selectNoteMock.mockReset();
    useQueryMock.mockReset();
  });

  it("groups matching notes by reference and jumps to the referenced passage", () => {
    useQueryMock.mockImplementation((reference: string) => {
      if (reference === "api.tags.listCatalog") {
        return [{ tag: "love" }];
      }
      if (reference === "api.notes.searchWorkspace") {
        return [
          {
            noteId: "note-1",
            content: "Beloved children of God",
            body: null,
            tags: ["love"],
            createdAt: 1,
            updatedAt: 1,
            verseRefs: [
              {
                book: "John",
                chapter: 3,
                startVerse: 16,
                endVerse: 17,
              },
            ],
            primaryRef: {
              book: "John",
              chapter: 3,
              startVerse: 16,
              endVerse: 17,
            },
          },
          {
            noteId: "note-2",
            content: "Beloved and sent",
            body: null,
            tags: ["love"],
            createdAt: 2,
            updatedAt: 2,
            verseRefs: [
              {
                book: "John",
                chapter: 3,
                startVerse: 16,
                endVerse: 17,
              },
            ],
            primaryRef: {
              book: "John",
              chapter: 3,
              startVerse: 16,
              endVerse: 17,
            },
          },
        ];
      }
      return undefined;
    });

    render(<SearchWorkspace search={{ q: "beloved", mode: "any" }} />);

    expect(screen.getByText("Matching Notes")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("John 3:16-17")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Beloved children of God",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Beloved and sent"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go to verse/i }));

    expect(openTabMock).toHaveBeenCalledWith("John-3", "John 3", {
      source: "search",
      mode: "read",
      startVerse: 16,
      endVerse: 17,
    });
  });

  it("selects a note when a result card is clicked", () => {
    useQueryMock.mockImplementation((reference: string) => {
      if (reference === "api.tags.listCatalog") {
        return [];
      }
      if (reference === "api.notes.searchWorkspace") {
        return [
          {
            noteId: "note-9",
            content: "Beloved example",
            body: null,
            tags: [],
            createdAt: 1,
            updatedAt: 1,
            verseRefs: [],
            primaryRef: null,
          },
        ];
      }
      return undefined;
    });

    render(<SearchWorkspace search={{ q: "beloved", mode: "any" }} />);

    fireEvent.click(screen.getByRole("button", { name: /beloved example/i }));

    expect(selectNoteMock).toHaveBeenCalledWith("note-9");
  });
});
