import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
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
    <TooltipProvider delayDuration={0}>
      <ScopeHeartPreview
        enabled={false}
        onEnabledChange={vi.fn()}
        scopeLabel="Psalm 23"
        preview={previewState()}
        {...props}
      />
    </TooltipProvider>,
  );
}

describe("ScopeHeartPreview", () => {
  it("keeps the control off and the preview hidden by default", () => {
    renderPreview({ preview: psalm23 });

    const control = screen.getByRole("switch", {
      name: "Heart verses in this scope",
    });
    expect(control).not.toBeChecked();
    expect(control).toBeEnabled();
    expect(screen.queryByText(/new unit/)).not.toBeInTheDocument();
  });

  it("summarizes the proposal and marks kept hearts apart from new units", async () => {
    const onEnabledChange = vi.fn();
    const { rerender } = renderPreview({
      preview: psalm23,
      onEnabledChange,
    });

    await userEvent.click(
      screen.getByRole("switch", { name: "Heart verses in this scope" }),
    );
    expect(onEnabledChange).toHaveBeenCalledWith(true);

    rerender(
      <TooltipProvider delayDuration={0}>
        <ScopeHeartPreview
          enabled
          onEnabledChange={onEnabledChange}
          scopeLabel="Psalm 23"
          preview={psalm23}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            "Psalm 23 · 6 verses → 2 new units · 1 already hearted",
      ),
    ).toBeVisible();

    const keptChip = screen.getByTitle("Psalm 23:1–2 — already hearted");
    const proposedChip = screen.getByTitle("Psalm 23:4–6 — 52 words");
    expect(keptChip).toHaveTextContent("1–2");
    expect(keptChip.className).toContain("text-muted-foreground");
    expect(proposedChip).toHaveTextContent("4–6");
    expect(proposedChip.className).toContain("bg-primary/15");
    expect(screen.getByText("Kept — already hearted")).toBeInTheDocument();
  });

  it("shows a skeleton while the passage text loads", () => {
    renderPreview({
      enabled: true,
      preview: previewState({ loading: true }),
    });

    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Loading verse preview",
    );
  });

  it("offers a retry when the passage text fails to load", async () => {
    const retry = vi.fn();
    renderPreview({
      enabled: true,
      preview: previewState({ error: "ESV API error: 500", retry }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the verse text for this scope.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("disables the control over the chapter cap and explains why", async () => {
    renderPreview({
      preview: previewState({ allowed: false, chapterCount: 150 }),
    });

    const control = screen.getByRole("switch", {
      name: "Heart verses in this scope",
    });
    expect(control).toBeDisabled();
    expect(screen.getByText("Limited to 20 chapters")).toBeInTheDocument();

    await userEvent.hover(screen.getByText("Heart verses in this scope"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "This scope covers 150 chapters. Hearting a scope is limited to 20 chapters so the Bible text API isn't overloaded — narrow the scope, for example one small book or a chapter range.",
    );
  });

  it("asks for a book when the scope is empty", async () => {
    renderPreview({
      preview: previewState({ allowed: false, chapterCount: Infinity }),
    });

    expect(
      screen.getByRole("switch", { name: "Heart verses in this scope" }),
    ).toBeDisabled();
    await userEvent.hover(screen.getByText("Heart verses in this scope"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Choose at least one book to heart verses from.",
    );
  });
});
