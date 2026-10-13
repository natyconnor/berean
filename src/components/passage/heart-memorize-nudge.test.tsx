import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { FeatureHintState } from "@/components/tutorial/use-feature-hint";

import {
  HEART_NUDGE_AUTO_CLOSE_MS,
  HeartMemorizeNudge,
} from "./heart-memorize-nudge";
import {
  isSpanMemorizing,
  useHeartMemorizeNudge,
  type NudgeHeart,
} from "./hooks/use-heart-memorize-nudge";

const { dismissedHint, openSheet } = vi.hoisted(() => {
  const state: FeatureHintState = {
    pending: false,
    completed: false,
    dismissed: true,
    shown: true,
    complete: () => {},
    dismiss: () => {},
    markShown: () => {},
  };
  return { dismissedHint: state, openSheet: vi.fn() };
});

// Someone who picked the old "Don't ask again" still gets the popover.
vi.mock("@/components/tutorial/use-feature-hint", () => ({
  useFeatureHint: () => dismissedHint,
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: openSheet }),
}));

const PSALM_1_5 = { book: "Psalms", chapter: 1, startVerse: 5, endVerse: 5 };

function Harness({
  hearted: initiallyHearted = false,
  hearts = [],
  suppressed = false,
  onUnheart = () => {},
}: {
  hearted?: boolean;
  hearts?: NudgeHeart[];
  suppressed?: boolean;
  onUnheart?: () => void;
}) {
  const [hearted, setHearted] = useState(initiallyHearted);
  const { heartClicked, heartedClicked, nudge } = useHeartMemorizeNudge({
    suppressed,
  });
  return (
    <>
      <button
        type="button"
        aria-pressed={hearted}
        // jsdom lays nothing out; a zero rect reads as scrolled out of view.
        ref={(button) => {
          if (button) {
            button.getBoundingClientRect = () => new DOMRect(300, 200, 36, 36);
          }
        }}
        onClick={(event) => {
          if (hearted) {
            heartedClicked(PSALM_1_5, event.currentTarget, () => {
              setHearted(false);
              onUnheart();
            });
            return;
          }
          heartClicked(PSALM_1_5, event.currentTarget, hearts);
          setHearted(true);
        }}
      >
        Heart this verse
      </button>
      <HeartMemorizeNudge {...nudge} />
    </>
  );
}

function heartButton() {
  return screen.getByRole("button", { name: "Heart this verse" });
}

async function clickHeart() {
  await userEvent.click(heartButton());
}

function savedDialog() {
  return screen.queryByRole("dialog", { name: "Saved to your hearts" });
}

function heartedDialog() {
  return screen.queryByRole("dialog", { name: "In your hearts" });
}

