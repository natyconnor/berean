import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VerseNotes } from "./verse-notes";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";

vi.mock("@/lib/tag-color-styles", () => ({
  useStarterTagBadgeStyle: () => () => undefined,
}));

const baseNote: NoteWithRef = {
  noteId: "note-1" as Id<"notes">,
  content: "A short sample note",
  tags: ["tag-a"],
  verseRef: {
    book: "John",
    chapter: 1,
    startVerse: 1,
    endVerse: 1,
  },
  createdAt: 1,
};

describe("VerseNotes", () => {
  it("opens a collapsed single note from keyboard interaction", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <TooltipProvider>
        <VerseNotes
          notes={[baseNote]}
          isOpen={false}
          onOpen={onOpen}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onAddNote={vi.fn()}
        />
      </TooltipProvider>,
    );

    await user.tab();
    await user.keyboard("{Enter}");

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens a collapsed stack of notes from keyboard interaction", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <TooltipProvider>
        <VerseNotes
          notes={[
            baseNote,
            {
              ...baseNote,
              noteId: "note-2" as Id<"notes">,
              content: "Another note",
              tags: ["tag-b"],
              createdAt: 2,
            },
          ]}
          isOpen={false}
          onOpen={onOpen}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onAddNote={vi.fn()}
        />
      </TooltipProvider>,
    );

    await user.tab();
    await user.keyboard(" ");

    expect(
      screen.getByRole("button", { name: /2 notes/i }),
    ).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
