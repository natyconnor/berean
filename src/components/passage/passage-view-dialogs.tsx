import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import { NoteEditor } from "@/components/notes/note-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PassageViewDialogsProps {
  shouldShowQuickCaptureDialog: boolean;
  hasDirtyEditors: boolean;
  handleClickAway: () => void;
  dialogEditingNote: NoteWithRef | null;
  dialogDraft: VerseRef | null;
  handleSaveEdit: (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  notifyEditorDirty: (key: string, isDirty: boolean) => void;
  handleSaveNew: (
    verseRef: VerseRef,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  showDiscardConfirmation: boolean;
  cancelDiscard: () => void;
  confirmDiscard: () => void;
}

export function PassageViewDialogs({
  shouldShowQuickCaptureDialog,
  hasDirtyEditors,
  handleClickAway,
  dialogEditingNote,
  dialogDraft,
  handleSaveEdit,
  notifyEditorDirty,
  handleSaveNew,
  showDiscardConfirmation,
  cancelDiscard,
  confirmDiscard,
}: PassageViewDialogsProps) {
  return (
    <>
      <Dialog
        open={shouldShowQuickCaptureDialog}
        onOpenChange={(open) => !open && !hasDirtyEditors && handleClickAway()}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogEditingNote ? "Edit note" : "Add note"}</DialogTitle>
          </DialogHeader>
          {dialogEditingNote ? (
            <NoteEditor
              verseRef={dialogEditingNote.verseRef}
              initialContent={dialogEditingNote.content}
              initialBody={dialogEditingNote.body}
              initialTags={dialogEditingNote.tags}
              presentation="dialog"
              variant={
                dialogEditingNote.verseRef.startVerse ===
                dialogEditingNote.verseRef.endVerse
                  ? "default"
                  : "passage"
              }
              onSave={(body, tags) =>
                handleSaveEdit(dialogEditingNote.noteId, body, tags)
              }
              onCancel={handleClickAway}
              onDirtyChange={(isDirty) =>
                notifyEditorDirty(`edit:${dialogEditingNote.noteId}`, isDirty)
              }
            />
          ) : dialogDraft ? (
            <NoteEditor
              verseRef={dialogDraft}
              presentation="dialog"
              variant={
                dialogDraft.startVerse === dialogDraft.endVerse
                  ? "default"
                  : "passage"
              }
              onSave={(body, tags) => handleSaveNew(dialogDraft, body, tags)}
              onCancel={handleClickAway}
              onDirtyChange={(isDirty) =>
                notifyEditorDirty(
                  `new:${dialogDraft.startVerse}:${dialogDraft.endVerse}`,
                  isDirty,
                )
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDiscardConfirmation}
        onOpenChange={(open) => {
          if (!open) cancelDiscard();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unsaved notes?</DialogTitle>
            <DialogDescription>
              You have unsaved content in one or more note editors. Are you sure
              you want to discard your changes?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDiscard}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={confirmDiscard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
