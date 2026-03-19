import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
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
  presentation?: "card" | "dialog";
  currentChapter?: CurrentChapter;
  onSave: (body: NoteBody, tags: string[]) => void | Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function NoteEditor({
  verseRef,
  initialContent = "",
  initialBody,
  initialTags = [],
  variant = "default",
  presentation = "card",
  currentChapter,
  onSave,
  onCancel,
  onDirtyChange,
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
  }, [body, tags, onDirtyChange, isNewNote, initialEditorBody, normalizedInitialTags]);

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
  const isDialogPresentation = presentation === "dialog";
  const plainText = noteBodyToPlainText(body).trim();
  const showEditorHeaderRow = !isPassage || !isDialogPresentation;

  return (
    <div
      className={cn(
        "space-y-3",
        isDialogPresentation
          ? "px-1 pb-1"
          : cn(
              "rounded-lg p-2.5 shadow-sm",
              isPassage
                ? "border-l-2 border border-amber-200 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/50 border-l-amber-400 dark:border-l-amber-600/70"
                : "border bg-card",
            ),
      )}
      onKeyDown={handleKeyDown}
    >
      {showEditorHeaderRow ? (
        <div
          className={cn(
            "flex items-center",
            isPassage ? "justify-end" : "justify-between",
          )}
        >
          {!isPassage ? (
            <Badge variant="secondary" className="text-xs">
              {formatVerseRef(verseRef)}
            </Badge>
          ) : null}
          {!isDialogPresentation ? (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onCancel}
              tooltip="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </TooltipButton>
          ) : null}
        </div>
      ) : null}

      <InlineVerseEditor
        initialBody={initialEditorBody}
        verseRef={verseRef}
        currentChapter={
          currentChapter ?? { book: verseRef.book, chapter: verseRef.chapter }
        }
        onChange={handleEditorChange}
        className={cn(isDialogPresentation ? "min-h-[180px]" : "min-h-[96px]")}
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
          tourId={tour.tagsTourId}
          tutorialPreviewTags={tour.tutorialPreviewTags}
          tutorialAnimatePreview={tour.tutorialAnimateTagPreview}
        />
      </div>

      <div className="flex justify-end gap-2">
        {!isDialogPresentation && (
          <TooltipButton
            variant="ghost"
            size="sm"
            onClick={onCancel}
            tooltip="Cancel (Esc)"
          >
            Cancel
          </TooltipButton>
        )}
        <TooltipButton
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
                : "Save note (⌘Enter)"
          }
        >
          {isSaving ? "Saving..." : "Save"}
        </TooltipButton>
      </div>

      <p className="text-xs text-muted-foreground">
        {/(Mac|iPhone|iPad)/i.test(navigator.userAgent) ? "Cmd" : "Ctrl"}+Enter
        to save
      </p>
    </div>
  );
}
