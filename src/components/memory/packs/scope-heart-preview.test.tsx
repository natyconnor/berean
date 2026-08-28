import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ScopeHeartPreviewState } from "@/hooks/use-scope-heart-preview";

import { ScopeHeartPreview } from "./scope-heart-preview";

function previewState(
  overrides: Partial<ScopeHeartPreviewState> = {},
): ScopeHeartPreviewState {
  return {
    allowed: true,
    chapterCount: 1,
    loading: false,
    error: null,
    chapters: [],
    verseCount: 0,
    proposedCount: 0,
    keptCount: 0,
    proposedSpans: [],
    retry: vi.fn(),
    ...overrides,
  };
}

const psalm23 = previewState({
  chapterCount: 1,
  verseCount: 6,
  proposedCount: 2,
  keptCount: 1,
  chapters: [
    {
      book: "Psalms",
      chapter: 23,
      label: "Psalm 23",
      verseCount: 6,
      groups: [
        {
          book: "Psalms",
          chapter: 23,
          startVerse: 1,
          endVerse: 2,
          wordCount: 31,
          kind: "kept",
        },
        {
          book: "Psalms",
          chapter: 23,
          startVerse: 3,
          endVerse: 3,
          wordCount: 18,
          kind: "proposed",
        },
        {
          book: "Psalms",
          chapter: 23,
          startVerse: 4,
          endVerse: 6,
          wordCount: 52,
          kind: "proposed",
        },
      ],
    },
  ],
  proposedSpans: [
    { book: "Psalms", chapter: 23, startVerse: 3, endVerse: 3 },
    { book: "Psalms", chapter: 23, startVerse: 4, endVerse: 6 },
  ],
});

function renderPreview(
  props: Partial<React.ComponentProps<typeof ScopeHeartPreview>> = {},
) {
  return render(
    <ScopeHeartPreview
      scopeLabel="Psalm 23"
      preview={previewState()}
      {...props}
    />,
  );
}

describe("ScopeHeartPreview", () => {
  it("summarizes the proposal and marks kept hearts apart from new units", () => {
    renderPreview({ preview: psalm23 });

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            "Psalm 23 · 6 verses → 2 new passages · 1 already hearted",
      ),
    ).toBeVisible();

    const keptChip = screen.getByTitle("Psalm 23:1–2 — already hearted");
    const proposedChip = screen.getByTitle("Psalm 23:4–6 — 52 words");
    expect(keptChip).toHaveTextContent("1–2");
    expect(keptChip.className).toContain("text-muted-foreground");
    expect(proposedChip).toHaveTextContent("4–6");
    expect(proposedChip.className).toContain("bg-primary/15");
    expect(screen.getByText("New passage")).toBeInTheDocument();
  });

  it("shows a skeleton while the passage text loads", () => {
    renderPreview({
      preview: previewState({ loading: true }),
    });

    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Loading verse preview",
    );
  });

  it("offers a retry when the passage text fails to load", async () => {
    const retry = vi.fn();
    renderPreview({
      preview: previewState({ error: "ESV API error: 500", retry }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the verse text for this scope.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