beforeAll(() => {
  // `hideWhenDetached` clips to the viewport, which jsdom sizes 0×0.
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

beforeEach(() => {
  openSheet.mockReset();
});

describe("HeartMemorizeNudge after hearting", () => {
  it("offers to memorize a verse just hearted, without taking focus", async () => {
    render(<Harness />);
    await clickHeart();

    const dialog = savedDialog();
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription("Memorize Psalm 1:5?");
    expect(screen.getByRole("button", { name: "Not now" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Don.t ask again/ }),
    ).not.toBeInTheDocument();
    expect(heartButton()).toHaveFocus();
  });

  it("opens the Memorize sheet for the span and closes", async () => {
    render(<Harness />);
    await clickHeart();
    await userEvent.click(screen.getByRole("button", { name: "Memorize" }));

    expect(openSheet).toHaveBeenCalledWith(
      { kind: "spans", spans: [PSALM_1_5] },
      { returnFocusTo: heartButton() },
    );
    expect(savedDialog()).not.toBeInTheDocument();
  });

  it("shows after every heart, Not now included", async () => {
    const onUnheart = vi.fn();
    render(<Harness onUnheart={onUnheart} />);
    await clickHeart();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(savedDialog()).not.toBeInTheDocument();
    expect(heartButton()).toHaveAttribute("aria-pressed", "true");

    await clickHeart();
    await userEvent.click(screen.getByRole("button", { name: "Unheart" }));
    expect(onUnheart).toHaveBeenCalledOnce();

    await clickHeart();
    expect(savedDialog()).toBeInTheDocument();
  });

  it("does not show when the click unhearts or for something being memorized", async () => {
    const { unmount } = render(
      <Harness hearts={[{ startVerse: 5, endVerse: 5 }]} />,
    );
    await clickHeart();
    expect(savedDialog()).not.toBeInTheDocument();
    unmount();

    render(
      <Harness
        hearts={[{ startVerse: 1, endVerse: 6, passageMemoryId: "p" }]}
      />,
    );
    await clickHeart();
    expect(savedDialog()).not.toBeInTheDocument();
  });

  it("does not show in Focus mode or a tour, or over another popover", async () => {
    const { unmount } = render(<Harness suppressed />);
    await clickHeart();
    expect(savedDialog()).not.toBeInTheDocument();
    unmount();

    render(<Harness />);
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.append(other);
    try {
      await clickHeart();
      expect(savedDialog()).not.toBeInTheDocument();
    } finally {
      other.remove();
    }
  });

  it("closes by itself after 6 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Harness />);
      await clickHeart();
      expect(savedDialog()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(HEART_NUDGE_AUTO_CLOSE_MS - 100);
      });
      expect(savedDialog()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(savedDialog()).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on Escape", async () => {
    render(<Harness />);
    await clickHeart();
    await userEvent.keyboard("{Escape}");
    expect(savedDialog()).not.toBeInTheDocument();
  });

  it("turns into Memorize or Unheart when its heart is clicked again", async () => {
    render(<Harness />);
    await clickHeart();
    expect(savedDialog()).toBeInTheDocument();

    await clickHeart();
    expect(savedDialog()).not.toBeInTheDocument();
    expect(heartedDialog()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memorize" })).toHaveFocus();
  });
});

describe("HeartMemorizeNudge on a heart already on", () => {
  it("offers Memorize or Unheart and takes focus", async () => {
    render(<Harness hearted />);
    await clickHeart();

    const dialog = heartedDialog();
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription("Memorize Psalm 1:5?");
    expect(screen.getByRole("button", { name: "Memorize" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Unheart" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Not now" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Don.t ask again/ }),
    ).not.toBeInTheDocument();
  });

  it("unhearts on Unheart and returns focus to the heart", async () => {
    const onUnheart = vi.fn();
    render(<Harness hearted onUnheart={onUnheart} />);
    await clickHeart();
    await userEvent.click(screen.getByRole("button", { name: "Unheart" }));

    expect(onUnheart).toHaveBeenCalledOnce();
    expect(heartedDialog()).not.toBeInTheDocument();
    expect(heartButton()).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(heartButton()).toHaveFocus());
  });

  it("opens the Memorize sheet without unhearting", async () => {
    const onUnheart = vi.fn();
    render(<Harness hearted onUnheart={onUnheart} />);
    await clickHeart();
    await userEvent.click(screen.getByRole("button", { name: "Memorize" }));

    expect(openSheet).toHaveBeenCalledWith(
      { kind: "spans", spans: [PSALM_1_5] },
      { returnFocusTo: heartButton() },
    );
    expect(onUnheart).not.toHaveBeenCalled();
    expect(heartedDialog()).not.toBeInTheDocument();
  });

  it("stays open until used", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Harness hearted />);
      await clickHeart();
      act(() => {
        vi.advanceTimersByTime(HEART_NUDGE_AUTO_CLOSE_MS * 2);
      });
      expect(heartedDialog()).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on Escape, a click elsewhere, or its heart, keeping the heart", async () => {
    const onUnheart = vi.fn();
    render(<Harness hearted onUnheart={onUnheart} />);

    await clickHeart();
    await userEvent.keyboard("{Escape}");
    expect(heartedDialog()).not.toBeInTheDocument();
    await waitFor(() => expect(heartButton()).toHaveFocus());

    await clickHeart();
    await userEvent.click(document.body);
    expect(heartedDialog()).not.toBeInTheDocument();

    await clickHeart();
    expect(heartedDialog()).toBeInTheDocument();
    await clickHeart();
    expect(heartedDialog()).not.toBeInTheDocument();

    expect(onUnheart).not.toHaveBeenCalled();
    expect(heartButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("shows in Focus mode too, since it was asked for", async () => {
    render(<Harness hearted suppressed />);
    await clickHeart();
    expect(heartedDialog()).toBeInTheDocument();
  });
});

describe("isSpanMemorizing", () => {
  it("is true when one in-Memory or passage heart contains the span", () => {
    expect(
      isSpanMemorizing(5, 5, [
        { startVerse: 5, endVerse: 5, memory: { inMemory: true } },
      ]),
    ).toBe(true);
    expect(
      isSpanMemorizing(5, 6, [
        { startVerse: 1, endVerse: 6, passageMemoryId: "p" },
      ]),
    ).toBe(true);
  });

  it("is false for plain hearts and partial coverage", () => {
    expect(
      isSpanMemorizing(5, 5, [
        { startVerse: 5, endVerse: 5, memory: { inMemory: false } },
      ]),
    ).toBe(false);
    expect(
      isSpanMemorizing(5, 6, [
        { startVerse: 5, endVerse: 5, memory: { inMemory: true } },
        { startVerse: 6, endVerse: 6, memory: { inMemory: true } },
      ]),
    ).toBe(false);
  });
});
