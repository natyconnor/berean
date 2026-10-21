import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CHAPTER_CHROME_COMPACT_LABEL_CLASS,
  CHAPTER_CHROME_CONTAINER_CLASS,
  CHAPTER_CHROME_MEMORIZE_CROWDED_HIDE_CLASS,
  CHAPTER_CHROME_TIGHT_HIDE_CLASS,
} from "@/components/passage/header-chrome";
import type { ChapterMemorizeState } from "@/lib/chapter-memorize";
import { ChapterHeader, type ChapterMemorizeControl } from "./chapter-header";

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
    expect(button).toHaveClass("size-8", "px-0", "justify-center", "gap-0");
    expect(button).not.toHaveTextContent("Chapter");
    expect(button).not.toHaveTextContent("Add a chapter note");
    expect(button.querySelector("span[aria-hidden]")).toBeNull();

    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", { name: "Add a chapter note" }),
    ).toHaveAttribute("data-side", "bottom");
  });

  it("tooltips existing chapter notes as Open rather than Add", async () => {
    const user = userEvent.setup();
    renderHeader({ chapterScopedNoteCount: 2 });

    const button = screen.getByRole("button", {
      name: "Open chapter notes for Mark 9",
    });
    expect(button).not.toHaveTextContent("Chapter");
    expect(within(button).getByText("2")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", { name: "Open chapter notes · 2" }),
    ).toBeInTheDocument();
  });

  it("caps the chapter-note badge at 9+", async () => {
    const user = userEvent.setup();
    const { rerender } = renderHeader({
      chapterScopedNoteCount: 12,
      chapterNotesOpen: true,
    });

    const open = screen.getByRole("button", {
      name: "Close chapter notes for Mark 9",
    });
    expect(within(open).getByText("9+")).toHaveAttribute("aria-hidden", "true");
    await user.hover(open);
    expect(
      await screen.findByRole("tooltip", { name: "Close chapter notes · 12" }),
    ).toBeInTheDocument();

    rerender(
      <TooltipProvider delayDuration={0}>
        <ChapterHeader
          book="Mark"
          chapter={9}
          showSectionHeaders={false}
          onToggleSectionHeaders={vi.fn()}
          onChapterNotesClick={vi.fn()}
          chapterNotesOpen
        />
      </TooltipProvider>,
    );

    const empty = screen.getByRole("button", {
      name: "Close chapter notes for Mark 9",
    });
    expect(within(empty).queryByText("9+")).not.toBeInTheDocument();
    expect(empty.querySelector("span[aria-hidden]")).toBeNull();
    await user.hover(empty);
    expect(
      await screen.findByRole("tooltip", { name: "Close chapter notes" }),
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

  it("keeps the chapter-note well pushed right when there is no Memorize button", () => {
    renderHeader();
    const headers = screen
      .getByRole("switch", { name: /Headers/ })
      .closest("div");
    expect(headers).toHaveClass("ml-auto");
    expect(headers).toHaveClass(CHAPTER_CHROME_TIGHT_HIDE_CLASS);
    expect(
      screen.getByRole("button", { name: "Add a chapter note for Mark 9" }),
    ).not.toHaveClass("ml-auto");
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

describe("ChapterHeader Memorize button", () => {
  function memorizeControl(
    state: ChapterMemorizeState,
  ): ChapterMemorizeControl {
    return { state, onMemorize: vi.fn(), onOpenPack: vi.fn() };
  }

  const MEMORIZE_PSALM_1: ChapterMemorizeState = {
    kind: "memorize",
    title: "Psalm 1",
  };

  it("offers Memorize Psalm 1 as an icon and opens the sheet", async () => {
    const user = userEvent.setup();
    const memorize = memorizeControl(MEMORIZE_PSALM_1);
    renderHeader({ book: "Psalms", chapter: 1, memorize });

    const button = screen.getByRole("button", { name: "Memorize Psalm 1" });
    expect(button).toHaveAttribute("data-tour-id", "chapter-memorize");
    expect(button).toHaveClass("size-8", "px-0", "justify-center", "gap-0");
    expect(button).toHaveClass(CHAPTER_CHROME_TIGHT_HIDE_CLASS);
    expect(button).not.toHaveTextContent("Memorize");
    expect(button.querySelector("[data-memorize-mark]")).toBeNull();

    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", { name: "Memorize Psalm 1" }),
    ).toHaveAttribute("data-side", "bottom");

    await user.click(button);
    expect(memorize.onMemorize).toHaveBeenCalledWith(button);
    expect(memorize.onOpenPack).not.toHaveBeenCalled();
  });

  it("lets the first visible control take leftover space beside the note", () => {
    renderHeader({
      book: "Psalms",
      chapter: 1,
      memorize: memorizeControl(MEMORIZE_PSALM_1),
    });

    const button = screen.getByRole("button", { name: "Memorize Psalm 1" });
    const note = screen.getByRole("button", {
      name: "Add a chapter note for Psalm 1",
    });
    const headers = screen
      .getByRole("switch", { name: /Headers/ })
      .closest("div");
    expect(headers).toHaveClass("ml-auto");
    expect(headers).toHaveClass(CHAPTER_CHROME_TIGHT_HIDE_CLASS);
    expect(headers).toHaveClass(CHAPTER_CHROME_MEMORIZE_CROWDED_HIDE_CLASS);
    expect(screen.getByText("Headers")).toHaveClass(
      CHAPTER_CHROME_COMPACT_LABEL_CLASS,
    );
    expect(
      (headers?.compareDocumentPosition(button) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      button.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(note).not.toHaveClass("ml-auto");
  });

  it("always shows a ringed icon while memorizing", async () => {
    const user = userEvent.setup();
    renderHeader({
      book: "Psalms",
      chapter: 1,
      memorize: memorizeControl({
        kind: "memorizing",
        title: "Psalm 1",
        packId: "pack_1",
        learnedVerses: 2,
        totalVerses: 6,
      }),
    });

    const button = screen.getByRole("button", {
      name: "Memorizing, 2 of 6 learned, Psalm 1",
    });
    expect(button).toHaveClass("size-8");
    expect(button).not.toHaveTextContent("Memorizing");
    const mark = button.querySelector('[data-memorize-mark="progress"]');
    expect(mark).toHaveAttribute("aria-hidden", "true");
    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", {
        name: "Memorizing Psalm 1 · 2 of 6 learned · Open pack",
      }),
    ).toBeInTheDocument();
  });

  it("checks the icon once memorized", async () => {
    const user = userEvent.setup();
    renderHeader({
      book: "Psalms",
      chapter: 1,
      memorize: memorizeControl({
        kind: "memorized",
        title: "Psalm 1",
        packId: "pack_1",
      }),
    });

    const button = screen.getByRole("button", { name: "Memorized, Psalm 1" });
    expect(button).not.toHaveTextContent("Memorized");
    expect(button.querySelector('[data-memorize-mark="done"]')).not.toBeNull();
    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", {
        name: "Memorized Psalm 1 · Open pack",
      }),
    ).toBeInTheDocument();
  });

  it("opens the pack from a memorizing icon", async () => {
    const user = userEvent.setup();
    const memorize = memorizeControl({
      kind: "memorizing",
      title: "Psalm 1",
      packId: "pack_1",
      learnedVerses: 0,
      totalVerses: 6,
    });
    renderHeader({ book: "Psalms", chapter: 1, memorize });

    const button = screen.getByRole("button", {
      name: "Memorizing, 0 of 6 learned, Psalm 1",
    });
    expect(
      button.querySelector('[data-memorize-mark="progress"]'),
    ).not.toBeNull();
    expect(button).not.toHaveTextContent("Psalm 1");

    await user.hover(button);
    expect(
      await screen.findByRole("tooltip", {
        name: "Memorizing Psalm 1 · 0 of 6 learned · Open pack",
      }),
    ).toBeInTheDocument();

    await user.click(button);
    expect(memorize.onOpenPack).toHaveBeenCalledWith("pack_1");
    expect(memorize.onMemorize).not.toHaveBeenCalled();
  });

  it("opens the pack from memorized and part-of icons", async () => {
    const user = userEvent.setup();
    const memorized = memorizeControl({
      kind: "memorized",
      title: "Psalm 1",
      packId: "pack_1",
    });
    renderHeader({ book: "Psalms", chapter: 1, memorize: memorized });
    const done = screen.getByRole("button", { name: "Memorized, Psalm 1" });
    expect(done).not.toHaveTextContent("Memorized");
    await user.hover(done);
    expect(
      await screen.findByRole("tooltip", {
        name: "Memorized Psalm 1 · Open pack",
      }),
    ).toBeInTheDocument();
    await user.click(done);
    expect(memorized.onOpenPack).toHaveBeenCalledWith("pack_1");

    cleanup();
    const partOf = memorizeControl({
      kind: "partOf",
      title: "Sermon on the Mount",
      packId: "pack_sm",
      memorized: false,
      learnedVerses: 4,
      totalVerses: 111,
    });
    renderHeader({ book: "Matthew", chapter: 6, memorize: partOf });
    const part = screen.getByRole("button", {
      name: /^Part of Sermon on the Mount/,
    });
    expect(part).not.toHaveTextContent("Part of");
    expect(
      part.querySelector('[data-memorize-mark="progress"]'),
    ).not.toBeNull();
    await user.hover(part);
    expect(
      await screen.findByRole("tooltip", {
        name: "Part of Sermon on the Mount · 4 of 111 learned · Open pack",
      }),
    ).toBeInTheDocument();
    await user.click(part);
    expect(partOf.onOpenPack).toHaveBeenCalledWith("pack_sm");
  });

  it("is absent without a memorize control", () => {
    renderHeader({ book: "Psalms", chapter: 1, memorize: null });
    expect(
      document.querySelector('[data-tour-id="chapter-memorize"]'),
    ).toBeNull();
  });
});
