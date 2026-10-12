import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import type { HeartListItem } from "./hearted-list";
import { PassageNavigator } from "./passage-navigator";

const mocks = vi.hoisted(() => ({
  openTab: vi.fn(),
  romans828: {
    savedVerseId: "saved_1",
    verseRefId: "ref_1",
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 28,
    createdAt: 1,
    inMemory: false,
  },
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({ openTab: mocks.openTab }),
}));

vi.mock("./hearted-list", () => ({
  HeartedList: ({
    onOpenHeart,
    onMemorizeOpen,
  }: {
    onOpenHeart: (item: HeartListItem) => void;
    onMemorizeOpen: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onOpenHeart(mocks.romans828 as HeartListItem)}
      >
        Open Romans 8:28
      </button>
      <button type="button" onClick={onMemorizeOpen}>
        Memorize Romans 8:28
      </button>
    </div>
  ),
}));

function renderNavigator(
  props: Partial<Parameters<typeof PassageNavigator>[0]> = {},
) {
  const onOpenChange = vi.fn();
  render(
    <TooltipProvider>
      <PassageNavigator
        open
        trigger={null}
        onOpenChange={onOpenChange}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onOpenChange };
}

describe("PassageNavigator", () => {
  beforeEach(() => {
    mocks.openTab.mockReset();
  });

  it("opens on Books with the book search focused", () => {
    renderNavigator();

    expect(screen.getByRole("button", { name: "Books" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Hearted" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByPlaceholderText("Search books...")).toHaveFocus();
  });

  it("still picks a book and chapter from Books", async () => {
    const user = userEvent.setup();
    const onSelectPassage = vi.fn();
    const { onOpenChange } = renderNavigator({ onSelectPassage });

    await user.keyboard("Romans{Enter}");
    await user.click(await screen.findByRole("button", { name: "8" }));

    expect(onSelectPassage).toHaveBeenCalledWith(
      "Romans-8",
      "Romans 8",
      undefined,
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a heart at its verses and closes", async () => {
    const user = userEvent.setup();
    const onSelectPassage = vi.fn();
    const { onOpenChange } = renderNavigator({ onSelectPassage });

    await user.click(screen.getByRole("button", { name: "Hearted" }));
    await user.click(
      await screen.findByRole("button", { name: "Open Romans 8:28" }),
    );

    expect(onSelectPassage).toHaveBeenCalledWith("Romans-8", "Romans 8", {
      startVerse: 28,
      endVerse: 28,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a new tab at a heart's verses without onSelectPassage", async () => {
    const user = userEvent.setup();
    renderNavigator();

    await user.click(screen.getByRole("button", { name: "Hearted" }));
    await user.click(
      await screen.findByRole("button", { name: "Open Romans 8:28" }),
    );

    expect(mocks.openTab).toHaveBeenCalledWith("Romans-8", "Romans 8", {
      startVerse: 28,
      endVerse: 28,
    });
  });

  it("closes when Memorize hands off to the sheet", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderNavigator();

    await user.click(screen.getByRole("button", { name: "Hearted" }));
    await user.click(
      await screen.findByRole("button", { name: "Memorize Romans 8:28" }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
