import type { ReactNode } from "react"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { ComposeActiveEditorSurface } from "./compose-layout-support"
import type { ComposeActiveTarget, FilteredVerse } from "./compose-layout-state"

interface ComposeLayoutRailProps {
  verses: FilteredVerse[]
  renderRow: (verse: FilteredVerse) => ReactNode
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

export function ComposeLayoutRail({
  verses,
  renderRow,
  activeTarget,
  onCreateForRef,
  onEditNote,
  onDeleteNote,
  onSaveEdit,
  onSaveNew,
  onCancelEditing,
  onCloseSurface,
}: ComposeLayoutRailProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-6 items-start">
      <div>{verses.map((verse) => renderRow(verse))}</div>
      <aside className="sticky top-4">
        <ComposeActiveEditorSurface
          activeTarget={activeTarget}
          onCreateForRef={onCreateForRef}
          onEditNote={onEditNote}
          onDeleteNote={onDeleteNote}
          onSaveEdit={onSaveEdit}
          onSaveNew={onSaveNew}
          onCancelEditing={onCancelEditing}
          onCloseSurface={onCloseSurface}
        />
      </aside>
    </div>
  )
}
