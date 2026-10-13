import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import type { ChapterMemorizeState } from "@/lib/chapter-memorize";
import { ChapterHeader } from "./chapter-header";

const mocks = vi.hoisted(() => ({
  hintId: null as string | null,
  trigger: null as boolean | null,
  pending: true,
  tutorial: {
    isMainTutorialComplete: true,
    activeTour: null as string | null,
  },
  dismiss: vi.fn(),
  markShown: vi.fn(),
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({ navigateActiveTab: vi.fn() }),
}));

vi.mock("@/components/tutorial/tutorial-context", () => ({
  useOptionalTutorial: () => mocks.tutorial,
}));

vi.mock("@/components/tutorial/use-feature-hint", () => ({
  useFeatureHint: (hintId: string, trigger: boolean) => {
    mocks.hintId = hintId;
    mocks.trigger = trigger;
    return {
      pending: trigger && mocks.pending,
      completed: false,
      dismissed: false,
      shown: false,
      complete: vi.fn(),
      dismiss: mocks.dismiss,
      markShown: mocks.markShown,
    };
  },
  useMarkHintShownWhenPending: (state: {
    pending: boolean;
    markShown: () => void;
  }) => {
    if (state.pending) state.markShown();
  },
}));

const MEMORIZE_PSALM_1: ChapterMemorizeState = {
  kind: "memorize",
  title: "Psalm 1",
  verseCount: 6,
  learnDays: 4,
};

const NEW_COPY = "New: memorize this chapter in a few minutes a day.";

function renderHeader(state: ChapterMemorizeState = MEMORIZE_PSALM_1) {
  const onMemorize = vi.fn();
  render(
    <TooltipProvider delayDuration={0}>
      <ChapterHeader
        book="Psalms"
        chapter={1}
        showSectionHeaders={false}
        onToggleSectionHeaders={vi.fn()}
        onChapterNotesClick={vi.fn()}
        memorize={{ state, onMemorize, onOpenPack: vi.fn() }}
      />
    </TooltipProvider>,
  );
  return { onMemorize };
}

describe("ChapterHeader Memorize hint", () => {
  beforeEach(() => {
    mocks.hintId = null;
    mocks.trigger = null;
    mocks.pending = true;
    mocks.tutorial = { isMainTutorialComplete: true, activeTour: null };
    mocks.dismiss.mockReset();
    mocks.markShown.mockReset();
    // jsdom lays nothing out; `hideWhenDetached` hides a zero-size anchor and
    // clips to a viewport jsdom sizes 0×0.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(300, 200, 120, 32),
    );
    for (const [key, value] of [
      ["clientWidth", 1024],
      ["clientHeight", 768],
    ] as const) {
      Object.defineProperty(document.documentElement, key, {
        configurable: true,
        value,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tells people who finished the tour that they can memorize the chapter", async () => {
    renderHeader();

    expect(mocks.hintId).toBe(FEATURE_HINTS.CHAPTER_MEMORIZE_NEW);
    const popover = await screen.findByRole("dialog", { name: NEW_COPY });
    expect(popover).toHaveTextContent(NEW_COPY);
    expect(mocks.markShown).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /^Memorize Psalm 1/ }),
    ).not.toHaveFocus();

    await userEvent.click(
      within(popover).getByRole("button", { name: "Got it" }),
    );
    expect(mocks.dismiss).toHaveBeenCalled();
  });

  it("dismisses on Escape", async () => {
    renderHeader();

    await screen.findByRole("dialog", { name: NEW_COPY });
    await userEvent.keyboard("{Escape}");
    expect(mocks.dismiss).toHaveBeenCalled();
  });

  it("waits until the tour is finished and not running", () => {
    mocks.tutorial = { isMainTutorialComplete: false, activeTour: null };
    renderHeader();
    expect(mocks.trigger).toBe(false);
    expect(screen.queryByText(NEW_COPY)).not.toBeInTheDocument();
  });

  it("stays quiet during a tour", () => {
    mocks.tutorial = { isMainTutorialComplete: true, activeTour: "main" };
    renderHeader();
    expect(mocks.trigger).toBe(false);
  });

  it("only offers it while the chapter can be memorized", () => {
    renderHeader({ kind: "memorized", title: "Psalm 1", packId: "pack_1" });
    expect(mocks.trigger).toBe(false);
    expect(screen.queryByText(NEW_COPY)).not.toBeInTheDocument();
  });
});
