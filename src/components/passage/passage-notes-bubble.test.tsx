import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PassageNotesBubble } from "./passage-notes-bubble";

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => [],
}));

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => Promise.resolve(),
}));

vi.mock("@/components/notes/editor/inline-verse-editor", () => ({
  InlineVerseEditor: () => <textarea aria-label="Note" />,
}));
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";

vi.mock("@/lib/tag-color-styles", () => ({
  useStarterTagBadgeStyle: () => () => undefined,
}));

function passageNote(
  overrides: Partial<NoteWithRef> &
    Pick<NoteWithRef, "noteId" | "content" | "verseRef">,
): NoteWithRef {
  return {
    tags: [],
    createdAt: 1,
    ...overrides,
  };
}

const overlappingNotes: NoteWithRef[] = [
  passageNote({
    noteId: "note-9-11" as Id<"notes">,
    content: "When people withdraw, the mighty are revealed.",
    verseRef: {
      book: "2 Samuel",
      chapter: 23,
      startVerse: 9,
      endVerse: 11,
    },
  }),
  passageNote({
    noteId: "note-9-12" as Id<"notes">,
    content: "The LORD brought about a great victory.",
    verseRef: {
      book: "2 Samuel",
      chapter: 23,
      startVerse: 9,
      endVerse: 12,
    },
    createdAt: 2,
  }),
];

function renderBubble(isOpen: boolean) {
  return render(
    <TooltipProvider>
      <PassageNotesBubble
        notes={overlappingNotes}
        isOpen={isOpen}
        isGlowing={false}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onAddNote={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe("PassageNotesBubble overlapping ranges", () => {
  it("labels a collapsed group with the union range", () => {
    renderBubble(false);

    expect(screen.getByText("2 Samuel 23:9-12")).toBeInTheDocument();
    expect(screen.queryByText("2 Samuel 23:9-11")).not.toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("labels an expanded group with the union, and each note with its own range", () => {
    renderBubble(true);

    expect(screen.getByText("2 Samuel 23:9-12")).toBeInTheDocument();
    expect(screen.getByText("9-11")).toBeInTheDocument();
    expect(screen.getByText("9-12")).toBeInTheDocument();
  });

  it("does not label each card when every note shares the same range", () => {
    render(
      <TooltipProvider>
        <PassageNotesBubble
          notes={[
            overlappingNotes[0],
            passageNote({
              noteId: "note-9-11-b" as Id<"notes">,
              content: "A second note on the same span.",
              verseRef: overlappingNotes[0].verseRef,
              createdAt: 2,
            }),
          ]}
          isOpen={true}
          isGlowing={false}
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onAddNote={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("2 Samuel 23:9-11")).toBeInTheDocument();
    expect(screen.queryByText("9-11")).not.toBeInTheDocument();
  });

  it("keeps a static badge while editing a saved passage note without overlay wiring", () => {
    render(
      <TooltipProvider>
        <PassageNotesBubble
          notes={overlappingNotes}
          isOpen
          isGlowing={false}
          editingNoteIds={new Set([overlappingNotes[0].noteId])}
          onSaveEdit={vi.fn()}
          onCancelEdit={vi.fn()}
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onAddNote={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("2 Samuel 23:9-11")).toBeInTheDocument();
    expect(document.querySelector("[data-verse-range-chip]")).toBeNull();
    expect(document.querySelector("[data-verse-nudge]")).toBeNull();
  });

  it("shows the range overlay while editing a saved passage note", async () => {
    const user = userEvent.setup();
    const onRetargetVerse = vi.fn();
    const note = overlappingNotes[0];

    render(
      <TooltipProvider>
        <PassageNotesBubble
          notes={overlappingNotes}
          isOpen
          isGlowing={false}
          editingNoteIds={new Set([note.noteId])}
          onSaveEdit={vi.fn()}
          onCancelEdit={vi.fn()}
          onRetargetVerse={onRetargetVerse}
          savedEditOverrides={
            new Map([
              [note.noteId, { verseRef: note.verseRef, rangeDirty: false }],
            ])
          }
          onOpen={vi.fn()}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onAddNote={vi.fn()}
        />
      </TooltipProvider>,
    );

    const chip = document.querySelector("[data-verse-range-chip]");
    expect(chip).not.toBeNull();
    await user.hover(chip!);
    const grow = document.querySelector(
      '[data-verse-nudge="end:grow"]',
    ) as HTMLButtonElement;
    await user.click(grow);

    expect(onRetargetVerse).toHaveBeenCalledWith(
      note.noteId,
      { ...note.verseRef, endVerse: 12 },
      expect.objectContaining({
        body: "When people withdraw, the mighty are revealed.",
      }),
    );
  });
});
