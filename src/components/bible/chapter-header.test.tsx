import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CHAPTER_CHROME_COMPACT_HIDE_CLASS,
  CHAPTER_CHROME_COMPACT_ICON_BUTTON_CLASS,
  CHAPTER_CHROME_COMPACT_LABEL_CLASS,
  CHAPTER_CHROME_CONTAINER_CLASS,
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
      await screen.findByRole("tooltip", { name: "Open chapter notes" }),
    ).toBeInTheDocument();
  });
});
