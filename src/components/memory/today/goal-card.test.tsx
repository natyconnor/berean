import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TodayGoal } from "@/hooks/use-today-model";
import type {
  PackGoalCard,
  PassageGoalCard,
  VerseGoalCard,
} from "@/lib/memory-goals";
import { DAY_MS } from "@/lib/memory-scheduler";

import { GoalCard } from "./goal-card";

/** Monday, Oct 12, 2026. */
const NOW = Date.UTC(2026, 9, 12, 18);
const TZ = "UTC";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

function passage(overrides: Partial<PassageGoalCard> = {}): TodayGoal {
  return {
    kind: "passage",
    packId: "psalm16",
    title: "Psalm 16",
    verseCount: 11,
    learnedVerses: 4,
    status: "building",
    hasWorkToday: true,
    todayStep: {
      label: "Read verses 5–6, then type them with first letters",
      ladderDay: 1,
    },
    masteryFraction: 0,
    nextDueAt: NOW,
    createdAt: NOW - 10 * DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: NOW - DAY_MS,
    ...overrides,
  } as TodayGoal;
}

function pack(overrides: Partial<PackGoalCard> = {}): TodayGoal {
  const labels = [
    "Luke 9:23–24",
    "Matthew 6:33",
    "Deuteronomy 6:4–5",
    "2 Corinthians 4:7–10",
    "Ephesians 2:10",
    "Romans 12:2",
    "Joshua 1:9",
    "Micah 6:8",
  ];
  return {
    kind: "pack",
    packId: "merced",
    title: "Merced Team",
    verseCount: 12,
    learned: 8,
    learning: 2,
    upNext: 2,
    mastered: 0,
    masteryFraction: 0.22,
    reviewsDue: labels.map((label, index) => ({
      verseRefId: `v${index}`,
      label,
    })),
    learningToday: 0,
    reviewTogether: false,
    hasWorkToday: true,
    nextDueAt: NOW,
    createdAt: NOW - 30 * DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: NOW - DAY_MS,
    memberLabels: labels,
    ...overrides,
  } as TodayGoal;
}

function verse(overrides: Partial<VerseGoalCard> = {}): TodayGoal {
  return {
    kind: "verse",
    verseRefId: "john316",
    title: "John 3:16",
    book: "John",
    chapter: 3,
    startVerse: 16,
    endVerse: 16,
    status: "learning",
    learnStage: 0,
    intervalDays: 0,
    masteryFraction: 0,
    hasWorkToday: true,
    nextDueAt: NOW,
    createdAt: NOW - DAY_MS,
    lastActivityAt: NOW - DAY_MS,
    lastPracticedAt: null,
    ...overrides,
  } as TodayGoal;
}

function renderCard(goal: TodayGoal) {
  return render(<GoalCard goal={goal} now={NOW} timeZone={TZ} />);
}

function buttonsIn(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="button"]'),
  );
}

