import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CHAPTER_CHROME_COMPACT_HIDE_CLASS,
  CHAPTER_CHROME_COMPACT_ICON_BUTTON_CLASS,
  CHAPTER_CHROME_COMPACT_LABEL_CLASS,
  CHAPTER_CHROME_CONTAINER_CLASS,
  CHAPTER_CHROME_TIGHT_HIDE_CLASS,
} from "@/components/passage/header-chrome";
import { ChapterHeader } from "./chapter-header";

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    navigateActiveTab: vi.fn(),
  }),
}));

function renderHeader(
  overrides: Partial<ComponentProps<typeof ChapterHeader>> = {},
) {
  return render(
    <TooltipProvider delayDuration={0}>
      <ChapterHeader
        book="Mark"
        chapter={9}
        showSectionHeaders={false}
        onToggleSectionHeaders={vi.fn()}
        onChapterNotesClick={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>,
  );
}

describe("ChapterHeader compact chrome", () => {
  it("uses a named container so labels collapse with the passage column", () => {
    const { container } = renderHeader();
    expect(container.firstElementChild?.className).toContain(
      CHAPTER_CHROME_CONTAINER_CLASS,
    );
  });

  it("keeps the Headers shortcut and hides the word in compact chrome", () => {
    renderHeader();
    const headersLabel = screen.getByText("Headers");
    expect(headersLabel.className).toContain(
      CHAPTER_CHROME_COMPACT_LABEL_CLASS,
    );
    expect(screen.getByText("H")).toBeInTheDocument();
  });

  it("shows an Add a chapter note tooltip on the chapter-note button", async () => {
    const user = userEvent.setup();
    renderHeader();

    const button = screen.getByRole("button", {
      name: "Add a chapter note for Mark 9",
    });
    expect(button.className).toContain(
      CHAPTER_CHROME_COMPACT_ICON_BUTTON_CLASS,
    );
    expect(button.querySelector("span.min-w-0")?.className).toContain(
      CHAPTER_CHROME_COMPACT_HIDE_CLASS,
    );

    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", { name: "Add a chapter note" }),
    ).toBeInTheDocument();
  });

  it("tooltips existing chapter notes as Open rather than Add", async () => {
    const user = userEvent.setup();
    renderHeader({ chapterScopedNoteCount: 2 });

    const button = screen.getByRole("button", {
      name: "Open chapter notes for Mark 9",
    });
    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", { name: "Open chapter notes · 2" }),
    ).toBeInTheDocument();
  });

  it("lets a long book name shrink and exposes the full title", async () => {
    const user = userEvent.setup();
    renderHeader({ book: "1 Thessalonians", chapter: 1 });

    const bookButton = screen.getByRole("button", {
      name: "Change book, currently 1 Thessalonians",
    });
    expect(bookButton.className.split(/\s+/)).toContain("shrink");
    expect(bookButton.className.split(/\s+/)).not.toContain("shrink-0");

    const label = bookButton.querySelector("span.truncate");
    expect(label).toHaveClass("min-w-0");
    expect(label).toHaveAttribute("title", "1 Thessalonians");

    await user.hover(bookButton);
    expect(
      await screen.findByRole("tooltip", { name: /1 Thessalonians/ }),
    ).toBeInTheDocument();
  });

  it("hides the Headers switch on the tightest passage column", () => {
    renderHeader();
    const headersSwitch = screen.getByRole("switch", { name: /Headers/ });
    expect(headersSwitch.closest("div")?.className).toContain(
      CHAPTER_CHROME_TIGHT_HIDE_CLASS,
    );
  });

  it("shows the Headers tooltip when the label is hovered", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.hover(screen.getByText("Headers"));
    expect(
      await screen.findByRole("tooltip", {
        name: "Show editorial section headings",
      }),
    ).toBeInTheDocument();
  });

  it("shows the Headers tooltip when the switch is focused from the keyboard", async () => {
    const user = userEvent.setup();
    renderHeader();

    const headersSwitch = screen.getByRole("switch", { name: /Headers/ });
    for (
      let step = 0;
      step < 8 && document.activeElement !== headersSwitch;
      step += 1
    ) {
      await user.tab();
    }

    expect(headersSwitch).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip", {
      name: "Show editorial section headings",
    });
    expect(tooltip).toBeInTheDocument();
    expect(headersSwitch.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(headersSwitch).toHaveAttribute("data-state", "unchecked");
  });

  it("keeps checked and unchecked on the switch while the tooltip is open", async () => {
    const user = userEvent.setup();
    const { rerender } = renderHeader({ showSectionHeaders: false });

    const unchecked = screen.getByRole("switch", { name: /Headers/ });
    expect(unchecked).toHaveAttribute("data-state", "unchecked");
    expect(unchecked.closest("[data-slot='tooltip-trigger']")).not.toBe(
      unchecked,
    );

    await user.hover(screen.getByText("Headers"));
    expect(
      await screen.findByRole("tooltip", {
        name: "Show editorial section headings",
      }),
    ).toBeInTheDocument();
    expect(unchecked).toHaveAttribute("data-state", "unchecked");

    rerender(
      <TooltipProvider delayDuration={0}>
        <ChapterHeader
          book="Mark"
          chapter={9}
          showSectionHeaders
          onToggleSectionHeaders={vi.fn()}
          onChapterNotesClick={vi.fn()}
        />
      </TooltipProvider>,
    );

    const checked = screen.getByRole("switch", { name: /Headers/ });
    await user.hover(screen.getByText("Headers"));
    expect(
      await screen.findByRole("tooltip", {
        name: "Hide editorial section headings",
      }),
    ).toBeInTheDocument();
    expect(checked).toHaveAttribute("data-state", "checked");
    expect(checked.closest("[data-slot='tooltip-trigger']")).not.toBe(checked);
  });

  it("toggles section headers from the switch", async () => {
    const user = userEvent.setup();
    const onToggleSectionHeaders = vi.fn();
    renderHeader({ onToggleSectionHeaders, showSectionHeaders: false });

    await user.click(screen.getByRole("switch", { name: /Headers/ }));
    expect(onToggleSectionHeaders).toHaveBeenCalledOnce();
  });

  it("names the previous and next chapter buttons", () => {
    renderHeader();
    expect(
      screen.getByRole("button", { name: "Previous chapter (Mark 8)" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Next chapter (Mark 10)" }),
    ).toBeEnabled();

    cleanup();
    renderHeader({ book: "Genesis", chapter: 1 });
    expect(
      screen.getByRole("button", { name: "Previous chapter" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next chapter (Genesis 2)" }),
    ).toBeEnabled();
  });
});
