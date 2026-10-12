import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VerseSpan } from "@/lib/hearted-verse-coverage";

import { HeartedList, type HeartListItem } from "./hearted-list";

const mocks = vi.hoisted(() => ({
  paginated: {
    results: [] as unknown[],
    status: "Exhausted",
    loadMore: vi.fn(),
  },
  paginatedArgs: [] as unknown[],
  openSheet: vi.fn(),
  esvCalls: [] as Array<{ span: unknown; enabled: boolean | undefined }>,
}));

vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    mocks.paginatedArgs.push(args);
    return mocks.paginated;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { savedVerses: { listHearted: "savedVerses.listHearted" } },
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: (span: VerseSpan, options?: { enabled?: boolean }) => {
    mocks.esvCalls.push({ span, enabled: options?.enabled });
    return {
      data: options?.enabled
        ? {
            verses: [
              {
                number: span.startVerse,
                text: `Text of ${span.book} ${span.chapter}:${span.startVerse}`,
              },
            ],
          }
        : null,
      loading: false,
      error: null,
    };
  },
}));

let nextId = 0;

function heart(
  span: VerseSpan,
  extra: Partial<Pick<HeartListItem, "inMemory" | "passage">> = {},
): HeartListItem {
  nextId += 1;
  return {
    savedVerseId: `saved_${nextId}` as HeartListItem["savedVerseId"],
    verseRefId: `ref_${nextId}` as HeartListItem["verseRefId"],
    ...span,
    createdAt: 1_000_000 - nextId,
    inMemory: false,
    ...extra,
  };
}

const romans828 = heart({
  book: "Romans",
  chapter: 8,
  startVerse: 28,
  endVerse: 28,
});
const psalm16Passage = heart(
  { book: "Psalms", chapter: 16, startVerse: 1, endVerse: 11 },
  {
    inMemory: true,
    passage: {
      packId: "pack_psalm16" as NonNullable<HeartListItem["passage"]>["packId"],
      title: "Psalm 16",
    },
  },
);
const romans122 = heart(
  { book: "Romans", chapter: 12, startVerse: 1, endVerse: 2 },
  { inMemory: true },
);
const john316 = heart({
  book: "John",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
});

const ALL = [romans828, psalm16Passage, romans122, john316];

function setPage(results: HeartListItem[], status = "Exhausted") {
  mocks.paginated = { results, status, loadMore: mocks.paginated.loadMore };
}

function renderList(props: Partial<Parameters<typeof HeartedList>[0]> = {}) {
  const onOpenHeart = vi.fn();
  const onMemorizeOpen = vi.fn();
  render(
    <HeartedList
      onOpenHeart={onOpenHeart}
      onMemorizeOpen={onMemorizeOpen}
      {...props}
    />,
  );
  return { onOpenHeart, onMemorizeOpen };
}

