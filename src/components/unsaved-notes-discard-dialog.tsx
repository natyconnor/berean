import { useEffect, useSyncExternalStore } from "react";
import { PassageViewDialogs } from "@/components/passage/passage-view-dialogs";
import {
  answerDiscardRequest,
  isDiscardRequestOpen,
  requestDiscardUnsavedNotes,
  subscribeToDiscardRequest,
} from "@/lib/unsaved-notes";

/**
 * The passage view's "Discard unsaved notes?" dialog, mounted once in the app
 * shell so a restart, refresh or quit can ask on any page (Settings, Search,
 * Memory), including for a note in another window.
 */
export function UnsavedNotesDiscardDialog() {
  const open = useSyncExternalStore(
    subscribeToDiscardRequest,
    isDiscardRequestOpen,
  );

  // The desktop shell asks here before it quits.
  useEffect(
    () => window.bereanDesktop?.onDiscardRequest?.(requestDiscardUnsavedNotes),
    [],
  );

  return (
    <PassageViewDialogs
      showDiscardConfirmation={open}
      cancelDiscard={() => answerDiscardRequest(false)}
      confirmDiscard={() => answerDiscardRequest(true)}
      dismissExempt
    />
  );
}
