import type { ReactNode } from "react"
import type { Id } from "../../../../convex/_generated/dataModel"
import type { VerseRef } from "@/lib/verse-ref-utils"
import { motion, AnimatePresence } from "framer-motion"
import { ComposeActiveEditorSurface } from "./compose-layout-support"
import type { ComposeActiveTarget, FilteredVerse } from "./compose-layout-state"

interface ComposeLayoutDrawerProps {
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

export function ComposeLayoutDrawer({
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
}: ComposeLayoutDrawerProps) {
  return (
    <>
      <div className={activeTarget ? "pb-[360px]" : undefined}>
        {verses.map((verse) => renderRow(verse))}
      </div>

      <AnimatePresence>
        {activeTarget && (
          <motion.div
            key="compose-drawer"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur shadow-2xl"
          >
            <div className="mx-auto w-full max-w-5xl px-4 py-3 max-h-[56vh] overflow-y-auto">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
