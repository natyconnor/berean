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

const sampleSummary = {
  verseCount: 15,
  packCount: 8,
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
  passagePacks: [
    {
      name: "Sample · Psalm 1 (start passage)",
      description: "Eligible scope pack with no passage row yet.",
      howToTry: "Open this pack → Learn as a passage.",
      role: "readyToStart",
    },
  ],
};

describe("PreviewMemorySeedCard", () => {
  beforeEach(() => {
    seedPreviewMemoryMock.mockReset();
    seedPreviewMemoryMock.mockResolvedValue(sampleSummary);
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
      screen.queryByRole("button", { name: /load sample data/i }),
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

    await user.click(screen.getByRole("button", { name: /load sample data/i }));

    expect(seedPreviewMemoryMock).toHaveBeenCalledTimes(1);
    const buttonArgs = seedPreviewMemoryMock.mock.calls[0]?.[0] as {
      now: number;
      tzOffsetMinutes: number;
    };
    expect(buttonArgs).toEqual({
      now: 42,
      tzOffsetMinutes: new Date(42).getTimezoneOffset(),
    });
    expect(await screen.findByText(/john 11:35/i)).toBeInTheDocument();
    expect(screen.getByText(/4 due for review/i)).toBeInTheDocument();
    expect(
      screen.getByText(/sample · psalm 1 \(start passage\)/i),
    ).toBeInTheDocument();
  });

  it("auto-seeds an empty preview account once", async () => {
    render(<PreviewMemorySeedCard now={7} heartedTotal={0} enabled autoSeed />);

    expect(seedPreviewMemoryMock).toHaveBeenCalledTimes(1);
    const autoArgs = seedPreviewMemoryMock.mock.calls[0]?.[0] as {
      now: number;
      tzOffsetMinutes: number;
    };
    expect(autoArgs).toEqual({
      now: 7,
      tzOffsetMinutes: new Date(7).getTimezoneOffset(),
    });
    expect(await screen.findByText(/john 11:35/i)).toBeInTheDocument();
  });

  it("does not auto-seed when the account already has verses", () => {
    render(<PreviewMemorySeedCard now={7} heartedTotal={4} enabled autoSeed />);
    expect(seedPreviewMemoryMock).not.toHaveBeenCalled();
  });

  it("auto-seeds only the small set when the account is empty", () => {
    render(
      <PreviewMemorySeedCard
        now={7}
        heartedTotal={0}
        enabled
        autoSeed
        seedTokens={["john-3-16", "sample-mix"]}
      />,
    );
    expect(seedPreviewMemoryMock).toHaveBeenCalledTimes(1);
    expect(seedPreviewMemoryMock.mock.calls[0]?.[0]).toEqual({
      now: 7,
      tzOffsetMinutes: new Date(7).getTimezoneOffset(),
      tokens: ["john-3-16", "sample-mix"],
    });
  });

  it("ignores the small set off preview (no auto-seed)", () => {
    render(
      <PreviewMemorySeedCard
        now={7}
        heartedTotal={0}
        enabled
        autoSeed={false}
        seedTokens={["john-3-16"]}
        reseed
      />,
    );
    expect(seedPreviewMemoryMock).not.toHaveBeenCalled();
  });

  it("reuses an already-seeded account even when previewSeed is present (F28)", () => {
    render(
      <PreviewMemorySeedCard
        now={7}
        heartedTotal={4}
        enabled
        autoSeed
        seedTokens={["john-3-16"]}
      />,
    );
    expect(seedPreviewMemoryMock).not.toHaveBeenCalled();
  });

  it("waits for the hearted count before deciding", () => {
    render(
      <PreviewMemorySeedCard
        now={7}
        heartedTotal={undefined}
        enabled
        autoSeed
        seedTokens={["john-3-16"]}
        reseed
      />,
    );
    expect(seedPreviewMemoryMock).not.toHaveBeenCalled();
  });

  it("previewReseed replaces a seeded account with the set, then strips itself", async () => {
    const onReseeded = vi.fn();
    render(
      <PreviewMemorySeedCard
        now={7}
        heartedTotal={4}
        enabled
        autoSeed
        seedTokens={["sample-mix"]}
        reseed
        onReseeded={onReseeded}
      />,
    );
    expect(seedPreviewMemoryMock).toHaveBeenCalledTimes(1);
    expect(seedPreviewMemoryMock.mock.calls[0]?.[0]).toMatchObject({
      tokens: ["sample-mix"],
    });
    await screen.findByText(/john 11:35/i);
    expect(onReseeded).toHaveBeenCalledTimes(1);
  });

  it("keeps previewReseed in the URL when the reseed fails", async () => {
    seedPreviewMemoryMock.mockRejectedValue(
      new Error("Unknown sample items: nope"),
    );
    const onReseeded = vi.fn();
    render(
      <PreviewMemorySeedCard
        now={7}
        heartedTotal={4}
        enabled
        autoSeed
        seedTokens={["nope"]}
        reseed
        onReseeded={onReseeded}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /unknown sample items: nope/i,
    );
    expect(onReseeded).not.toHaveBeenCalled();
  });

  it("the button always loads the full sample, even with a small set in the URL (F30)", async () => {
    const user = userEvent.setup();
    render(
      <PreviewMemorySeedCard
        now={42}
        heartedTotal={0}
        enabled
        autoSeed
        seedTokens={["john-3-16"]}
      />,
    );
    await screen.findByText(/john 11:35/i);
    await user.click(
      screen.getByRole("button", { name: /reload sample data/i }),
    );

    expect(seedPreviewMemoryMock).toHaveBeenCalledTimes(2);
    expect(seedPreviewMemoryMock.mock.calls[1]?.[0]).toEqual({
      now: 42,
      tzOffsetMinutes: new Date(42).getTimezoneOffset(),
    });
  });
});
