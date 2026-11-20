import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { PassageNavigator } from "./passage-navigator";

const mocks = vi.hoisted(() => ({
  openTab: vi.fn(),
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({ openTab: mocks.openTab }),
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

function expectNoHeartedView() {
  expect(screen.queryByRole("group", { name: "Go to passage by" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Books" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Hearted" })).toBeNull();
  expect(screen.queryByPlaceholderText("Filter hearts…")).toBeNull();
}

describe("PassageNavigator", () => {
  beforeEach(() => {
    mocks.openTab.mockReset();
  });

  it("opens on the book list with no Hearted toggle", () => {
    renderNavigator();

    const searchBox = screen.getByPlaceholderText("Search books…");
    expect(searchBox).toHaveFocus();
    // The dialog's Close button sits top-right; the row keeps room for it.
    expect(searchBox.parentElement).toHaveClass("pr-12");
    expectNoHeartedView();
  });

  it("opens on the chapter grid for a named book with no toggle", () => {
    renderNavigator({ initialBookName: "Romans" });

    expect(screen.getByRole("button", { name: "← Romans" })).toBeVisible();
    expect(screen.getByLabelText("Chapter number")).toHaveFocus();
    expect(screen.getByRole("button", { name: "16" })).toBeVisible();
    expectNoHeartedView();
  });

  it("picks a book and chapter", async () => {
    const user = userEvent.setup();
    const onSelectPassage = vi.fn();
    const { onOpenChange } = renderNavigator({ onSelectPassage });

    await user.keyboard("Romans{Enter}");
    await user.click(await screen.findByRole("button", { name: "8" }));

    expect(onSelectPassage).toHaveBeenCalledWith("Romans-8", "Romans 8");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a new tab for the pick without onSelectPassage", async () => {
    const user = userEvent.setup();
    renderNavigator();

    await user.keyboard("Romans{Enter}");
    await user.click(await screen.findByRole("button", { name: "8" }));

    expect(mocks.openTab).toHaveBeenCalledWith("Romans-8", "Romans 8");
  });
});
