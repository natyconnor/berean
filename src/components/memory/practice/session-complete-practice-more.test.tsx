import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS } from "@/lib/memory-scheduler";

import { SessionComplete, type SessionCompleteVerse } from "./session-complete";
import { TodaySessionSummary } from "./today-session-summary";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/memory/packs/add-to-pack", () => ({
  AddToPack: ({ reference }: { reference: { book: string } }) => (
    <button type="button" aria-label={`Add ${reference.book} to a pack`} />
  ),
}));

vi.mock("@/components/memory/celebrate/first-memorized-banner", () => ({
  FirstMemorizedBanner: () => null,
}));

const NOW = Date.now();
const JOHN_3_16 = { book: "John", chapter: 3, startVerse: 16, endVerse: 16 };
const ROMANS_8_28 = {
  book: "Romans",
  chapter: 8,
  startVerse: 28,
  endVerse: 28,
};
const PSALM_23_1 = { book: "Psalm", chapter: 23, startVerse: 1, endVerse: 1 };

/** Cleared today's step: the next step opens tomorrow. */
function locked(
  id: string,
  reference: SessionCompleteVerse["reference"],
): SessionCompleteVerse {
  return {
    id,
    reference,
    learnStage: 3,
    status: "learning",
    dueAt: NOW + DAY_MS,
    lastReviewedAt: NOW,
  };
}

function memorized(
  id: string,
  reference: SessionCompleteVerse["reference"],
): SessionCompleteVerse {
  return {
    id,
    reference,
    learnStage: 3,
    status: "reviewing",
    justMemorized: true,
    dueAt: NOW + DAY_MS,
    lastReviewedAt: NOW,
  };
}

function renderCard(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const PRACTICE_JOHN =
  "/memory/practice?book=John&chapter=3&startVerse=16&endVerse=16&return=%2Fmemory%2Fverses";

describe("Practice more on the end card", () => {
  it("puts an outline Practice more between Extra practice and Done on a one-verse card (M1)", () => {
    renderCard(
      <SessionComplete
        verses={[locked("john", JOHN_3_16)]}
        exitLabel="Done"
        onExit={() => {}}
        extraPracticeHref="/memory/practice"
        returnTo="/memory/verses"
      />,
    );

    const practiceMore = screen.getByRole("link", {
      name: "Practice more John 3:16",
    });
    expect(practiceMore).toHaveTextContent("Practice more");
    expect(practiceMore).toHaveAttribute("href", PRACTICE_JOHN);
    const footer = practiceMore.parentElement as HTMLElement;
    expect(
      Array.from(footer.children, (control) => control.textContent),
    ).toEqual(["Extra practice", "Practice more", "Done"]);
    expect(practiceMore).toHaveAttribute("data-variant", "outline");
    // One verse: the row keeps just its Add to pack.
    expect(
      screen.getAllByRole("link", { name: /^Practice more/ }),
    ).toHaveLength(1);
  });

  it("offers nothing when the one verse is now Memorized (M7)", () => {
    renderCard(
      <SessionComplete
        verses={[memorized("john", JOHN_3_16)]}
        exitLabel="Done"
        onExit={() => {}}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /^Practice more/ }),
    ).not.toBeInTheDocument();
  });

  it("gives each locked Learning row its own icon on a multi-verse card, with no footer button", () => {
    renderCard(
      <SessionComplete
        verses={[
          locked("john", JOHN_3_16),
          memorized("psalm", PSALM_23_1),
          locked("romans", ROMANS_8_28),
        ]}
        exitLabel="Done"
        onExit={() => {}}
        returnTo="/memory/verses"
      />,
    );

    const icons = screen.getAllByRole("link", { name: /^Practice more/ });
    expect(icons.map((icon) => icon.getAttribute("aria-label"))).toEqual([
      "Practice more John 3:16",
      "Practice more Romans 8:28",
    ]);
    expect(icons[0]).toHaveAttribute("href", PRACTICE_JOHN);
    // Icon only, just left of the row's Add to pack.
    expect(icons[0]).toHaveTextContent("");
    expect(icons[0]?.nextElementSibling).toHaveAccessibleName(
      "Add John to a pack",
    );
    const psalmRow = screen.getByText("Psalm 23:1").closest("li");
    expect(
      within(psalmRow as HTMLElement).queryByRole("link"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Practice more" }),
    ).not.toBeInTheDocument();
  });

  it("follows the same rule on the Today summary", () => {
    const { unmount } = renderCard(
      <TodaySessionSummary
        title="Today"
        passages={[]}
        learned={[locked("john", JOHN_3_16)]}
        attempts={[]}
        onDone={() => {}}
        returnTo="/memory/verses"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Practice more John 3:16" }),
    ).toHaveTextContent("Practice more");
    unmount();

    renderCard(
      <TodaySessionSummary
        title="Today"
        passages={["Psalm 23"]}
        learned={[locked("john", JOHN_3_16)]}
        attempts={[]}
        onDone={() => {}}
        returnTo="/memory/verses"
      />,
    );
    const icon = screen.getByRole("link", { name: "Practice more John 3:16" });
    expect(icon).toHaveTextContent("");
    expect(icon.closest("li")).toHaveTextContent("John 3:16");
  });
});
