import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, X } from "lucide-react";
import { TagPicker } from "@/components/tags/tag-picker";
import { cn } from "@/lib/utils";
import { useStarterTagBadgeStyle } from "@/lib/tag-color-styles";
import { normalizeTags } from "@/lib/tag-utils";
import type { VerseRef } from "@/lib/verse-ref-utils";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import {
  normalizeNoteBody,
  noteBodyToPlainText,
  type NoteBody,
} from "@/lib/note-inline-content";
import { InlineVerseEditor } from "@/components/notes/editor/inline-verse-editor";
import { useNoteEditorTour } from "@/components/tutorial/use-note-editor-tour";
import {
  formatCommandOrControlShortcut,
  isApplePlatform,
} from "@/lib/keyboard-shortcuts";

const kbdShortcutChipClassName =
  "rounded border bg-muted px-1 py-0 text-[10px] font-medium leading-none text-muted-foreground";
import { api } from "../../../convex/_generated/api";

interface CurrentChapter {
  book: string;
  chapter: number;
}

interface NoteEditorProps {
  verseRef: VerseRef;
  initialContent?: string;
  initialBody?: NoteBody;
  initialTags?: string[];
  variant?: "default" | "passage";
  currentChapter?: CurrentChapter;
  onSave: (body: NoteBody, tags: string[]) => void | Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onFocusWithin?: () => void;
}

export function NoteEditor({
  verseRef,
  initialContent = "",
  initialBody,
  initialTags = [],
  variant = "default",
  currentChapter,
  onSave,
  onCancel,
  onDirtyChange,
  onFocusWithin,
}: NoteEditorProps) {
  const [initialEditorBody] = useState<NoteBody>(() =>
    normalizeNoteBody(initialBody, initialContent),
  );
  const [normalizedInitialTags] = useState(() => normalizeTags(initialTags));
  const [body, setBody] = useState<NoteBody>(initialEditorBody);
  const [tags, setTags] = useState<string[]>(() => normalizeTags(initialTags));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const catalog = useQuery(api.tags.listCatalog);
  const resolveTagStyle = useStarterTagBadgeStyle();
  const tour = useNoteEditorTour();

  const availableTags = useMemo(
    () => (catalog ?? []).map((entry) => entry.tag),
    [catalog],
  );

  const addTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleEditorChange = useCallback((nextBody: NoteBody) => {
    setBody(nextBody);
    setSaveError(null);
  }, []);

  const isNewNote = !initialContent && !initialBody;

  useEffect(() => {
    if (!onDirtyChange) return;
    if (isNewNote) {
      onDirtyChange(noteBodyToPlainText(body).trim().length > 0);
    } else {
      const bodyChanged =
        noteBodyToPlainText(body) !== noteBodyToPlainText(initialEditorBody);
      const tagsChanged =
        tags.length !== normalizedInitialTags.length ||
        tags.some((t, i) => t !== normalizedInitialTags[i]);
      onDirtyChange(bodyChanged || tagsChanged);
    }
  }, [
    body,
    tags,
    onDirtyChange,
    isNewNote,
    initialEditorBody,
    normalizedInitialTags,
  ]);

  const handleSave = useCallback(async () => {
    const content = noteBodyToPlainText(body).trim();
    if (!content || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(body, tags);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save note",
      );
    } finally {
      setIsSaving(false);
    }
  }, [body, isSaving, onSave, tags]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const content = noteBodyToPlainText(body).trim();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (content) {
          void handleSave();
        }
      }
    },
    [body, handleSave],
  );

  const isPassage = variant === "passage";
  const plainText = noteBodyToPlainText(body).trim();

  return (
    <div
      className={cn(
        "space-y-3",
        "rounded-lg p-2.5 shadow-none",
        isPassage
          ? "bg-amber-50/90 dark:bg-amber-900/22 cl-depth-3-amber cl-transition cl-editor-lift-amber cl-focus-bloom"
          : "bg-card cl-depth-3 cl-transition cl-editor-lift cl-focus-bloom",
      )}
      onKeyDown={handleKeyDown}
      onFocusCapture={onFocusWithin}
    >
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">
          {isPassage ? <BookOpen className="h-3 w-3 shrink-0" /> : null}
          {formatVerseRef(verseRef)}
        </Badge>
        <TooltipButton
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCancel}
          tooltip="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </TooltipButton>
      </div>

      <InlineVerseEditor
        initialBody={initialEditorBody}
        verseRef={verseRef}
        currentChapter={
          currentChapter ?? { book: verseRef.book, chapter: verseRef.chapter }
        }
        onChange={handleEditorChange}
        className="min-h-[96px]"
        editorChrome="candlelight"
        tourId={tour.bodyTourId}
        tutorialPreviewText={tour.tutorialPreviewText}
        tutorialAnimateText={tour.tutorialAnimateText}
        tutorialPreviewQuery={tour.tutorialPreviewQuery}
      />

      {saveError ? (
        <p className="text-xs text-destructive">{saveError}</p>
      ) : null}

      <div className="space-y-2">
        <TagPicker
          availableTags={availableTags}
          selectedTags={tags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          resolveTagStyle={resolveTagStyle}
          inputPlaceholder="Add tag (press Enter or comma)"
          allowCreate
          popoverDropdown
          selectedTagBadgeClassName={cn(
            "text-xs",
            isPassage && "border-amber-300 dark:border-amber-600/50",
          )}
          inputClassName={cn(
            "border-0 border-b rounded-none bg-transparent px-0 h-7",
            "border-border/50 focus:border-border/80",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground/50",
            isPassage && "border-amber-300/60 focus:border-amber-400/70",
          )}
          tourId={tour.tagsTourId}
          tutorialPreviewTags={tour.tutorialPreviewTags}
          tutorialAnimatePreview={tour.tutorialAnimateTagPreview}
          trailingSlot={
            <>
              <TooltipButton
                variant="ghost"
                size="sm"
                onClick={onCancel}
                tooltip="Cancel (Esc)"
              >
                Cancel
              </TooltipButton>
              <TooltipButton
                variant="default"
                size="sm"
                onClick={() => {
                  void handleSave();
                }}
                disabled={!plainText || isSaving}
                tooltip={
                  !plainText
                    ? "Enter content to save"
                    : isSaving
                      ? "Saving note..."
                      : `Save note (${formatCommandOrControlShortcut("Enter")})`
                }
              >
                {isSaving ? "Saving..." : "Save"}
              </TooltipButton>
            </>
          }
        />
      </div>

      <p className="flex flex-wrap items-center justify-end gap-1 text-xs text-muted-foreground">
        {isApplePlatform() ? (
          <>
            <kbd className={kbdShortcutChipClassName} aria-label="Command">
              ⌘
            </kbd>
            <kbd className={kbdShortcutChipClassName}>Enter</kbd>
          </>
        ) : (
          <>
            <kbd className={kbdShortcutChipClassName}>Ctrl</kbd>
            <span aria-hidden className="text-[10px] text-muted-foreground/80">
              +
            </span>
            <kbd className={kbdShortcutChipClassName}>Enter</kbd>
          </>
        )}
        <span>to save</span>
      </p>
    </div>
  );
}
