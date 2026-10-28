import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewSummary } from "@/components/memory/review-summary";
import { TooltipProvider } from "@/components/ui/tooltip";

import { SessionComplete } from "./session-complete";
import { TodaySessionSummary } from "./today-session-summary";

const mocks = vi.hoisted(() => ({
  addVerse: vi.fn(),
  createAndMemorize: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) =>
    name === "packs.createAndMemorize"
      ? mocks.createAndMemorize
      : mocks.addVerse,
}));

vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: () => ({
    results: [
      {
        _id: "pack_hope",
        name: "Verses on hope",
        kind: "custom",
        lastOpenedAt: 1,
        summary: {
          kind: "pack",
          verseCount: 2,
          learned: 0,
          mastered: 0,
          today: 0,
        },
      },
    ],
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    packs: {
      listMine: "packs.listMine",
      addVerse: "packs.addVerse",
      createAndMemorize: "packs.createAndMemorize",
    },
  },
}));

vi.mock("@/components/memory/celebrate/first-memorized-banner", () => ({
  FirstMemorizedBanner: () => null,
}));

const GENESIS_33_9 = {
  book: "Genesis",
  chapter: 33,
  startVerse: 9,
  endVerse: 9,
};
const JOHN_3_16 = { book: "John", chapter: 3, startVerse: 16, endVerse: 16 };

function renderWithTooltips(ui: ReactNode) {
  render(<TooltipProvider>{ui}</TooltipProvider>);
}

beforeEach(() => {
  mocks.addVerse.mockReset();
  mocks.addVerse.mockResolvedValue(null);
  mocks.createAndMemorize.mockReset();
  mocks.navigate.mockReset();
});

describe("Add to pack on session summaries", () => {
  it("adds a learned verse to a pack from its summary row", async () => {
    renderWithTooltips(
      <SessionComplete
        verses={[
          {
            id: "gen-33-9",
            reference: GENESIS_33_9,
            learnStage: 1,
            status: "learning",
          },
        ]}
        exitLabel="Done"
        onExit={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Add Genesis 33:9 to a pack" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Verses on hope" }),
    );

    expect(mocks.addVerse).toHaveBeenCalledWith({
      id: "pack_hope",
      ...GENESIS_33_9,
    });
    expect(
      await screen.findByRole("button", { name: /Verses on hope\s*Added/ }),
    ).toBeDisabled();
  });

  it("offers it on reviewed verses, not on a pack recited as one passage", async () => {
    renderWithTooltips(
      <ReviewSummary
        attempts={[
          { reference: JOHN_3_16, accuracy: 92 },
          {
            reference: {
              book: "Romans",
              chapter: 8,
              startVerse: 1,
              endVerse: 4,
            },
            accuracy: 80,
            label: "Romans 8",
            offerPractice: false,
          },
        ]}
        averageAccuracy={86}
        remaining={0}
        onDone={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Romans 8.* to a pack/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Add John 3:16 to a pack" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Verses on hope" }),
    );
    expect(mocks.addVerse).toHaveBeenCalledWith({
      id: "pack_hope",
      ...JOHN_3_16,
    });
  });

  it("leaves passages off the Today summary, keeping it on verse rows", () => {
    renderWithTooltips(
      <TodaySessionSummary
        passages={["Psalm 23"]}
        learned={[
          {
            id: "gen-33-9",
            reference: GENESIS_33_9,
            learnStage: 1,
            status: "learning",
          },
        ]}
        attempts={[{ reference: JOHN_3_16, accuracy: 100 }]}
        onDone={() => {}}
      />,
    );

    expect(
      screen
        .getAllByRole("button", { name: /to a pack$/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Add Genesis 33:9 to a pack", "Add John 3:16 to a pack"]);
    expect(
      screen.queryByRole("button", { name: /Psalm 23/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Practice when the last try recovered", () => {
    renderWithTooltips(
      <ReviewSummary
        attempts={[
          { reference: JOHN_3_16, accuracy: 0 },
          { reference: JOHN_3_16, accuracy: 100 },
          { reference: JOHN_3_16, accuracy: 100 },
        ]}
        averageAccuracy={67}
        remaining={0}
        onDone={() => {}}
      />,
    );

    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(
      screen.getByText("0%, 100%, then 100% recalled"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Practice" }),
    ).toBeInTheDocument();
  });

  it("sends a learning-phase Refresh to a Refresh sitting", async () => {
    renderWithTooltips(
      <ReviewSummary
        attempts={[
          { reference: JOHN_3_16, accuracy: 34, status: "learning" },
          { reference: GENESIS_33_9, accuracy: 40, status: "reviewing" },
        ]}
        averageAccuracy={37}
        remaining={0}
        onDone={() => {}}
      />,
    );

    const refreshButtons = screen.getAllByRole("button", { name: "Refresh" });
    await userEvent.click(refreshButtons[0]);
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/memory/practice",
      search: {
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
        refresh: true,
      },
    });

    await userEvent.click(refreshButtons[1]);
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/memory/practice",
      search: {
        book: "Genesis",
        chapter: 33,
        startVerse: 9,
        endVerse: 9,
        refresh: true,
      },
    });
  });
});
