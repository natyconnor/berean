import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { VerseRef } from "@/lib/verse-ref-utils";
import { PassageGroupWithNotes } from "./passage-group-with-notes";

vi.mock("@/components/notes/note-editor", () => ({
  NoteEditor: ({
    onRetargetVerse,
  }: {
    onRetargetVerse?: (nextRef: VerseRef, snapshot: unknown) => void;
  }) => (
    <div
      data-testid="note-editor"
      data-has-retarget={onRetargetVerse ? "yes" : "no"}
    />
  ),
}));

const verseRef: VerseRef = {
  book: "John",
  chapter: 1,
  startVerse: 15,
  endVerse: 17,
};

function renderGroup(
  retargetingEditorKey: string | null,
  withCallback: boolean,
  inPlaceRetargetActive = true,
) {
  return render(
    <TooltipProvider>
      <PassageGroupWithNotes
        verses={[
          { verseNumber: 15, text: "John bore witness" },
          { verseNumber: 16, text: "And from his fullness" },
          { verseNumber: 17, text: "For the law" },
        ]}
        passageNotes={[]}
        singleNotesByVerse={new Map()}
        viewMode="compose"
        currentChapter={{ book: "John", chapter: 1 }}
        highlightsByVerse={new Map()}
        isPassageOpen={false}
        editingNoteIds={new Set()}
        draftsForAnchor={[
          {
            editorKey: "new:16:16",
            verseRef,
            snapshot: { body: "kept", tags: [] },
          },
        ]}
        retargetingEditorKey={retargetingEditorKey}
        inPlaceRetargetActive={inPlaceRetargetActive}
        onRetargetNewDraft={withCallback ? vi.fn() : undefined}
        onOpenPassageNotes={vi.fn()}
        onClosePassageNotes={vi.fn()}
        onOpenVerseNotes={vi.fn()}
        onEditNote={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onSaveEdit={vi.fn().mockResolvedValue(undefined)}
        onSaveNew={vi.fn().mockResolvedValue(undefined)}
        onCancelEditor={vi.fn()}
        onEditorDirtyChange={vi.fn()}
        onEditorFocus={vi.fn()}
        onStartCreatingPassageNote={vi.fn()}
        onNoteDeleteCleanup={vi.fn()}
        onPassageBubbleMouseEnter={vi.fn()}
        onPassageBubbleMouseLeave={vi.fn()}
        onCollapse={vi.fn()}
        groupPassageHeart={null}
      />
    </TooltipProvider>,
  );
}

describe("PassageGroupWithNotes retarget scope", () => {
  it("wires the overlay and composer layout id for the docked draft", () => {
    const { container } = renderGroup("new:16:16", true);

    expect(container.querySelector("[data-retarget-owner]")).toHaveAttribute(
      "data-retarget-owner",
      "true",
    );
    expect(container.querySelector("[data-draft-layout-id]")).toHaveAttribute(
      "data-draft-layout-id",
      "draft-new:16:16",
    );
    expect(screen.getByTestId("note-editor")).toHaveAttribute(
      "data-has-retarget",
      "yes",
    );
  });

  it("does not use retarget skip-enter on first grouping", () => {
    const { container } = renderGroup("new:16:16", true, false);

    expect(container.querySelector("[data-retarget-owner]")).toHaveAttribute(
      "data-retarget-owner",
      "false",
    );
    expect(screen.getByTestId("note-editor")).toHaveAttribute(
      "data-has-retarget",
      "yes",
    );
  });

  it("does not skip enter on a group that does not dock the nudged draft", () => {
    const { container } = render(
      <TooltipProvider>
        <PassageGroupWithNotes
          verses={[{ verseNumber: 3, text: "And God said" }]}
          passageNotes={[]}
          singleNotesByVerse={new Map()}
          viewMode="compose"
          currentChapter={{ book: "Genesis", chapter: 1 }}
          highlightsByVerse={new Map()}
          isPassageOpen
          editingNoteIds={new Set()}
          draftsForAnchor={[]}
          retargetingEditorKey="new:16:16"
          onOpenPassageNotes={vi.fn()}
          onClosePassageNotes={vi.fn()}
          onOpenVerseNotes={vi.fn()}
          onEditNote={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onSaveEdit={vi.fn().mockResolvedValue(undefined)}
          onSaveNew={vi.fn().mockResolvedValue(undefined)}
          onCancelEditor={vi.fn()}
          onEditorDirtyChange={vi.fn()}
          onEditorFocus={vi.fn()}
          onStartCreatingPassageNote={vi.fn()}
          onNoteDeleteCleanup={vi.fn()}
          onPassageBubbleMouseEnter={vi.fn()}
          onPassageBubbleMouseLeave={vi.fn()}
          onCollapse={vi.fn()}
          groupPassageHeart={null}
        />
      </TooltipProvider>,
    );

    expect(container.querySelector("[data-retarget-owner]")).toHaveAttribute(
      "data-retarget-owner",
      "false",
    );
    expect(screen.queryByTestId("note-editor")).toBeNull();
  });

  it("shows a collapsed saved note docked on a draft group without expanding it", () => {
    render(
      <TooltipProvider>
        <PassageGroupWithNotes
          verses={[
            { verseNumber: 4, text: "In him was life" },
            { verseNumber: 12, text: "But to all who did receive him" },
          ]}
          passageNotes={[
            {
              noteId: "john-12-15" as never,
              content: "Children of God",
              tags: [],
              verseRef: {
                book: "John",
                chapter: 1,
                startVerse: 12,
                endVerse: 15,
              },
              createdAt: 1,
            },
          ]}
          singleNotesByVerse={new Map()}
          viewMode="compose"
          currentChapter={{ book: "John", chapter: 1 }}
          highlightsByVerse={new Map()}
          isPassageOpen={false}
          editingNoteIds={new Set()}
          draftsForAnchor={[
            {
              editorKey: "new:4:4",
              verseRef: {
                book: "John",
                chapter: 1,
                startVerse: 4,
                endVerse: 12,
              },
            },
          ]}
          onOpenPassageNotes={vi.fn()}
          onClosePassageNotes={vi.fn()}
          onOpenVerseNotes={vi.fn()}
          onEditNote={vi.fn()}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onSaveEdit={vi.fn().mockResolvedValue(undefined)}
          onSaveNew={vi.fn().mockResolvedValue(undefined)}
          onCancelEditor={vi.fn()}
          onEditorDirtyChange={vi.fn()}
          onEditorFocus={vi.fn()}
          onStartCreatingPassageNote={vi.fn()}
          onNoteDeleteCleanup={vi.fn()}
          onPassageBubbleMouseEnter={vi.fn()}
          onPassageBubbleMouseLeave={vi.fn()}
          onCollapse={vi.fn()}
          groupPassageHeart={null}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("John 1:12-15")).toBeInTheDocument();
    expect(screen.queryByText("New note")).not.toBeInTheDocument();
  });
});
