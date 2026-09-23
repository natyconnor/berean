import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NoteEditor } from "@/components/notes/note-editor";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import { VerseRangeOverlayChip } from "./verse-range-overlay-chip";

const motionState = vi.hoisted(() => ({ reduce: false }));

vi.mock("framer-motion", async () => {
  const actual =
    await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => motionState.reduce,
  };
});

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => [],
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => Promise.resolve(),
}));

vi.mock("@/components/notes/editor/inline-verse-editor", () => ({
  InlineVerseEditor: ({ onChange }: { onChange: (body: NoteBody) => void }) => (
    <textarea
      aria-label="Note"
      onChange={(event) =>
        onChange({
          version: 1,
          segments: [{ type: "text", text: event.target.value }],
        })
      }
    />
  ),
}));

function john(startVerse: number, endVerse = startVerse): VerseRef {
  return { book: "John", chapter: 1, startVerse, endVerse };
}

function renderChip(verseRef: VerseRef, onNudge = vi.fn(), disabled = false) {
  return {
    onNudge,
    ...render(
      <TooltipProvider>
        <VerseRangeOverlayChip
          verseRef={verseRef}
          disabled={disabled}
          onNudge={onNudge}
        />
      </TooltipProvider>,
    ),
  };
}

function nudge(
  end: string,
  direction: string,
  root: ParentNode = document,
): HTMLButtonElement {
  const button = root.querySelector(`[data-verse-nudge="${end}:${direction}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`missing nudge ${end}:${direction}`);
  }
  return button;
}

describe("VerseRangeOverlayChip", () => {
  it("rests as a badge and reveals chevrons on hover without a native title", async () => {
    motionState.reduce = false;
    const user = userEvent.setup();
    const { onNudge } = renderChip(john(16));

    expect(screen.getByRole("group")).toHaveTextContent("John 1:16");
    expect(nudge("start", "grow")).toBeDisabled();
    expect(nudge("start", "grow")).toHaveAttribute("tabindex", "-1");
    expect(nudge("end", "grow")).toHaveClass("opacity-0!");
    expect(nudge("end", "grow")).toHaveClass("duration-150");
    expect(nudge("end", "grow")).not.toHaveAttribute("title");
    expect(nudge("end", "grow")).toHaveAttribute(
      "aria-label",
      "Add next verse",
    );
    expect(
      document.querySelector('[data-verse-nudge="start:shrink"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-verse-nudge="end:shrink"]'),
    ).toBeNull();

    await user.hover(screen.getByRole("group"));
    expect(screen.getByRole("group")).toHaveAttribute(
      "data-overlay-visible",
      "true",
    );
    expect(nudge("start", "grow")).toBeEnabled();
    expect(nudge("start", "grow")).toHaveAttribute(
      "aria-label",
      "Add previous verse",
    );
    expect(nudge("end", "grow")).toHaveClass("opacity-100");

    await user.click(nudge("end", "grow"));
    expect(onNudge).toHaveBeenCalledWith("end", "grow");
    await user.click(nudge("start", "grow"));
    expect(onNudge).toHaveBeenCalledWith("start", "grow");
  });

  it("shows independent shrink controls on a range", async () => {
    const user = userEvent.setup();
    const range = renderChip(john(15, 17));
    const chip = range.container.querySelector("[data-verse-range-chip]");
    if (!chip) throw new Error("missing chip");
    await user.hover(chip);

    expect(chip).toHaveTextContent("John 1:15-17");
    await user.click(nudge("start", "shrink", range.container));
    expect(range.onNudge).toHaveBeenCalledWith("start", "shrink");
    expect(nudge("start", "shrink", range.container)).toHaveAttribute(
      "aria-label",
      "Remove first verse",
    );
    await user.click(nudge("end", "shrink", range.container));
    expect(range.onNudge).toHaveBeenCalledWith("end", "shrink");
    expect(nudge("end", "shrink", range.container)).toHaveAttribute(
      "aria-label",
      "Remove last verse",
    );
  });

  it("disables grow-start on verse 1 and grow-end on the last verse", () => {
    const atStart = renderChip(john(1));
    fireEvent.mouseEnter(
      atStart.container.querySelector("[data-verse-range-chip]")!,
    );
    expect(nudge("start", "grow", atStart.container)).toBeDisabled();
    fireEvent.click(nudge("start", "grow", atStart.container));
    expect(atStart.onNudge).not.toHaveBeenCalled();

    const atEnd = renderChip(john(51));
    fireEvent.mouseEnter(
      atEnd.container.querySelector("[data-verse-range-chip]")!,
    );
    expect(nudge("end", "grow", atEnd.container)).toBeDisabled();
  });

  it("pins on a coarse pointer and unpins on an outside pointerdown", () => {
    renderChip(john(16));
    const chip = screen.getByRole("group");
    fireEvent.pointerDown(chip, { pointerType: "touch" });
    expect(chip).toHaveAttribute("data-overlay-visible", "true");
    expect(nudge("end", "grow")).toBeEnabled();

    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(chip).toHaveAttribute("data-overlay-visible", "false");
  });

  it("keeps hidden nudges out of the tab order until the chip is focused", async () => {
    const user = userEvent.setup();
    const onNudge = vi.fn();
    renderChip(john(16), onNudge);

    await user.tab();
    expect(screen.getByRole("group")).toHaveFocus();
    expect(nudge("end", "grow")).toBeEnabled();
    expect(nudge("end", "grow")).toHaveAttribute("tabindex", "0");

    await user.tab();
    expect(nudge("start", "grow")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onNudge).toHaveBeenCalledWith("start", "grow");
  });

  it("drops the opacity transition when reduced motion is on", () => {
    motionState.reduce = true;
    renderChip(john(16));
    expect(nudge("end", "grow")).toHaveClass("transition-none");
    motionState.reduce = false;
  });
});

describe("NoteEditor retarget gate", () => {
  it("keeps a static badge when onRetargetVerse is absent", () => {
    render(
      <TooltipProvider>
        <NoteEditor verseRef={john(16)} onSave={vi.fn()} onCancel={vi.fn()} />
      </TooltipProvider>,
    );

    expect(screen.getByText("John 1:16")).toBeInTheDocument();
    expect(document.querySelector("[data-verse-range-chip]")).toBeNull();
    expect(document.querySelector("[data-verse-nudge]")).toBeNull();
  });

  it("snapshots body and tags before nudging a new draft", async () => {
    const user = userEvent.setup();
    const onRetargetVerse = vi.fn();
    render(
      <TooltipProvider>
        <NoteEditor
          verseRef={john(16)}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onRetargetVerse={onRetargetVerse}
        />
      </TooltipProvider>,
    );

    await user.type(screen.getByLabelText("Note"), "Draft stays");
    await user.hover(screen.getByRole("group"));
    await user.click(nudge("end", "grow"));

    expect(onRetargetVerse).toHaveBeenCalledWith(john(16, 17), {
      body: "Draft stays",
      tags: [],
    });
  });

  it("shows the overlay on a saved edit without treating it as a new draft", async () => {
    const user = userEvent.setup();
    const onRetargetVerse = vi.fn();
    const onDirtyChange = vi.fn();
    render(
      <TooltipProvider>
        <NoteEditor
          verseRef={john(16)}
          initialContent="Saved body"
          initialTags={["hope"]}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onDirtyChange={onDirtyChange}
          onRetargetVerse={onRetargetVerse}
          dirtyAsNewDraft={false}
        />
      </TooltipProvider>,
    );

    expect(document.querySelector("[data-verse-range-chip]")).not.toBeNull();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.hover(screen.getByRole("group"));
    await user.click(nudge("end", "grow"));

    expect(onRetargetVerse).toHaveBeenCalledWith(john(16, 17), {
      body: "Saved body",
      tags: ["hope"],
    });
  });
});
