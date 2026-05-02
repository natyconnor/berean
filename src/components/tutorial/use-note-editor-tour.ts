import { useOptionalTutorial } from "./tutorial-context";

export interface NoteEditorTourState {
  bodyTourId: string | undefined;
  tagsTourId: string | undefined;
  tutorialPreviewText: string | undefined;
  tutorialAnimateText: boolean;
  tutorialPreviewTags: string[];
  tutorialPreviewQuery: string | undefined;
  tutorialAnimateTagPreview: boolean;
}

/**
 * The trimmed first-run tour only spotlights the note body. Inline verse
 * links and tags are now taught contextually via staged onboarding hints
 * (see Wave 1 verse links and Wave 2 starter tags), so this hook no longer
 * surfaces preview tags/queries from the main tour.
 */
export function useNoteEditorTour(): NoteEditorTourState {
  const tutorial = useOptionalTutorial();

  const isNoteBody = tutorial?.isStepActive("main", "note-body") ?? false;

  return {
    bodyTourId: isNoteBody ? "note-editor-body" : undefined,
    tagsTourId: undefined,
    tutorialPreviewText: isNoteBody
      ? "The original Greek is Logos, literally meaning 'word' but also carrying with it cosmic meaning, ringing in echoes of..."
      : undefined,
    tutorialAnimateText: isNoteBody,
    tutorialPreviewTags: [],
    tutorialPreviewQuery: undefined,
    tutorialAnimateTagPreview: false,
  };
}
