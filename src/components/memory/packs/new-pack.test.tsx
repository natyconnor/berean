import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";

import { NewPack } from "./new-pack";

const mocks = vi.hoisted(() => ({
  createAndMemorize: vi.fn(),
  navigate: vi.fn(),
  openSheet: vi.fn(),
  toastSuccess: vi.fn(),
  hearts: [] as unknown[],
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useCanGoBack: () => false,
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.createAndMemorize,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => [],
  usePaginatedQuery: () => ({
    results: mocks.hearts,
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    packs: { createAndMemorize: "packs.createAndMemorize" },
    savedVerses: {
      listHearted: "savedVerses.listHearted",
      listForChapter: "savedVerses.listForChapter",
    },
  },
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: (ref: { book: string; startVerse: number } | null) => ({
    data: ref
      ? { verses: [{ number: ref.startVerse, text: `${ref.book} text.` }] }
      : null,
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-near-viewport-visible", () => ({
  useNearViewportVisible: () => true,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

function renderNewPack(startSpan: VerseSpan | null = null) {
  return render(
    <TooltipProvider>
      <NewPack startSpan={startSpan} />
    </TooltipProvider>,
  );
}

async function addByReference(reference: string) {
  const search = screen.getByRole("searchbox", { name: "Search by reference" });
  await userEvent.clear(search);
  await userEvent.type(search, reference);
  await userEvent.click(screen.getByRole("button", { name: /^Add / }));
}

function inThisPack() {
  return within(screen.getByRole("region", { name: "In this pack" }));
}

function pickedNames() {
  return inThisPack()
    .queryAllByRole("listitem")
    .map((item) => item.firstElementChild?.nextElementSibling?.textContent);
}

beforeEach(() => {
  mocks.createAndMemorize.mockReset();
  mocks.createAndMemorize.mockResolvedValue({ packId: "pack1" });
  mocks.navigate.mockReset();
  mocks.openSheet.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.hearts = [];
});

describe("NewPack", () => {
  it("keeps Create pack disabled until there is a name and a verse", async () => {
    renderNewPack();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "New pack",
    );
    expect(
      screen.getByText("Pick verses for a theme, a group, or a season"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
      "href",
      "/memory",
    );

    const create = screen.getByRole("button", { name: "Create pack" });
    expect(create).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "Peace");
    expect(screen.getByRole("button", { name: "Create pack" })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("Name"));
    await addByReference("John 14:27");
    expect(screen.getByRole("button", { name: "Create pack" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "   ");
    expect(screen.getByRole("button", { name: "Create pack" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "Peace");
    expect(screen.getByRole("button", { name: "Create pack" })).toBeEnabled();
  });

  it("searches references only", async () => {
    renderNewPack();
    const search = screen.getByRole("searchbox", {
      name: "Search by reference",
    });
    expect(search).toHaveAttribute(
      "placeholder",
      "A reference like John 14:27",
    );

    await userEvent.type(search, "anxious");
    expect(
      screen.getByText(
        "No verse matches “anxious”. Try a reference like John 14:27.",
      ),
    ).toBeInTheDocument();
  });

  it("creates the pack, then opens it over Today with a toast", async () => {
    renderNewPack();

    await userEvent.type(
      screen.getByLabelText("Name"),
      "Peace when I'm anxious",
    );
    await addByReference("Philippians 4:6-7");
    await addByReference("John 14:27");
    await addByReference("1 Peter 5:7");

    expect(pickedNames()).toEqual([
      "Philippians 4:6–7",
      "John 14:27",
      "1 Peter 5:7",
    ]);
    expect(
      screen.getByText("3 verses · learn them in about 3 days"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^About 6 min a day, then short reviews\. Mastered in about \d+ (weeks|months)\.$/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The first steps show up in Today. Memorizing also adds these verses to your hearts.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create pack" }));

    expect(mocks.createAndMemorize).toHaveBeenCalledWith({
      name: "Peace when I'm anxious",
      spans: [
        { book: "Philippians", chapter: 4, startVerse: 6, endVerse: 7 },
        { book: "John", chapter: 14, startVerse: 27, endVerse: 27 },
        { book: "1 Peter", chapter: 5, startVerse: 7, endVerse: 7 },
      ],
      now: expect.any(Number) as number,
    });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        href: "/memory?panel=pack%3Apack1",
        replace: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Peace when I'm anxious is in Today.",
    );
  });

  it("offers a passage instead when the verses are a whole chapter", async () => {
    renderNewPack();

    await addByReference("Psalm 1");
    expect(
      screen.getByText(
        /This is all of Psalm 1\. Memorize it as a passage instead\?/,
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Memorize Psalm 1" }),
    );
    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "chapters",
      book: "Psalms",
      startChapter: 1,
      endChapter: 1,
    });
  });

  it("reorders with Move up / Move down and removes from the row menu", async () => {
    renderNewPack();
    await addByReference("John 14:27");
    await addByReference("Romans 8:28");
    await addByReference("Psalm 23:1");

    await userEvent.click(
      screen.getByRole("button", { name: "Options for Psalm 23:1" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Move up" }),
    );
    expect(pickedNames()).toEqual(["John 14:27", "Psalm 23:1", "Romans 8:28"]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Moved Psalm 23:1 to 2 of 3.",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Options for John 14:27" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Move down" }),
    );
    expect(pickedNames()).toEqual(["Psalm 23:1", "John 14:27", "Romans 8:28"]);

    await userEvent.click(
      screen.getByRole("button", { name: "Options for Romans 8:28" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remove" }),
    );
    expect(pickedNames()).toEqual(["Psalm 23:1", "John 14:27"]);
  });

  it("adds from your hearts and marks what is already in", async () => {
    mocks.hearts = [
      {
        savedVerseId: "s1",
        verseRefId: "v1",
        book: "Philippians",
        chapter: 4,
        startVerse: 6,
        endVerse: 7,
        createdAt: 1,
        inMemory: false,
      },
      {
        savedVerseId: "s2",
        verseRefId: "v2",
        book: "Psalms",
        chapter: 16,
        startVerse: 1,
        endVerse: 11,
        createdAt: 2,
        inMemory: true,
        passage: { packId: "p16", title: "Psalm 16" },
      },
    ];
    renderNewPack({ book: "John", chapter: 14, startVerse: 27, endVerse: 27 });

    expect(pickedNames()).toEqual(["John 14:27"]);
    await userEvent.click(
      screen.getByRole("button", { name: "From your hearts · 1" }),
    );
    expect(
      screen.queryByRole("button", { name: "Add Psalm 16" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Add Philippians 4:6–7" }),
    );
    expect(pickedNames()).toEqual(["John 14:27", "Philippians 4:6–7"]);
    expect(screen.getByText("Added")).toBeInTheDocument();
  });
});
