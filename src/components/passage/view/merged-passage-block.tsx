import { memo, useCallback, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { ChevronUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  splitTextByHighlights,
  type HighlightRange,
} from "@/lib/highlight-utils";
import { getHighlightColor } from "@/lib/highlight-colors";
import { PassageNotesBubble } from "../passage-notes-bubble";
import { VerseNotes } from "../verse-notes";
import { NoteEditor } from "@/components/notes/note-editor";
import { HighlightToolbar } from "../highlight-toolbar";
import { HighlightMarkPopover } from "../highlight-mark-popover";
import { useHighlightPopover } from "../hooks/use-highlight-popover";
import {
  VERSE_EXPAND_TRANSITION,
  LAYOUT_CORRECTION_TRANSITION,
  NOTE_ENTER_TRANSITION,
} from "../note-animation-config";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { NoteBody } from "@/lib/note-inline-content";
import type { VerseRef } from "@/lib/verse-ref-utils";
import type { NoteWithRef } from "@/components/notes/model/note-model";
import type { CurrentChapter } from "./verse-row-with-notes";

interface MergedPassageBlockProps {
  verses: Array<{ verseNumber: number; text: string }>;
  passageNotes: NoteWithRef[];
  singleNotesByVerse: Map<number, NoteWithRef[]>;
  viewMode: "compose" | "read";
  editorMode: "inline" | "dialog";
  currentChapter: CurrentChapter;
  highlightsByVerse: Map<number, HighlightRange[]>;
  onCreateHighlight?: (
    verse: number,
    startOffset: number,
    endOffset: number,
    color: string,
  ) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  onRecolorHighlight?: (highlightId: string, color: string) => void;
  isPassageOpen: boolean;
  openVerseKeys: Set<number>;
  editingNoteIds: Set<Id<"notes">>;
  draftsForAnchor: VerseRef[];
  onOpenPassageNotes: (verseNumber: number) => void;
  onClosePassageNotes: (verseNumber: number) => void;
  onOpenVerseNotes: (verseNumber: number) => void;
  onCloseVerseNotes: (verseNumber: number) => void;
  onEditNote: (
    noteId: Id<"notes">,
    verseRef: VerseRef,
    verseNumber: number,
    isPassage: boolean,
  ) => void;
  onDelete: (noteId: Id<"notes">) => Promise<void>;
  onSaveEdit: (
    noteId: Id<"notes">,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onSaveNew: (
    verseRef: VerseRef,
    body: NoteBody,
    tags: string[],
  ) => Promise<void>;
  onCancelEditor: (key: string) => void;
  onEditorDirtyChange: (key: string, isDirty: boolean) => void;
  onStartCreatingPassageNote: (verseRef: VerseRef) => void;
  onPassageBubbleMouseEnter: (verseNumber: number) => void;
  onPassageBubbleMouseLeave: () => void;
  onCollapse: () => void;
}

const EXPANDED_PADDING = {
  paddingTop: "1.25rem",
  paddingBottom: "1.25rem",
  paddingLeft: "1.25rem",
  paddingRight: "1.25rem",
} as const;

export const MergedPassageBlock = memo(function MergedPassageBlock({
  verses,
  passageNotes,
  singleNotesByVerse,
  viewMode,
  editorMode,
  currentChapter,
  highlightsByVerse,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
  isPassageOpen,
  openVerseKeys,
  editingNoteIds,
  draftsForAnchor,
  onOpenPassageNotes,
  onClosePassageNotes,
  onOpenVerseNotes,
  onCloseVerseNotes,
  onEditNote,
  onDelete,
  onSaveEdit,
  onSaveNew,
  onCancelEditor,
  onEditorDirtyChange,
  onStartCreatingPassageNote,
  onPassageBubbleMouseEnter,
  onPassageBubbleMouseLeave,
  onCollapse,
}: MergedPassageBlockProps) {
  const anchorVerse = verses[0]?.verseNumber ?? 0;
  const shouldShowInlineEditors = editorMode === "inline";
  const mergedTextRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; startY: number } | null>(null);
  const DRAG_THRESHOLD = 4;

  const allHighlights = verses.flatMap(
    (v) => highlightsByVerse.get(v.verseNumber) ?? [],
  );

  const {
    markPopover,
    activeHighlightId,
    handleMarkClick,
    handlePopoverClose,
    handlePopoverDelete,
    handlePopoverRecolor,
  } = useHighlightPopover({
    highlights: allHighlights,
    onDeleteHighlight,
    onRecolorHighlight,
  });

  const handleHighlightForVerse = useCallback(
    (verse: number, startOffset: number, endOffset: number, color: string) => {
      onCreateHighlight?.(verse, startOffset, endOffset, color);
    },
    [onCreateHighlight],
  );

  const handleTextMouseUp = useCallback(() => {
    // noop — HighlightToolbar handles selection via its own listeners
  }, []);

  const renderVerseHighlightedText = useCallback(
    (verseText: string, verseNumber: number) => {
      const highlights = highlightsByVerse.get(verseNumber);
      if (!highlights || highlights.length === 0) return verseText;

      const segments = splitTextByHighlights(verseText, highlights);
      return segments.map((seg, i) => {
        if (!seg.color) return <span key={i}>{seg.text}</span>;
        const colorDef = getHighlightColor(seg.color);
        const isActiveHighlight =
          seg.highlightId !== undefined &&
          seg.highlightId === activeHighlightId;
        return (
          <mark
            key={i}
            className={cn(
              "rounded-sm",
              colorDef?.bg ?? "bg-yellow-200/70",
              "cursor-pointer px-1 py-0.5 rounded transition-all duration-150 hover:brightness-[1.08] hover:saturate-[1.4] hover:shadow-sm",
              isActiveHighlight &&
                "brightness-[1.08] saturate-[1.4] shadow-sm",
            )}
            onPointerDown={(e) => {
              dragStateRef.current = { startX: e.clientX, startY: e.clientY };
            }}
            onPointerUp={
              seg.highlightId
                ? (e) => {
                    if (dragStateRef.current) {
                      const dx = e.clientX - dragStateRef.current.startX;
                      const dy = e.clientY - dragStateRef.current.startY;
                      if (Math.sqrt(dx * dx + dy * dy) <= DRAG_THRESHOLD) {
                        e.stopPropagation();
                        handleMarkClick(
                          seg.highlightId!,
                          e.currentTarget.getBoundingClientRect(),
                        );
                      }
                      dragStateRef.current = null;
                    }
                  }
                : undefined
            }
          >
            {seg.text}
          </mark>
        );
      });
    },
    [highlightsByVerse, activeHighlightId, handleMarkClick],
  );

  return (
    <LayoutGroup id={`merged-passage-${anchorVerse}`}>
      <div
        className="grid grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] gap-5 items-start"
        data-note-surface
      >
        {/* LEFT — merged verse text */}
        <motion.div
          layout="position"
          transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
          className="flex flex-col"
        >
          <motion.div
            animate={EXPANDED_PADDING}
            transition={VERSE_EXPAND_TRANSITION}
            className={cn(
              "rounded-lg cursor-text",
              "border border-amber-200/70 dark:border-amber-700/40",
              "bg-amber-50/40 dark:bg-amber-950/20",
              "ring-1 ring-amber-300/30 dark:ring-amber-600/20",
              "shadow-sm shadow-amber-100/60 dark:shadow-amber-950/30",
            )}
            onMouseUp={handleTextMouseUp}
          >
            <div className="flex items-start gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="group/collapse flex items-center shrink-0 select-none cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-amber-100/60 dark:hover:bg-amber-800/30 transition-colors mt-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCollapse();
                    }}
                  >
                    <ChevronUp className="h-4 w-4 text-amber-600/70 dark:text-amber-400/50 opacity-60 group-hover/collapse:opacity-100 transition-opacity" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Collapse</TooltipContent>
              </Tooltip>

              <div
                ref={mergedTextRef}
                style={{ fontSize: "1.5rem" }}
                className="leading-relaxed font-serif"
              >
                {verses.map((v) => (
                  <span key={v.verseNumber} data-verse={v.verseNumber}>
                    <sup className="text-base font-sans text-amber-600/70 dark:text-amber-400/50 mr-1 select-none">
                      {v.verseNumber}
                    </sup>
                    {renderVerseHighlightedText(v.text, v.verseNumber)}
                    {" "}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {onCreateHighlight && (
            <MergedHighlightToolbar
              mergedTextRef={mergedTextRef}
              verses={verses}
              onCreateHighlight={handleHighlightForVerse}
            />
          )}

          <AnimatePresence>
            {markPopover && (
              <HighlightMarkPopover
                key={markPopover.highlightId}
                anchorRect={markPopover.rect}
                highlightId={markPopover.highlightId}
                currentColor={markPopover.currentColor}
                onDelete={handlePopoverDelete}
                onRecolor={handlePopoverRecolor}
                onClose={handlePopoverClose}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* RIGHT — notes column */}
        <motion.div
          layout="position"
          transition={{ layout: LAYOUT_CORRECTION_TRANSITION }}
          className="py-1 select-none space-y-1.5"
          data-note-surface
        >
          {passageNotes.length > 0 && (
            <PassageNotesBubble
              notes={passageNotes}
              isOpen={isPassageOpen}
              isGlowing={false}
              viewMode={viewMode}
              currentChapter={currentChapter}
              editingNoteIds={shouldShowInlineEditors ? editingNoteIds : undefined}
              onSaveEdit={shouldShowInlineEditors ? onSaveEdit : undefined}
              onCancelEdit={
                shouldShowInlineEditors
                  ? (noteId) => onCancelEditor(`edit:${noteId}`)
                  : undefined
              }
              onEditorDirtyChange={
                shouldShowInlineEditors
                  ? (noteId, isDirty) =>
                      onEditorDirtyChange(`edit:${noteId}`, isDirty)
                  : undefined
              }
              onOpen={() => onOpenPassageNotes(anchorVerse)}
              onClose={() => onClosePassageNotes(anchorVerse)}
              onEdit={(noteId: Id<"notes">) => {
                const note = passageNotes.find((n) => n.noteId === noteId);
                if (note) onEditNote(noteId, note.verseRef, anchorVerse, true);
              }}
              onDelete={onDelete}
              onAddNote={() =>
                onStartCreatingPassageNote({
                  book: passageNotes[0].verseRef.book,
                  chapter: passageNotes[0].verseRef.chapter,
                  startVerse: passageNotes[0].verseRef.startVerse,
                  endVerse: passageNotes[0].verseRef.endVerse,
                })
              }
              onMouseEnter={() => onPassageBubbleMouseEnter(anchorVerse)}
              onMouseLeave={onPassageBubbleMouseLeave}
            />
          )}

          {Array.from(singleNotesByVerse.entries()).map(([verseNum, notes]) => (
            <div key={verseNum}>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                v{verseNum}
              </span>
              <VerseNotes
                notes={notes}
                isOpen={openVerseKeys.has(verseNum)}
                viewMode={viewMode}
                currentChapter={currentChapter}
                editingNoteIds={shouldShowInlineEditors ? editingNoteIds : undefined}
                onSaveEdit={shouldShowInlineEditors ? onSaveEdit : undefined}
                onCancelEdit={
                  shouldShowInlineEditors
                    ? (noteId) => onCancelEditor(`edit:${noteId}`)
                    : undefined
                }
                onEditorDirtyChange={
                  shouldShowInlineEditors
                    ? (noteId, isDirty) =>
                        onEditorDirtyChange(`edit:${noteId}`, isDirty)
                    : undefined
                }
                onOpen={() => onOpenVerseNotes(verseNum)}
                onClose={() => onCloseVerseNotes(verseNum)}
                onEdit={(noteId) => {
                  const note = notes.find((n) => n.noteId === noteId);
                  if (note) onEditNote(noteId, note.verseRef, verseNum, false);
                }}
                onDelete={onDelete}
                onAddNote={() => {
                  /* single-verse add not applicable in merged block */
                }}
              />
            </div>
          ))}

          <AnimatePresence initial={false}>
            {shouldShowInlineEditors &&
              draftsForAnchor.map((draft) => {
                const draftEditorKey = `new:${draft.startVerse}:${draft.endVerse}`;
                return (
                  <motion.div
                    key={draftEditorKey}
                    layout
                    data-note-surface
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={NOTE_ENTER_TRANSITION}
                  >
                    <NoteEditor
                      verseRef={draft}
                      variant={
                        draft.startVerse !== draft.endVerse
                          ? "passage"
                          : "default"
                      }
                      onSave={(body, tags) => onSaveNew(draft, body, tags)}
                      onCancel={() => onCancelEditor(draftEditorKey)}
                      onDirtyChange={(isDirty) =>
                        onEditorDirtyChange(draftEditorKey, isDirty)
                      }
                    />
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </motion.div>
      </div>
    </LayoutGroup>
  );
});

/**
 * Wrapper around HighlightToolbar that determines which verse a text selection
 * falls in by walking up to the nearest `[data-verse]` container.
 */
function MergedHighlightToolbar({
  mergedTextRef,
  verses,
  onCreateHighlight,
}: {
  mergedTextRef: React.RefObject<HTMLDivElement | null>;
  verses: Array<{ verseNumber: number; text: string }>;
  onCreateHighlight: (
    verse: number,
    startOffset: number,
    endOffset: number,
    color: string,
  ) => void;
}) {
  const handleHighlight = useCallback(
    (startOffset: number, endOffset: number, color: string) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const startNode = range.startContainer;

      const verseSpan = findVerseSpan(startNode);
      if (!verseSpan) return;

      const verseNumber = Number(verseSpan.getAttribute("data-verse"));
      if (!verseNumber) return;

      const verse = verses.find((v) => v.verseNumber === verseNumber);
      if (!verse) return;

      const preRange = document.createRange();
      preRange.selectNodeContents(verseSpan);
      preRange.setEnd(range.startContainer, range.startOffset);
      const rawStart = preRange.toString().length;

      const fullRange = document.createRange();
      fullRange.selectNodeContents(verseSpan);
      fullRange.setEnd(range.endContainer, range.endOffset);
      const rawEnd = fullRange.toString().length;

      const supLength = String(verseNumber).length;
      const adjustedStart = Math.max(0, rawStart - supLength);
      const adjustedEnd = Math.max(0, rawEnd - supLength);

      if (adjustedStart >= adjustedEnd) return;

      onCreateHighlight(verseNumber, adjustedStart, adjustedEnd, color);
    },
    [verses, onCreateHighlight],
  );

  return (
    <HighlightToolbar
      verseTextRef={mergedTextRef as React.RefObject<HTMLSpanElement | null>}
      onHighlight={handleHighlight}
    />
  );
}

function findVerseSpan(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.hasAttribute("data-verse")
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
