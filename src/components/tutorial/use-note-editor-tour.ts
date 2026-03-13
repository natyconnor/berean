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

export function useNoteEditorTour(): NoteEditorTourState {
  const tutorial = useOptionalTutorial();

  const isInlineLinks = tutorial?.isStepActive("main", "inline-links") ?? false;
  const isNoteBody = tutorial?.isStepActive("main", "note-body") ?? false;
  const isNoteTags = tutorial?.isStepActive("main", "note-tags") ?? false;

  const bodyTourId = isInlineLinks
    ? "note-editor-link-demo"
    : isNoteBody
      ? "note-editor-body"
      : undefined;

  const tutorialPreviewText =
    "The original Greek is Logos, literally meaning 'word' but also carrying with it cosmic meaning, ringing in echoes of...";
  return {
    bodyTourId,
    tagsTourId: isNoteTags ? "note-editor-tags" : undefined,
    tutorialPreviewText,
    tutorialAnimateText: isNoteBody,
    tutorialPreviewTags: isNoteTags || isInlineLinks ? ["greek"] : [],
    tutorialPreviewQuery: isInlineLinks ? "Genesis 1:1" : undefined,
    tutorialAnimateTagPreview: isNoteTags,
  };
}
