import type { Transition } from "framer-motion";
import {
  CROSSFADE_TRANSITION,
  NOTE_ENTER_TRANSITION,
  RETARGET_LAYOUT_TRANSITION,
  retargetLayoutTransition,
} from "./note-animation-config";

export interface OpenDraftSpan {
  startVerse: number;
  endVerse: number;
}

export function draftSpanLayoutId(editorKey: string): string {
  return `draft-span-${editorKey}`;
}

export function draftComposerLayoutId(editorKey: string): string {
  return `draft-${editorKey}`;
}

export function draftDockLayoutGroupId(editorKey: string): string {
  return `draft-dock-${editorKey}`;
}

/** Stable AnimatePresence key so 16–17 → 15–17 keeps the same group mounted. */
export function draftGroupPresenceKey(
  anchorVerse: number,
  drafts: ReadonlyArray<{ editorKey: string }>,
): string {
  const draft = drafts[0];
  if (draft) return draftSpanLayoutId(draft.editorKey);
  return `passage-group-${anchorVerse}`;
}

export function isMultiVerseSpan(span: OpenDraftSpan): boolean {
  return span.startVerse !== span.endVerse;
}

/**
 * Neighbor collapse + sync presence is only for an already-open passage group
 * changing range in place. First 1→2 grouping, drag-select grouping, shrink to
 * a single verse, and dismiss use main's popLayout enter/exit.
 */
export function isInPlaceGroupRetarget(
  previous: OpenDraftSpan,
  next: OpenDraftSpan,
): boolean {
  return isMultiVerseSpan(previous) && isMultiVerseSpan(next);
}

export function verseListPresenceMode(
  inPlaceRetarget: boolean,
): "sync" | "popLayout" {
  return inPlaceRetarget ? "sync" : "popLayout";
}

export function groupOwnsRetargetingDraft(
  drafts: ReadonlyArray<{ editorKey: string }>,
  retargetingEditorKey: string | null,
): boolean {
  if (retargetingEditorKey === null) return false;
  return drafts.some((draft) => draft.editorKey === retargetingEditorKey);
}

export function groupUsesRetargetMotion(
  drafts: ReadonlyArray<{ editorKey: string }>,
  retargetingEditorKey: string | null,
  inPlaceRetarget: boolean,
): boolean {
  return (
    inPlaceRetarget && groupOwnsRetargetingDraft(drafts, retargetingEditorKey)
  );
}

/** Verses immediately outside an open draft, the ones a nudge absorbs or releases. */
export function verseInOpenDraftNeighborhood(
  verseNumber: number,
  drafts: ReadonlyArray<OpenDraftSpan>,
): boolean {
  return drafts.some(
    (draft) =>
      verseNumber === draft.startVerse - 1 ||
      verseNumber === draft.endVerse + 1,
  );
}

export type SingleVersePresenceKind =
  "draft-host" | "reenter" | "retarget-neighbor" | "default";

export function singleVersePresenceKind(input: {
  hostsOpenDraft: boolean;
  reenteringFromGroup: boolean;
  verseNumber: number;
  openDrafts: ReadonlyArray<OpenDraftSpan>;
  inPlaceRetarget: boolean;
}): SingleVersePresenceKind {
  if (input.hostsOpenDraft && input.inPlaceRetarget) return "draft-host";
  if (input.reenteringFromGroup) return "reenter";
  if (
    input.inPlaceRetarget &&
    verseInOpenDraftNeighborhood(input.verseNumber, input.openDrafts)
  ) {
    return "retarget-neighbor";
  }
  return "default";
}

type PresenceMotion = {
  initial:
    false | { opacity: number; height?: number | string; overflow?: string };
  animate: {
    opacity: number;
    height?: number | string;
    transitionEnd?: { overflow: string };
  };
  exit: { opacity: number; height?: number | string; overflow?: string };
  transition: Transition;
  layout?: boolean;
};

export function singleVersePresenceMotion(
  kind: SingleVersePresenceKind,
  reduceMotion: boolean,
): PresenceMotion {
  if (kind === "draft-host") {
    return {
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: reduceMotion ? 1 : 0 },
      transition: retargetLayoutTransition(reduceMotion),
      layout: true,
    };
  }

  if (kind === "reenter") {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: CROSSFADE_TRANSITION,
    };
  }

  if (kind === "retarget-neighbor") {
    const hiddenOpacity = reduceMotion ? 1 : 0;
    return {
      initial: { height: 0, opacity: hiddenOpacity, overflow: "hidden" },
      animate: {
        height: "auto",
        opacity: 1,
        transitionEnd: { overflow: "visible" },
      },
      exit: { height: 0, opacity: hiddenOpacity, overflow: "hidden" },
      transition: retargetLayoutTransition(reduceMotion),
    };
  }

  return {
    initial: { height: 0, opacity: 0, overflow: "hidden" },
    animate: {
      height: "auto",
      opacity: 1,
      transitionEnd: { overflow: "visible" },
    },
    exit: { opacity: 0 },
    transition: NOTE_ENTER_TRANSITION,
  };
}

export function groupListPresenceMotion(
  ownsRetarget: boolean,
  reduceMotion: boolean,
): PresenceMotion {
  if (!ownsRetarget) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: CROSSFADE_TRANSITION,
    };
  }

  return {
    initial: false,
    animate: { opacity: 1 },
    exit: { opacity: reduceMotion ? 1 : 0 },
    transition: retargetLayoutTransition(reduceMotion),
    layout: true,
  };
}

export function draftComposerMotionProps(
  isNudgeRemount: boolean,
  reduceMotion: boolean,
): PresenceMotion {
  if (isNudgeRemount) {
    return {
      initial: false,
      animate: { opacity: 1, height: "auto" },
      exit: { opacity: 0, height: 0 },
      transition: retargetLayoutTransition(reduceMotion),
      layout: true,
    };
  }

  return {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0 },
    transition: NOTE_ENTER_TRANSITION,
  };
}

export function listItemTransition(
  presenceTransition: Transition,
  inPlaceRetarget: boolean,
  reduceMotion: boolean,
): Transition {
  if (!inPlaceRetarget || typeof presenceTransition !== "object") {
    return presenceTransition;
  }
  return {
    ...presenceTransition,
    layout: retargetLayoutTransition(reduceMotion),
  };
}

export { RETARGET_LAYOUT_TRANSITION };
