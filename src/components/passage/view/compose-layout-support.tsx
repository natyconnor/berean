import type { Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { NoteEditor } from "@/components/notes/note-editor"
import {
  NoteCardActions,
  NoteTagList,
  NoteContent,
} from "@/components/notes/view/note-card-primitives"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { formatVerseRef, isPassageNote } from "@/lib/verse-ref-utils"
import type { ComposeActiveTarget } from "./compose-layout-state"

interface ComposeActiveEditorSurfaceProps {
  activeTarget: ComposeActiveTarget | null
  onCreateForRef: (verseRef: VerseRef) => void
  onEditNote: (
    noteId: Id<"notes">,
    verseNumber: number,
    isPassage: boolean
  ) => void
  onDeleteNote: (noteId: Id<"notes">) => Promise<void>
  onSaveEdit: (content: string, tags: string[]) => Promise<void>
  onSaveNew: (content: string, tags: string[]) => Promise<void>
  onCancelEditing: () => void
  onCloseSurface: () => void
}

function sourceLabel(source: ComposeActiveTarget["source"]): string {
  switch (source) {
    case "editing":
      return "Editing"
    case "creating":
      return "Composing"
    case "open-passage":
      return "Passage notes"
    case "open-verse":
      return "Verse notes"
    default:
      return "Notes"
  }
}

export function ComposeActiveEditorSurface({
  activeTarget,
  onCreateForRef,
  onEditNote,
  onDeleteNote,
  onSaveEdit,
  onSaveNew,
  onCancelEditing,
  onCloseSurface,
}: ComposeActiveEditorSurfaceProps) {
  if (!activeTarget) {
    return (
      <div className="rounded-xl border bg-card/60 p-4 text-sm text-muted-foreground">
        Select a verse, passage note, or note bubble to compose.
      </div>
    )
  }

  const isEditing = activeTarget.source === "editing" && !!activeTarget.editingNote
  const isCreating = activeTarget.source === "creating"
  const isPassage = isPassageNote(activeTarget.verseRef)

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {sourceLabel(activeTarget.source)}
          </p>
          <p className="text-sm font-semibold truncate">
            {formatVerseRef(activeTarget.verseRef)}
          </p>
        </div>
        <Button size="xs" variant="ghost" onClick={onCloseSurface}>
          Close
        </Button>
      </div>

      {isEditing && activeTarget.editingNote ? (
        <NoteEditor
          verseRef={activeTarget.editingNote.verseRef}
          initialContent={activeTarget.editingNote.content}
          initialTags={activeTarget.editingNote.tags}
          variant={isPassage ? "passage" : "default"}
          onSave={onSaveEdit}
          onCancel={onCancelEditing}
        />
      ) : isCreating ? (
        <NoteEditor
          verseRef={activeTarget.verseRef}
          variant={isPassage ? "passage" : "default"}
          onSave={onSaveNew}
          onCancel={onCloseSurface}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {activeTarget.relatedNotes.length}{" "}
              {activeTarget.relatedNotes.length === 1 ? "note" : "notes"}
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => onCreateForRef(activeTarget.verseRef)}
            >
              New note
            </Button>
          </div>

          {activeTarget.relatedNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notes yet for this target.
            </p>
          ) : (
            activeTarget.relatedNotes.map((note) => {
              const noteIsPassage = isPassageNote(note.verseRef)
              return (
                <div
                  key={note.noteId}
                  className="rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <NoteContent
                      content={note.content}
                      truncateAt={180}
                      className="flex-1 text-muted-foreground"
                    />
                    <NoteCardActions
                      variant={noteIsPassage ? "passage" : "default"}
                      onEdit={() =>
                        onEditNote(
                          note.noteId,
                          note.verseRef.startVerse,
                          noteIsPassage
                        )
                      }
                      onDelete={() => void onDeleteNote(note.noteId)}
                    />
                  </div>
                  <NoteTagList
                    tags={note.tags}
                    variant={noteIsPassage ? "passage" : "default"}
                    className="mt-2"
                  />
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
