import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  MemoryPanelFrameContext,
  type MemoryPanelFrameValue,
} from "@/components/memory/drawer/memory-panel-context";
import type { TodayGoal, TodayModelResult } from "@/hooks/use-today-model";
import { memoryPanelFullPagePath } from "@/lib/memory-panel";

import { GoalCollection } from "./goal-collection";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("./goal-list-row", () => ({
  GoalListRow: ({
    goal,
    detailHref,
  }: {
    goal: TodayGoal;
    detailHref: string;
  }) => <a href={detailHref}>{goal.title}</a>,
}));

const NOW = Date.UTC(2026, 9, 15, 18);
const DAY_MS = 24 * 60 * 60 * 1000;

function goal(
  kind: "passage" | "pack",
  title: string,
  extra: Record<string, unknown>,
): TodayGoal {
  return {
    kind,
    packId: title.toLowerCase(),
    title,
    verseCount: 4,
    hasWorkToday: false,
    createdAt: NOW - DAY_MS,
    lastActivityAt: NOW,
    lastPracticedAt: NOW,
    memberLabels: [],
    ...extra,
  } as unknown as TodayGoal;
}

const TODAY = {
  goals: [
    goal("passage", "Jude", {
      status: "building",
      learnedVerses: 1,
      hasWorkToday: true,
      createdAt: NOW - 3 * DAY_MS,
    }),
    goal("pack", "Mix", {
      learned: 3,
      mastered: 0,
      memberLabels: ["John 11:35", "John 1:1"],
    }),
    goal("passage", "Amos", {
      status: "reviewing",
      learnedVerses: 4,
      createdAt: NOW - 9 * DAY_MS,
    }),
    {
      kind: "verse",
      verseRefId: "v1",
      title: "John 3:16",
    } as unknown as TodayGoal,
  ],
  emptyPacks: [{ packId: "idle", title: "Idle", createdAt: NOW }],
} as unknown as TodayModelResult;

function frame(): MemoryPanelFrameValue {
  return {
    surface: "page",
    panel: { kind: "verses" },
    from: undefined,
    returnTo: "/memory/verses",
    hrefFor: memoryPanelFullPagePath,
    back: undefined,
    fullPageHref: undefined,
    close: undefined,
    exit: () => {},
  };
}

function renderCollection({
  query = "",
  controls = true,
}: { query?: string; controls?: boolean } = {}): void {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryPanelFrameContext.Provider value={frame()}>
      {children}
    </MemoryPanelFrameContext.Provider>
  );
  render(
    <GoalCollection
      today={TODAY}
      now={NOW}
      timeZone="UTC"
      query={query}
      controls={controls}
    />,
    { wrapper },
  );
}

function rowTitles(): string[] {
  return within(screen.getByRole("list"))
    .getAllByRole("link")
    .map((link) => link.textContent ?? "");
}

describe("GoalCollection", () => {
  it("lists every passage and pack, then packs with nothing in Memory", () => {
    renderCollection();

    expect(
      screen.getByRole("heading", { name: "Passages and packs · 4" }),
    ).toBeInTheDocument();
    expect(rowTitles()).toEqual([
      "Jude",
      "Mix",
      "Amos",
      "IdlePack · nothing in Memory",
    ]);
    expect(screen.getByRole("link", { name: /^Idle/ })).toHaveAttribute(
      "href",
      "/memory/idle?from=verses",
    );
  });

  it("filters by kind and stage, and clears a stage on a second press", async () => {
    renderCollection();

    await userEvent.click(screen.getByRole("button", { name: "Passages" }));
    expect(rowTitles()).toEqual(["Jude", "Amos"]);

    const learning = screen.getByRole("button", { name: "Learning" });
    await userEvent.click(learning);
    expect(learning).toHaveAttribute("aria-pressed", "true");
    expect(rowTitles()).toEqual(["Jude"]);

    await userEvent.click(learning);
    expect(learning).toHaveAttribute("aria-pressed", "false");
    expect(rowTitles()).toEqual(["Jude", "Amos"]);
  });

  it("says when nothing matches and can show everything again", async () => {
    renderCollection();

    await userEvent.click(screen.getByRole("button", { name: "Packs" }));
    await userEvent.click(screen.getByRole("button", { name: "Mastered" }));
    expect(
      screen.getByText("Nothing matches these filters."),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Show everything" }),
    );
    expect(rowTitles()).toHaveLength(4);
  });

  it("sorts from the menu", async () => {
    renderCollection();

    await userEvent.click(
      screen.getByRole("button", { name: "Sort: Today's order" }),
    );
    await userEvent.click(
      screen.getByRole("menuitemradio", { name: "Name A–Z" }),
    );
    expect(rowTitles().slice(0, 3)).toEqual(["Amos", "Jude", "Mix"]);
    expect(
      screen.getByRole("button", { name: "Sort: Name A–Z" }),
    ).toBeInTheDocument();
  });

  it("narrows to the search by title or pack verse", () => {
    renderCollection({ query: "john 1:1" });
    expect(rowTitles()).toEqual(["Mix"]);
  });

  it("leaves the filters and sort to the page", () => {
    renderCollection({ controls: false });

    expect(rowTitles()).toHaveLength(4);
    expect(
      screen.queryByRole("group", { name: "Show" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Sort/ }),
    ).not.toBeInTheDocument();
  });
});
