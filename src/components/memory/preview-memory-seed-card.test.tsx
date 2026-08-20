import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreviewMemorySeedCard } from "./preview-memory-seed-card";

const seedPreviewMemoryMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => seedPreviewMemoryMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    seedPreviewMemory: {
      seedPreviewMemory: "api.seedPreviewMemory.seedPreviewMemory",
    },
  },
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
  motion: {
    div: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe("PreviewMemorySeedCard", () => {
  beforeEach(() => {
    seedPreviewMemoryMock.mockReset();
    seedPreviewMemoryMock.mockResolvedValue({
      verseCount: 15,
      packCount: 3,
      reviewLogCount: 20,
      dueReviewCount: 4,
      learningDueCount: 4,
      verses: [
        {
          id: "john-11-35",
          label: "Reviewing · due today",
          howToTry: "Open Review — first card in the due queue.",
          book: "John",
          chapter: 11,
          startVerse: 35,
          endVerse: 35,
        },
      ],
      packs: [],
    });
  });

  it("hides the tools outside preview and local dev", () => {
    render(
      <PreviewMemorySeedCard
        now={1}
        heartedTotal={0}
        enabled={false}
        autoSeed
      />,
    );
    expect(
      screen.queryByRole("button", { name: /load sample verses/i }),
    ).not.toBeInTheDocument();
    expect(seedPreviewMemoryMock).not.toHaveBeenCalled();
  });

  it("loads the sample set from the button", async () => {
    const user = userEvent.setup();
    render(
      <PreviewMemorySeedCard
        now={42}
        heartedTotal={3}
        enabled
        autoSeed={false}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /load sample verses/i }),
    );

    expect(seedPreviewMemoryMock).toHaveBeenCalledWith({ now: 42 });
    expect(await screen.findByText(/john 11:35/i)).toBeInTheDocument();
    expect(screen.getByText(/4 due for review/i)).toBeInTheDocument();
  });

  it("auto-seeds an empty preview account once", async () => {
    render(<PreviewMemorySeedCard now={7} heartedTotal={0} enabled autoSeed />);

    expect(seedPreviewMemoryMock).toHaveBeenCalledWith({ now: 7 });
    expect(await screen.findByText(/john 11:35/i)).toBeInTheDocument();
  });

  it("does not auto-seed when the account already has verses", () => {
    render(<PreviewMemorySeedCard now={7} heartedTotal={4} enabled autoSeed />);
    expect(seedPreviewMemoryMock).not.toHaveBeenCalled();
  });
});
