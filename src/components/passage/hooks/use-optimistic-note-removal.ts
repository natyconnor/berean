import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import { PANEL_COLLAPSE_STAGGER_MS } from "../note-animation-config";

interface UseOptimisticNoteRemovalOptions {
  notes: NoteWithRef[];
  onDelete: (noteId: Id<"notes">) => Promise<void>;
  onLastNoteDeletedAfterExit?: (noteId: Id<"notes">) => void;
  onExitingLastChange?: (isExiting: boolean) => void;
}

interface UseOptimisticNoteRemovalResult {
  visibleNotes: NoteWithRef[];
  /** True while the last note in the group is playing its exit animation. */
  isExitingLast: boolean;
  requestRemove: (noteId: Id<"notes">) => void;
  /** Pass to AnimatePresence onExitComplete. */
  handleExitComplete: () => void;
  failedNoteId: Id<"notes"> | null;
  clearFailed: () => void;
}

/**
 * Manages optimistic note deletion with animated exit:
 * - Immediately hides the card (AnimatePresence exit triggers)
 * - Fires the Convex mutation in parallel
 * - On last-note exit, delays panel collapse for a staggered feel
 * - On failure, restores the note and sets failedNoteId for shake
 */
export function useOptimisticNoteRemoval({
  notes,
  onDelete,
  onLastNoteDeletedAfterExit,
  onExitingLastChange,
}: UseOptimisticNoteRemovalOptions): UseOptimisticNoteRemovalResult {
  const [pendingDeleteId, setPendingDeleteId] = useState<Id<"notes"> | null>(
    null,
  );
  const [failedNoteId, setFailedNoteId] = useState<Id<"notes"> | null>(null);

  const deletionPromiseRef = useRef<{
    noteId: Id<"notes">;
    promise: Promise<void>;
  } | null>(null);
  const wasLastNoteRef = useRef(false);

  const visibleNotes = useMemo(() => {
    if (!pendingDeleteId) return notes;
    return notes.filter((n) => n.noteId !== pendingDeleteId);
  }, [notes, pendingDeleteId]);

  const isExitingLast = pendingDeleteId !== null && visibleNotes.length === 0;

  const prevExitingLastRef = useRef(false);
  useLayoutEffect(() => {
    if (prevExitingLastRef.current !== isExitingLast) {
      prevExitingLastRef.current = isExitingLast;
      onExitingLastChange?.(isExitingLast);
    }
  }, [isExitingLast, onExitingLastChange]);

  const requestRemove = useCallback(
    (noteId: Id<"notes">) => {
      if (pendingDeleteId !== null) return;

      wasLastNoteRef.current = notes.length <= 1;
      setPendingDeleteId(noteId);
      setFailedNoteId(null);

      const promise = onDelete(noteId);
      deletionPromiseRef.current = { noteId, promise };

      promise.catch(() => {
        if (deletionPromiseRef.current?.noteId === noteId) {
          setPendingDeleteId(null);
          deletionPromiseRef.current = null;
          setTimeout(() => setFailedNoteId(noteId), 250);
        }
      });
    },
    [pendingDeleteId, notes.length, onDelete],
  );

  const handleExitComplete = useCallback(() => {
    const pending = deletionPromiseRef.current;
    if (!pending) return;

    const { noteId, promise } = pending;
    const wasLast = wasLastNoteRef.current;

    promise
      .then(() => {
        if (wasLast && onLastNoteDeletedAfterExit) {
          setTimeout(() => {
            onLastNoteDeletedAfterExit(noteId);
            setPendingDeleteId(null);
            deletionPromiseRef.current = null;
          }, PANEL_COLLAPSE_STAGGER_MS);
        } else {
          setPendingDeleteId(null);
          deletionPromiseRef.current = null;
        }
      })
      .catch(() => {
        // Failure already handled in requestRemove
      });
  }, [onLastNoteDeletedAfterExit]);

  const clearFailed = useCallback(() => setFailedNoteId(null), []);

  return {
    visibleNotes,
    isExitingLast,
    requestRemove,
    handleExitComplete,
    failedNoteId,
    clearFailed,
  };
}
