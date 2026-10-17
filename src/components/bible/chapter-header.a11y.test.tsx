import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChapterHeader } from "./chapter-header";

const { navigateActiveTab } = vi.hoisted(() => ({
  navigateActiveTab: vi.fn(),
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    navigateActiveTab,
    openTab: vi.fn(),
  }),
}));

function renderHeader(
  book: string,
  chapter: number,
  extras?: Pick<
    ComponentProps<typeof ChapterHeader>,
    "onChapterNotesClick" | "chapterScopedNoteCount"
  >,
) {
  return render(
    <TooltipProvider delayDuration={0}>
      <ChapterHeader
        book={book}
        chapter={chapter}
        showSectionHeaders={false}
        onToggleSectionHeaders={vi.fn()}
        {...extras}
      />
    </TooltipProvider>,
  );
}

describe("ChapterHeader accessible chapter controls", () => {
  beforeEach(() => {
    navigateActiveTab.mockReset();
  });

  it("names previous and next for the chapters they open", async () => {
    const user = userEvent.setup();
    renderHeader("John", 2);

    const previous = screen.getByRole("button", {
      name: "Previous chapter (John 1)",
    });
    const next = screen.getByRole("button", {
      name: "Next chapter (John 3)",
    });
    expect(previous).toBeEnabled();
    expect(next).toBeEnabled();

    await user.hover(next);
    expect(
      await screen.findByRole("tooltip", { name: "Next chapter (John 3)" }),
    ).toBeInTheDocument();

    await user.click(next);
    expect(navigateActiveTab).toHaveBeenCalledWith("John-3", "John 3");
  });

  it("names the previous book at the start of a book", async () => {
    const user = userEvent.setup();
    renderHeader("John", 1);

    const previous = screen.getByRole("button", {
      name: "Previous chapter (Luke 24)",
    });
    expect(previous).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Next chapter (John 2)" }),
    ).toBeEnabled();

    await user.hover(previous);
    expect(
      await screen.findByRole("tooltip", {
        name: "Previous chapter (Luke 24)",
      }),
    ).toBeInTheDocument();
  });

  it("names the next book at the end of a book", () => {
    renderHeader("John", 21);
    expect(
      screen.getByRole("button", { name: "Previous chapter (John 20)" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Next chapter (Acts 1)" }),
    ).toBeEnabled();

    cleanup();
    renderHeader("Malachi", 4);
    expect(
      screen.getByRole("button", { name: "Next chapter (Matthew 1)" }),
    ).toBeEnabled();
  });

  it("names both sides of a one-chapter book", () => {
    renderHeader("Philemon", 1);
    expect(
      screen.getByRole("button", { name: "Previous chapter (Titus 3)" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Next chapter (Hebrews 1)" }),
    ).toBeEnabled();
  });

  it("names an adjacent one-chapter book without a chapter number", () => {
    renderHeader("3 John", 1);
    expect(
      screen.getByRole("button", { name: "Next chapter (Jude)" }),
    ).toBeEnabled();
  });

  it("names chapter notes for a one-chapter book without a chapter number", () => {
    renderHeader("Jude", 1, { onChapterNotesClick: vi.fn() });
    expect(
      screen.getByRole("button", { name: "Add a chapter note for Jude" }),
    ).toBeInTheDocument();
  });

  it("omits the chapter picker on a one-chapter book and keeps it on John 3", () => {
    renderHeader("Jude", 1);
    expect(
      screen.getByRole("button", { name: "Change book, currently Jude" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Change chapter/ }),
    ).not.toBeInTheDocument();

    cleanup();
    renderHeader("John", 3);
    expect(
      screen.getByRole("button", {
        name: "Change chapter in John, currently chapter 3",
      }),
    ).toBeInTheDocument();
  });

  it("names chapter notes with the chapter for a multi-chapter book", () => {
    renderHeader("John", 3, { onChapterNotesClick: vi.fn() });
    expect(
      screen.getByRole("button", { name: "Add a chapter note for John 3" }),
    ).toBeInTheDocument();
  });

  it("uses the reader-facing psalm name", () => {
    renderHeader("Psalms", 23);
    expect(
      screen.getByRole("button", { name: "Previous chapter (Psalm 22)" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Next chapter (Psalm 24)" }),
    ).toBeEnabled();
  });

  it("names the section-headers switch from its visible label", () => {
    renderHeader("John", 1);

    const headers = screen.getByRole("switch", { name: /^Headers/ });
    expect(headers).toHaveAttribute("id", "passage-section-headers");
    expect(headers).not.toHaveAttribute("aria-label");
    expect(screen.getByLabelText(/^Headers/)).toBe(headers);
    const label = document.querySelector(
      'label[for="passage-section-headers"]',
    );
    expect(label).toHaveTextContent("Headers");
  });

  it("keeps a name at the first and last chapters of the Bible", () => {
    renderHeader("Genesis", 1);
    expect(
      screen.getByRole("button", { name: "Previous chapter" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next chapter (Genesis 2)" }),
    ).toBeEnabled();

    cleanup();
    renderHeader("Revelation", 22);
    expect(
      screen.getByRole("button", { name: "Previous chapter (Revelation 21)" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next chapter" })).toBeDisabled();
  });
});
