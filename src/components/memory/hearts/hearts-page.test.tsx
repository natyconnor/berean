import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HeartsPage } from "./hearts-page";

type Heart = {
  savedVerseId: string;
  verseRefId: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  createdAt: number;
  inMemory: boolean;
};

const mocks = vi.hoisted(() => ({
  paginated: {
    results: [] as Heart[],
    status: "Exhausted",
  },
  loadMore: vi.fn(),
  openSheet: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: () => ({ ...mocks.paginated, loadMore: mocks.loadMore }),
}));
vi.mock("../../../../convex/_generated/api", () => ({
  api: { savedVerses: { listHearted: "savedVerses.listHearted" } },
}));
vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));
vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: () => ({ data: null, loading: false, error: null }),
}));

let nextId = 0;
function heart(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
  inMemory = false,
): Heart {
  nextId += 1;
  return {
    savedVerseId: `s${nextId}`,
    verseRefId: `r${nextId}`,
    book,
    chapter,
    startVerse,
    endVerse,
    createdAt: 1_000 - nextId,
    inMemory,
  };
}

beforeEach(() => {
  mocks.loadMore.mockClear();
  mocks.openSheet.mockClear();
  mocks.paginated.status = "Exhausted";
  mocks.paginated.results = [
    heart("Romans", 12, 2),
    heart("Psalms", 23, 1),
    heart("Genesis", 1, 1),
    heart("Romans", 8, 28),
    heart("John", 3, 16, 16, true),
    heart("Psalms", 1, 2),
  ];
});

function bookHeadings(): string[] {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.firstChild?.textContent ?? "");
}

describe("HeartsPage", () => {
  it("groups hearts not being memorized by book, in Bible order", () => {
    render(<HeartsPage />);

    expect(bookHeadings()).toEqual(["Genesis", "Psalms", "Romans"]);
    const romans = within(screen.getByRole("region", { name: "Romans" }));
    expect(romans.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["Romans 8:28", "Romans 12:2"],
    );
    expect(screen.queryByText("John 3:16")).not.toBeInTheDocument();
  });

  it("loads every page of hearts", () => {
    mocks.paginated.status = "CanLoadMore";
    render(<HeartsPage />);

    expect(mocks.loadMore).toHaveBeenCalledWith(100);
    expect(screen.getByText("Loading more hearts…")).toBeInTheDocument();
  });

  it("filters by book or reference", async () => {
    render(<HeartsPage />);

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Filter hearts" }),
      "Psalm 23",
    );
    expect(bookHeadings()).toEqual(["Psalms"]);
    expect(screen.getByRole("link", { name: "Psalm 23:1" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Psalm 1:2" }),
    ).not.toBeInTheDocument();

    await userEvent.clear(
      screen.getByRole("searchbox", { name: "Filter hearts" }),
    );
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Filter hearts" }),
      "Exodus",
    );
    expect(screen.getByText("No hearts match that search.")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    const filter = screen.getByRole("searchbox", { name: "Filter hearts" });
    expect(filter).toHaveValue("");
    expect(filter).toHaveFocus();
    expect(bookHeadings()).toEqual(["Genesis", "Psalms", "Romans"]);
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("opens Memorize for a heart", async () => {
    render(<HeartsPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "Memorize Genesis 1:1" }),
    );
    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [{ book: "Genesis", chapter: 1, startVerse: 1, endVerse: 1 }],
    });
  });
});
