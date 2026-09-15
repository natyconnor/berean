import { useState } from "react";
import type { LabChapterNote } from "./lab-types";
import { createLabNoteId } from "./lab-types";

export function useChapterNotesState(
  seed: LabChapterNote[],
  options?: { initialExpanded?: boolean },
) {
  const [notes, setNotes] = useState<LabChapterNote[]>(seed);
  const [expanded, setExpanded] = useState(
    options?.initialExpanded ?? seed.length > 0,
  );
  const [drafting, setDrafting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function startDraft() {
    setExpanded(true);
    setDrafting(true);
    setEditingId(null);
  }

  function cancelDraft() {
    setDrafting(false);
  }

  function saveDraft(content: string, tags: string[]) {
    setNotes((prev) => [{ id: createLabNoteId(), content, tags }, ...prev]);
    setDrafting(false);
    setExpanded(true);
  }

  function startEdit(id: string) {
    setEditingId(id);
    setDrafting(false);
    setExpanded(true);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(id: string, content: string, tags: string[]) {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, content, tags } : note)),
    );
    setEditingId(null);
  }

  function deleteNote(id: string) {
    setNotes((prev) => {
      const next = prev.filter((note) => note.id !== id);
      if (next.length === 0) setExpanded(false);
      return next;
    });
    if (editingId === id) setEditingId(null);
  }

  function toggleExpanded() {
    if (drafting) setDrafting(false);
    if (editingId) setEditingId(null);
    setExpanded((value) => !value);
  }

  return {
    notes,
    expanded,
    drafting,
    editingId,
    startDraft,
    cancelDraft,
    saveDraft,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteNote,
    toggleExpanded,
    setExpanded,
  };
}