function linkNames(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

describe("HeartedList", () => {
  beforeEach(() => {
    mocks.paginated.loadMore = vi.fn();
    mocks.paginatedArgs = [];
    mocks.openSheet.mockReset();
    mocks.esvCalls = [];
    setPage(ALL);
  });

  it("reads listHearted newest first and groups rows by book", () => {
    renderList();

    expect(mocks.paginatedArgs.at(-1)).toEqual({});
    const groups = screen.getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Romans",
      "Psalms",
      "John",
    ]);
    expect(linkNames(screen.getByRole("group", { name: "Romans" }))).toEqual([
      "Romans 8:28",
      "Romans 12:1-2",
    ]);
  });

  it("lists a memorized passage once, as a passage, with a Memorizing chip", () => {
    renderList();

    const psalms = screen.getByRole("group", { name: "Psalms" });
    expect(linkNames(psalms)).toEqual(["Psalm 16 · passage"]);
    expect(within(psalms).getByText("Memorizing")).toBeInTheDocument();
    expect(within(psalms).queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows Memorize only for hearts not being memorized", () => {
    renderList();

    expect(
      screen
        .getAllByRole("button", { name: /^Memorize / })
        .map((b) => b.getAttribute("aria-label")),
    ).toEqual(["Memorize Romans 8:28", "Memorize John 3:16"]);
    const romans = screen.getByRole("group", { name: "Romans" });
    expect(within(romans).getAllByText("Memorizing")).toHaveLength(1);
  });

  it("loads one line of verse text in the reader serif", () => {
    renderList();

    const text = screen.getByText("Text of Romans 8:28");
    expect(text).toHaveClass("font-serif", "truncate");
    expect(mocks.esvCalls).toContainEqual({
      span: { book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 },
      enabled: true,
    });
  });

  it("filters by book name", async () => {
    const user = userEvent.setup();
    renderList();
    const filter = screen.getByPlaceholderText("Filter hearts…");

    await user.type(filter, "psalm");
    expect(
      screen.getAllByRole("group").map((g) => g.getAttribute("aria-label")),
    ).toEqual(["Psalms"]);

    await user.clear(filter);
    await user.type(filter, "JO");
    expect(
      screen.getAllByRole("group").map((g) => g.getAttribute("aria-label")),
    ).toEqual(["John"]);

    await user.clear(filter);
    await user.type(filter, "Genesis");
    expect(screen.queryAllByRole("group")).toEqual([]);
    expect(
      screen.getByText("No hearts in a book matching “Genesis”."),
    ).toBeInTheDocument();
  });

  it("moves through rows with Up/Down and opens one with Enter", async () => {
    const user = userEvent.setup();
    const { onOpenHeart } = renderList();
    const filter = screen.getByPlaceholderText("Filter hearts…");
    expect(filter).toHaveFocus();

    // Rendered order: Romans 8:28, Romans 12:1-2, Psalm 16, John 3:16.
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onOpenHeart).toHaveBeenCalledOnce();
    expect(onOpenHeart).toHaveBeenCalledWith(psalm16Passage);
  });

  it("moves focus between row links with Up/Down", async () => {
    const user = userEvent.setup();
    const { onOpenHeart } = renderList();

    const first = screen.getByRole("link", { name: "Romans 8:28" });
    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Romans 12:1-2" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(first).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onOpenHeart).toHaveBeenCalledWith(romans828);
  });

  it("opens the passage from the reference link", async () => {
    const user = userEvent.setup();
    const { onOpenHeart } = renderList();

    const link = screen.getByRole("link", { name: "John 3:16" });
    expect(link).toHaveAttribute(
      "href",
      "/passage/John-3?startVerse=16&endVerse=16",
    );
    await user.click(link);
    expect(onOpenHeart).toHaveBeenCalledWith(john316);
  });

  it("opens the Memorize sheet with a spans target", async () => {
    const user = userEvent.setup();
    const opener = document.createElement("button");
    document.body.append(opener);
    const { onMemorizeOpen, onOpenHeart } = renderList({
      getReturnFocusTarget: () => opener,
    });

    await user.click(
      screen.getByRole("button", { name: "Memorize Romans 8:28" }),
    );

    expect(onMemorizeOpen).toHaveBeenCalledOnce();
    expect(onOpenHeart).not.toHaveBeenCalled();
    expect(mocks.openSheet).toHaveBeenCalledWith(
      {
        kind: "spans",
        spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
      },
      { returnFocusTo: opener },
    );
    opener.remove();
  });

  it("collapses Memorize to an icon below 640px but keeps its name", () => {
    renderList();

    const button = screen.getByRole("button", {
      name: "Memorize Romans 8:28",
    });
    expect(button).toHaveClass("size-11");
    expect(within(button).getByText("Memorize")).toHaveClass(
      "hidden",
      "sm:inline",
    );
  });

  it("shows the empty state when there are no hearts", () => {
    setPage([]);
    renderList();

    expect(
      screen.getByText("No hearts yet. Tap ♥ beside any verse you love."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("offers Load more while the list has more pages", async () => {
    const user = userEvent.setup();
    setPage(ALL, "CanLoadMore");
    renderList();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(mocks.paginated.loadMore).toHaveBeenCalledWith(30);
  });
});
