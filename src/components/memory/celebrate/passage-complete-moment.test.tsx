import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompositePassageSegment } from "@/hooks/use-esv-composite-passage";
import { DAY_MS } from "@/lib/memory-scheduler";
import type { Id } from "../../../../convex/_generated/dataModel";

import { PassageCompleteMoment } from "./passage-complete-moment";

const mocks = vi.hoisted(() => ({
  markCelebrated: vi.fn(),
  reduceMotion: false,
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.markCelebrated,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: { passageMemory: { markCelebrated: "passageMemory.markCelebrated" } },
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => mocks.reduceMotion };
});

const PACK_ID = "pack_1" as Id<"packs">;

function segment(startVerse: number, text: string): CompositePassageSegment {
  return {
    reference: { book: "Psalms", chapter: 1, startVerse, endVerse: startVerse },
    text,
  };
}

const SEGMENTS = [
  segment(1, "Blessed is the man who walks not in the counsel of the wicked,"),
  segment(2, "but his delight is in the law of the Lord,"),
];

function renderMoment(onDone = vi.fn()) {
  const view = render(
    <PassageCompleteMoment
      packId={PACK_ID}
      title="Psalm 1"
      verseCount={6}
      createdAt={Date.now() - 3 * DAY_MS}
      segments={SEGMENTS}
      onDone={onDone}
    />,
  );
  return { ...view, onDone };
}

describe("PassageCompleteMoment", () => {
  beforeEach(() => {
    mocks.markCelebrated.mockReset();
    mocks.markCelebrated.mockResolvedValue(null);
    mocks.reduceMotion = false;
  });

  it("says the passage is known by heart, with its verses and days", () => {
    renderMoment();

    const dialog = screen.getByRole("dialog", {
      name: "You can say all of Psalm 1 by heart.",
    });
    expect(dialog).toHaveAccessibleDescription("6 verses · 4 days");
    expect(dialog).toHaveTextContent(SEGMENTS[0].text);
    expect(dialog).toHaveTextContent(SEGMENTS[1].text);
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });

  it("marks the passage celebrated once when shown", () => {
    const { rerender, onDone } = renderMoment();
    rerender(
      <PassageCompleteMoment
        packId={PACK_ID}
        title="Psalm 1"
        verseCount={6}
        createdAt={Date.now() - 3 * DAY_MS}
        segments={SEGMENTS}
        onDone={onDone}
      />,
    );

    expect(mocks.markCelebrated).toHaveBeenCalledTimes(1);
    expect(mocks.markCelebrated).toHaveBeenCalledWith({ packId: PACK_ID });
  });

  it("closes on Done or Escape", async () => {
    const { onDone } = renderMoment();
    expect(screen.getByRole("button", { name: "Done" })).not.toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledTimes(1);

    await userEvent.keyboard("{Escape}");
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("appears without motion when reduced motion is on", () => {
    mocks.reduceMotion = true;
    renderMoment();

    const headline = screen.getByText("You can say all of Psalm 1 by heart.");
    const fading = headline.closest("div");
    expect(fading?.getAttribute("style") ?? "").not.toMatch(/opacity:\s*0/);
  });
});
