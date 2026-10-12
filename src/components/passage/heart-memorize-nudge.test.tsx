import { act, render, screen } from "@testing-library/react";
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

const { hint, openSheet } = vi.hoisted(() => {
  const dismiss = vi.fn();
  const markShown = vi.fn();
  const state: FeatureHintState = {
    pending: true,
    completed: false,
    dismissed: false,
    shown: false,
    complete: vi.fn(),
    dismiss,
    markShown,
  };
  return { hint: { ...state, dismiss, markShown }, openSheet: vi.fn() };
});

vi.mock("@/components/tutorial/use-feature-hint", () => ({
  useFeatureHint: () => hint,
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: openSheet }),
}));

const PSALM_1_5 = { book: "Psalms", chapter: 1, startVerse: 5, endVerse: 5 };

function Harness({
  hearts = [],
  suppressed = false,
}: {
  hearts?: NudgeHeart[];
  suppressed?: boolean;
}) {
  const { heartClicked, nudge } = useHeartMemorizeNudge({ suppressed });
  return (
    <>
      <button
        type="button"
        // jsdom lays nothing out; a zero rect reads as scrolled out of view.
        ref={(button) => {
          if (button) {
            button.getBoundingClientRect = () => new DOMRect(300, 200, 36, 36);
          }
        }}
        onClick={(event) =>
          heartClicked(PSALM_1_5, event.currentTarget, hearts)
        }
      >
        Heart this verse
      </button>
      <HeartMemorizeNudge {...nudge} />
    </>
  );
}

async function clickHeart() {
  await userEvent.click(
    screen.getByRole("button", { name: "Heart this verse" }),
  );
}

function nudgeDialog() {
  return screen.queryByRole("dialog", { name: "Saved to your hearts" });
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
  hint.pending = true;
  hint.dismissed = false;
  hint.dismiss.mockReset();
  hint.markShown.mockReset();
  openSheet.mockReset();
});

describe("HeartMemorizeNudge", () => {
  it("offers to memorize a verse just hearted, without taking focus", async () => {
    render(<Harness />);
    await clickHeart();

    const dialog = nudgeDialog();
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription("Memorize Psalm 1:5?");
    expect(
      screen.getByRole("button", { name: "Heart this verse" }),
    ).toHaveFocus();
    expect(hint.markShown).toHaveBeenCalled();
  });

  it("opens the Memorize sheet for the span and closes", async () => {
    render(<Harness />);
    await clickHeart();
    await userEvent.click(screen.getByRole("button", { name: "Memorize" }));

    expect(openSheet).toHaveBeenCalledWith(
      { kind: "spans", spans: [PSALM_1_5] },
      {
        returnFocusTo: screen.getByRole("button", { name: "Heart this verse" }),
      },
    );
    expect(nudgeDialog()).not.toBeInTheDocument();
  });

  it("shows again after Not now, and stops after Don't ask again", async () => {
    render(<Harness />);
    await clickHeart();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(nudgeDialog()).not.toBeInTheDocument();
    expect(hint.dismiss).not.toHaveBeenCalled();

    await clickHeart();
    expect(nudgeDialog()).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Don't ask again" }),
    );
    expect(hint.dismiss).toHaveBeenCalledOnce();
    expect(nudgeDialog()).not.toBeInTheDocument();
  });

  it("does not show once the hint is dismissed", async () => {
    hint.pending = false;
    hint.dismissed = true;
    render(<Harness />);
    await clickHeart();
    expect(nudgeDialog()).not.toBeInTheDocument();
  });

  it("does not show for unhearting or for something being memorized", async () => {
    const { rerender } = render(
      <Harness hearts={[{ startVerse: 5, endVerse: 5 }]} />,
    );
    await clickHeart();
    expect(nudgeDialog()).not.toBeInTheDocument();

    rerender(
      <Harness
        hearts={[{ startVerse: 1, endVerse: 6, passageMemoryId: "p" }]}
      />,
    );
    await clickHeart();
    expect(nudgeDialog()).not.toBeInTheDocument();
  });

  it("does not show in Focus mode or a tour, or over another popover", async () => {
    const { rerender } = render(<Harness suppressed />);
    await clickHeart();
    expect(nudgeDialog()).not.toBeInTheDocument();

    rerender(<Harness />);
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.append(other);
    try {
      await clickHeart();
      expect(nudgeDialog()).not.toBeInTheDocument();
    } finally {
      other.remove();
    }
  });

  it("closes by itself after 6 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Harness />);
      await clickHeart();
      expect(nudgeDialog()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(HEART_NUDGE_AUTO_CLOSE_MS - 100);
      });
      expect(nudgeDialog()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(nudgeDialog()).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on Escape", async () => {
    render(<Harness />);
    await clickHeart();
    await userEvent.keyboard("{Escape}");
    expect(nudgeDialog()).not.toBeInTheDocument();
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
