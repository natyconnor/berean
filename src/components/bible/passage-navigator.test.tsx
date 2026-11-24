import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { PassageNavigator } from "./passage-navigator";

const mocks = vi.hoisted(() => ({
  openTab: vi.fn(),
  useReducedMotion: vi.fn(() => false),
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({ openTab: mocks.openTab }),
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => mocks.useReducedMotion() };
});

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

  describe("empty book search", () => {
    it("says No books found. and Enter does nothing", async () => {
      const user = userEvent.setup();
      const onSelectPassage = vi.fn();
      renderNavigator({ onSelectPassage });

      await user.keyboard("zzz");
      expect(screen.getByRole("status")).toHaveTextContent(
        /^No books found\.$/,
      );
      expect(screen.queryByText("Old Testament")).toBeNull();
      expect(screen.queryByText("New Testament")).toBeNull();

      await user.keyboard("{Enter}");
      expect(onSelectPassage).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText("Search books…")).toBeVisible();
      expect(screen.queryByLabelText("Chapter number")).toBeNull();
    });

    it("brings the books back when the search is cleared", async () => {
      const user = userEvent.setup();
      renderNavigator();

      await user.keyboard("zzz");
      await user.clear(screen.getByPlaceholderText("Search books…"));

      expect(screen.queryByText("No books found.")).toBeNull();
      expect(screen.getByRole("button", { name: "Genesis" })).toBeVisible();
    });

    it("brings matching books back when the search changes", async () => {
      const user = userEvent.setup();
      renderNavigator();

      await user.keyboard("zzz");
      await user.clear(screen.getByPlaceholderText("Search books…"));
      await user.keyboard("rom");

      expect(screen.queryByText("No books found.")).toBeNull();
      expect(screen.getByRole("button", { name: "Romans" })).toBeVisible();
    });
  });

  describe("chapter grid layout", () => {
    it("pins the header and scrolls only the chapter grid", () => {
      renderNavigator({ initialBookName: "Psalms" });

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveClass(
        "flex",
        "flex-col",
        "max-h-[calc(100dvh-2rem)]",
        "overflow-hidden",
      );

      const header = screen.getByRole("button", { name: "← Psalms" })
        .parentElement as HTMLElement;
      expect(header).toHaveClass("shrink-0");

      const chapterView = header.parentElement as HTMLElement;
      expect(chapterView).toHaveClass("flex", "min-h-0", "flex-col");

      const chapterButton = screen.getByRole("button", { name: "150" });
      const scrollArea = chapterButton.closest('[data-slot="scroll-area"]');
      expect(scrollArea).toHaveClass("flex", "flex-col", "min-h-0", "max-h-80");
      expect(header.contains(scrollArea)).toBe(false);
      expect(chapterButton).toHaveClass("h-9", "scroll-my-3");
    });
  });

  describe("typed chapter scrolls into view", () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
      scrollIntoView.mockReset();
      mocks.useReducedMotion.mockReturnValue(false);
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: scrollIntoView,
      });
    });

    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    });

    function scrolledChapters() {
      return scrollIntoView.mock.contexts.map(
        (el) => (el as HTMLElement).textContent,
      );
    }

    it("scrolls a valid chapter into view, nearest and smooth", async () => {
      const user = userEvent.setup();
      renderNavigator({ initialBookName: "Psalms" });

      await user.keyboard("140");

      expect(scrolledChapters()).toEqual(["1", "14", "140"]);
      expect(scrollIntoView).toHaveBeenLastCalledWith({
        block: "nearest",
        behavior: "smooth",
      });
      expect(screen.getByRole("button", { name: "140" })).toHaveClass(
        "bg-primary",
      );
    });

    it("uses an instant scroll when the user prefers reduced motion", async () => {
      mocks.useReducedMotion.mockReturnValue(true);
      const user = userEvent.setup();
      renderNavigator({ initialBookName: "Psalms" });

      await user.keyboard("140");

      expect(scrollIntoView).toHaveBeenLastCalledWith({
        block: "nearest",
        behavior: "auto",
      });
    });

    it("does not scroll for invalid or empty digits", async () => {
      const user = userEvent.setup();
      renderNavigator({ initialBookName: "Romans" });

      await user.keyboard("0");
      await user.keyboard("{Backspace}");
      await user.keyboard("abc");
      expect(scrollIntoView).not.toHaveBeenCalled();

      await user.keyboard("9");
      scrollIntoView.mockReset();
      await user.keyboard("9");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid chapter number for this book.",
      );
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("opens the typed chapter on Enter", async () => {
      const user = userEvent.setup();
      const onSelectPassage = vi.fn();
      renderNavigator({ initialBookName: "Psalms", onSelectPassage });

      await user.keyboard("140{Enter}");

      expect(onSelectPassage).toHaveBeenCalledWith("Psalms-140", "Psalm 140");
    });
  });

  describe("browser Back and Forward", () => {
    afterEach(() => {
      window.history.replaceState(null, "", "/");
    });

    it("closes a controlled picker on popstate", () => {
      const { onOpenChange } = renderNavigator({ initialBookName: "Romans" });

      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("stays open on in-app pushState navigation", () => {
      const { onOpenChange } = renderNavigator();

      act(() => {
        window.history.pushState(null, "", "/passage/Romans-8");
      });

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes the picker from its own trigger and reopens fresh", async () => {
      const user = userEvent.setup();
      render(
        <TooltipProvider>
          <PassageNavigator />
        </TooltipProvider>,
      );

      await user.click(screen.getByRole("button"));
      await user.keyboard("Romans{Enter}");
      expect(
        await screen.findByLabelText("Chapter number"),
      ).toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await user.click(screen.getByRole("button"));
      expect(screen.getByPlaceholderText("Search books…")).toHaveValue("");
      expect(screen.queryByLabelText("Chapter number")).toBeNull();
    });
  });
});