describe("GoalCard", () => {
  it("has one stretched title link to the drawer and one separate button", () => {
    const { container } = renderCard(passage());

    const link = screen.getByRole("link", { name: "Psalm 16" });
    expect(link).toHaveAttribute("href", "/memory?panel=pack%3Apsalm16");
    expect(link.className).toContain("after:absolute");

    const buttons = buttonsIn(container);
    expect(buttons).toHaveLength(1);
    const [button] = buttons;
    expect(button).toHaveTextContent("Continue · 7 min");
    expect(button).toHaveAttribute(
      "href",
      "/memory/psalm16/learn?return=%2Fmemory",
    );
    expect(link.contains(button)).toBe(false);
    expect(button.contains(link)).toBe(false);
    expect(button.className).toContain("z-10");
  });

  it("shows a building passage's step and only the Learned bar, with no status chip", () => {
    renderCard(passage());

    expect(screen.queryByText("Today")).not.toBeInTheDocument();
    expect(screen.getByText("Passage · 11 verses")).toBeInTheDocument();
    expect(screen.getByText("Today:")).toBeInTheDocument();
    expect(
      screen.getByText("read verses 5–6, then type them with first letters."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/day \d of 3/i)).not.toBeInTheDocument();
    expect(screen.getByText("4 of 11 verses learned")).toBeInTheDocument();
    expect(screen.getByText("on track for Oct 15")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Learned 4 of 11 verses" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: /Mastery/ }),
    ).not.toBeInTheDocument();
  });

  it("counts from tomorrow once today's learning is done", () => {
    renderCard(passage({ hasWorkToday: false, lastPracticedAt: NOW }));

    expect(screen.getByText("on track for Oct 16")).toBeInTheDocument();
  });

  it("says how many days are left instead of a date after 2 idle days", () => {
    renderCard(passage({ lastPracticedAt: NOW - 3 * DAY_MS }));

    expect(screen.getByText("about 4 days to go")).toBeInTheDocument();
    expect(screen.queryByText(/on track for/)).not.toBeInTheDocument();
  });

  it("starts a passage nobody has practiced yet", () => {
    const { container } = renderCard(
      passage({ learnedVerses: 0, lastPracticedAt: null }),
    );

    expect(screen.queryByText("Starts today")).not.toBeInTheDocument();
    expect(buttonsIn(container)[0]).toHaveTextContent("Start · 7 min");
    expect(screen.getByText("learn it in about 5 days")).toBeInTheDocument();
  });

  it("lists a pack's reviews as chips, five plus more past six", () => {
    const { container } = renderCard(pack());

    const chips = within(screen.getByRole("list", { name: "Reviews due" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(chips).toEqual([
      "Luke 9:23–24",
      "Matthew 6:33",
      "Deuteronomy 6:4–5",
      "2 Corinthians 4:7–10",
      "Ephesians 2:10",
      "+3 more",
    ]);
    expect(screen.queryByText("8 reviews today")).not.toBeInTheDocument();

    const [button] = buttonsIn(container);
    expect(button).toHaveTextContent("Review 8 · 8 min");
    expect(button).toHaveAttribute(
      "href",
      "/memory/merced/review?return=%2Fmemory",
    );
  });

  it("shows both bars once a pack has learned verses, and only Learned before", () => {
    const { unmount } = renderCard(pack());
    expect(screen.getByText("8 of 12 verses learned")).toBeInTheDocument();
    expect(screen.getByText("2 learning · 2 up next")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Mastery 22 percent" }),
    ).toBeInTheDocument();
    unmount();

    renderCard(
      pack({
        learned: 0,
        learning: 3,
        upNext: 9,
        masteryFraction: 0,
        reviewsDue: [],
        learningToday: 3,
        lastPracticedAt: null,
      }),
    );
    expect(
      screen.getByRole("progressbar", { name: "Learned 0 of 12 verses" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: /Mastery/ }),
    ).not.toBeInTheDocument();
  });

  it("runs a pack's learning and reviews together like its drawer", () => {
    const { container } = renderCard(
      pack({
        learningToday: 2,
        reviewsDue: [{ verseRefId: "a", label: "Luke 9:23–24" }],
      }),
    );

    const [button] = buttonsIn(container);
    expect(button).toHaveTextContent("Continue · 7 min");
    expect(button).toHaveAttribute(
      "href",
      "/memory/today?packId=merced&return=%2Fmemory",
    );
    expect(screen.getByText("2 verses to learn today")).toBeInTheDocument();
  });

  it("shows Done today and no button once today's work is done", () => {
    const { container } = renderCard(
      passage({
        hasWorkToday: false,
        todayStep: null,
        lastPracticedAt: NOW - 60_000,
        nextDueAt: NOW + DAY_MS,
      }),
    );

    expect(screen.getByText("Done today")).toBeInTheDocument();
    expect(
      screen.getByText("Today's step done. Next step tomorrow."),
    ).toBeInTheDocument();
    expect(buttonsIn(container)).toHaveLength(0);
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("reviews a memorized passage with only the Mastery bar", () => {
    const { container } = renderCard(
      passage({
        status: "reviewing",
        learnedVerses: 11,
        todayStep: null,
        masteryFraction: 0.4,
      }),
    );

    expect(
      screen.getByText("Recite it all the way through."),
    ).toBeInTheDocument();
    const [button] = buttonsIn(container);
    expect(button).toHaveTextContent(/^Review$/);
    expect(button).toHaveAttribute(
      "href",
      "/memory/psalm16/review?return=%2Fmemory",
    );
    expect(screen.getByText("Mastery 40%")).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: /Learned/ }),
    ).not.toBeInTheDocument();
  });

  it("says a memorized passage was reviewed once today's review is done", () => {
    renderCard(
      passage({
        status: "reviewing",
        learnedVerses: 11,
        hasWorkToday: false,
        todayStep: null,
        lastPracticedAt: NOW - 60_000,
        nextDueAt: NOW + 3 * DAY_MS,
      }),
    );

    expect(screen.getByText("Reviewed today.")).toBeInTheDocument();
  });

  it("starts a new verse with its first step", () => {
    const { container } = renderCard(verse());

    expect(screen.queryByText("Starts today")).not.toBeInTheDocument();
    expect(
      screen.getByText("read it, then type it with first letters."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Learning" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/day \d of 3/i)).not.toBeInTheDocument();
    const [button] = buttonsIn(container);
    expect(button).toHaveTextContent("Start · 3 min");
    expect(button).toHaveAttribute(
      "href",
      "/memory/learn?book=John&chapter=3&startVerse=16&endVerse=16&return=%2Fmemory",
    );
    expect(screen.getByRole("link", { name: "John 3:16" })).toHaveAttribute(
      "href",
      "/memory?panel=verse%3Ajohn316",
    );
  });

  it("offers Start on an Up next verse that isn't in a pack", () => {
    const { container } = renderCard(
      verse({ status: "new", hasWorkToday: false, nextDueAt: null }),
    );

    expect(
      screen.getByText("Up next. Starts when you're ready."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Not started" }),
    ).toBeInTheDocument();
    const [button] = buttonsIn(container);
    expect(button).toHaveTextContent("Start · 3 min");
    expect(button).toHaveAttribute(
      "href",
      "/memory/learn?book=John&chapter=3&startVerse=16&endVerse=16&return=%2Fmemory",
    );
  });
});
