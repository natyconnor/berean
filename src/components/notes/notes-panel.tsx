import { useState, useCallback, useMemo, useEffect } from "react"
import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipButton } from "@/components/ui/tooltip-button"
import { NoteBubble } from "./note-bubble"
import { NoteBubbleStack } from "./note-bubble-stack"
import { NoteEditor } from "./note-editor"
import { Plus } from "lucide-react"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { formatVerseRef, isPassageNote } from "@/lib/verse-ref-utils"
import {
  buildNotesByVerseRange,
  type ChapterNoteEntry,
} from "./model/note-model"

interface NotesPanelProps {
  book: string
  chapter: number
  creatingForRef?: VerseRef | null
  onNoteCreated?: () => void
  onCancelCreate?: () => void
}

export function NotesPanel({
  book,
  chapter,
  creatingForRef,
  onNoteCreated,
  onCancelCreate,
}: NotesPanelProps) {
  const chapterNotes = useQuery(api.noteVerseLinks.getNotesForChapter, {
    book,
    chapter,
  })
  const createNote = useMutation(api.notes.create)
  const updateNote = useMutation(api.notes.update)
  const removeNote = useMutation(api.notes.remove)
  const findOrCreateRef = useMutation(api.verseRefs.findOrCreate)
  const linkNote = useMutation(api.noteVerseLinks.link)

  const [editingNoteId, setEditingNoteId] = useState<Id<"notes"> | null>(null)
  const [expandedVerseKey, setExpandedVerseKey] = useState<string | null>(null)
  const [internalCreating, setInternalCreating] = useState<VerseRef | null>(null)

  const activeCreatingRef = creatingForRef ?? internalCreating

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional reset on prop change */
  useEffect(() => {
    if (creatingForRef) {
      setInternalCreating(null)
      setEditingNoteId(null)
    }
  }, [creatingForRef])
  /* eslint-enable react-hooks/set-state-in-effect */

  const notesByVerse = useMemo(
    () => buildNotesByVerseRange(chapterNotes as ChapterNoteEntry[] | undefined),
    [chapterNotes]
  )

  const sortedVerseKeys = useMemo(() => {
    return Array.from(notesByVerse.keys()).sort((a, b) => {
      const aStart = parseInt(a.split("-")[0])
      const bStart = parseInt(b.split("-")[0])
      return aStart - bStart
    })
  }, [notesByVerse])

  const handleSaveNew = useCallback(
    async (content: string, tags: string[]) => {
      const ref = activeCreatingRef
      if (!ref) return
      const noteId = await createNote({ content, tags })
      const verseRefId = await findOrCreateRef({
        book: ref.book,
        chapter: ref.chapter,
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
      })
      await linkNote({ noteId, verseRefId })
      setInternalCreating(null)
      onNoteCreated?.()
    },
    [activeCreatingRef, createNote, findOrCreateRef, linkNote, onNoteCreated]
  )

  const handleCancelCreate = useCallback(() => {
    setInternalCreating(null)
    onCancelCreate?.()
  }, [onCancelCreate])

  const handleSaveEdit = useCallback(
    async (noteId: Id<"notes">, content: string, tags: string[]) => {
      await updateNote({ id: noteId, content, tags })
      setEditingNoteId(null)
    },
    [updateNote]
  )

  const handleDelete = useCallback(
    async (noteId: Id<"notes">) => {
      await removeNote({ id: noteId })
    },
    [removeNote]
  )

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Notes
          </h2>
        </div>

        {activeCreatingRef && (
          <NoteEditor
            key={`create-${activeCreatingRef.startVerse}-${activeCreatingRef.endVerse}`}
            verseRef={activeCreatingRef}
            variant={isPassageNote(activeCreatingRef) ? "passage" : "default"}
            onSave={handleSaveNew}
            onCancel={handleCancelCreate}
          />
        )}

        {sortedVerseKeys.length === 0 && !activeCreatingRef && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No notes for this chapter yet.</p>
            <p className="text-xs mt-1">
              Click the + icon next to a verse to add one.
            </p>
          </div>
        )}

        {sortedVerseKeys.map((key) => {
          const notes = notesByVerse.get(key)!
          const isExpanded = expandedVerseKey === key
          const firstNote = notes[0]

          if (editingNoteId && notes.some((n) => n.noteId === editingNoteId)) {
            const editNote = notes.find((n) => n.noteId === editingNoteId)!
            return (
              <NoteEditor
                key={`edit-${editingNoteId}`}
                verseRef={editNote.verseRef}
                variant={isPassageNote(editNote.verseRef) ? "passage" : "default"}
                initialContent={editNote.content}
                initialTags={editNote.tags}
                onSave={(content, tags) =>
                  handleSaveEdit(editingNoteId, content, tags)
                }
                onCancel={() => setEditingNoteId(null)}
              />
            )
          }

          if (!isExpanded && notes.length > 1) {
            return (
              <NoteBubbleStack
                key={key}
                count={notes.length}
                firstNotePreview={
                  firstNote.content.slice(0, 80) +
                  (firstNote.content.length > 80 ? "..." : "")
                }
                verseLabel={formatVerseRef(firstNote.verseRef)}
                onClick={() => setExpandedVerseKey(key)}
              />
            )
          }

          return (
            <div key={key} className="space-y-2">
              {isExpanded && notes.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {notes.length} notes for{" "}
                    {formatVerseRef(firstNote.verseRef)}
                  </span>
                  <TooltipButton
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={() => setInternalCreating(firstNote.verseRef)}
                    tooltip="Add new note"
                  >
                    <Plus className="h-3 w-3" />
                    New note
                  </TooltipButton>
                </div>
              )}
              {(isExpanded ? notes : [notes[0]]).map((note) => (
                <NoteBubble
                  key={note.noteId}
                  noteId={note.noteId}
                  content={note.content}
                  tags={note.tags}
                  verseRef={note.verseRef}
                  isExpanded={isExpanded || notes.length === 1}
                  onExpand={() => setExpandedVerseKey(key)}
                  onEdit={() => setEditingNoteId(note.noteId)}
                  onDelete={() => handleDelete(note.noteId)}
                />
              ))}
              {isExpanded && (
                <TooltipButton
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setExpandedVerseKey(null)}
                  tooltip="Collapse notes"
                >
                  Collapse
                </TooltipButton>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
