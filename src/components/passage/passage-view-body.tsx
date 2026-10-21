import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  passageHoverSpanForNotes,
  type NoteWithRef,
} from "@/components/notes/model/note-model";
import type { HighlightRange } from "@/lib/highlight-utils";
import type { EsvVerseHeading } from "../../../shared/esv-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChapterPager } from "@/components/bible/chapter-pager";
import { CopyrightNotice } from "@/components/bible/copyright-notice";
import {
  VerseRowWithNotes,
  type SavedPassageAtAnchor,
} from "./view/verse-row-with-notes";
import { PassageGroupWithNotes } from "./view/passage-group-with-notes";
import { SectionHeading } from "./section-heading";
import { ChapterNotesChrome } from "./chapter-notes-chrome";
import {
  draftGroupPresenceKey,
  draftSpanLayoutId,
  groupListPresenceMotion,
  groupUsesRetargetMotion,
  listItemTransition,
  singleVersePresenceKind,
  singleVersePresenceMotion,
  verseListPresenceMode,
  type OpenDraftSpan,
} from "./draft-retarget-presence";
import type { PassageNotesInteraction } from "./hooks/use-passage-notes-interaction";
import {
  FOCUS_MODE_SPOTLIGHT_VERSE_END,
  FOCUS_MODE_SPOTLIGHT_VERSE_START,
} from "@/components/tutorial/focus-mode-tour";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import { hasExactSavedSpan } from "@/lib/saved-verse-utils";
import { masteryRingFraction } from "@/lib/mastery-ring";
import { formatSpanTitle } from "@/lib/memorize-target";
import type { MemoryStatus } from "@/lib/memory-scheduler";
import type { PassageHeartInfo } from "@/lib/passage-heart-info";
import { passageRailSegments } from "@/lib/passage-rail";
import {
  passageHeartCopy,
  verseHeartMemoryCopy,
} from "@/lib/heart-memory-copy";
import type { PassageHeartControl } from "./verse-row";
import type { GroupSelectionBar } from "./view/passage-group-with-notes";
import { HeartMemorizeNudge } from "./heart-memorize-nudge";
import {
  isSpanMemorizing,
  useHeartMemorizeNudge,
} from "./hooks/use-heart-memorize-nudge";
import {
  PassageRailPastHeadings,
  type PassageRailMark,
} from "./passage-heart-rail";
import { useDragAutoScroll } from "@/hooks/use-drag-auto-scroll";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  logPassagePresence,
  passagePresenceDebugEnabled,
} from "@/lib/dev-passage-presence-logger";

type SavedSpan = {
  startVerse: number;
  endVerse: number;
  memory?: {
    status: MemoryStatus;
    learnStage: number;
    stageReps?: number;
    ease?: number;
    intervalDays: number;
    dueAt: number;
    lastReviewedAt?: number;
    inMemory: boolean;
  };
  stopsMemorizing?: boolean;
  passageMemoryId?: string;
  passage?: PassageHeartInfo;
};

/** A verse on a memorized passage's rail in this chapter. */
type RailEntry = {
  mark: PassageRailMark;
  /** The verse above is on the rail too, so the rail runs past a heading here. */
  joinsAbove: boolean;
};

const EMPTY_FOCUS_MAP = new Map<string, number | null>();

type PassageViewMode = "compose" | "read";

type VerseItem =
  | {
      kind: "single";
      verseNumber: number;
      text: string;
      heading?: string;
      subheading?: string;
      midHeadings?: EsvVerseHeading[];
      singleNotes: NoteWithRef[];
      passageNotes: NoteWithRef[];
    }
  | {
      kind: "passageGroup";
      anchorVerse: number;
      heading?: string;
      subheading?: string;
      verses: Array<{
        verseNumber: number;
        text: string;
        midHeadings?: EsvVerseHeading[];
      }>;
      passageNotes: NoteWithRef[];
      singleNotesByVerse: Map<number, NoteWithRef[]>;
    };

interface PassageViewBodyProps {
  book: string;
  chapter: number;
  dataCopyright: string;
  passageKey: string;
  containerClass: string;
  topGridClass: string;
  /** Compose/read column template shared with verse rows and chapter overlay. */
  passageGridClass: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  filteredVerses: VerseItem[];
  showSectionHeaders: boolean;
  passageNotesInteraction: PassageNotesInteraction;
  effectiveViewMode: PassageViewMode;
  isFocusMode: boolean;
  focusGlowAmount: number;
  hasFocusRange: boolean;
  focusRange: { startVerse: number; endVerse: number } | null;
  reenteringFromGroup: Set<number>;
  highlightsByVerse: Map<number, HighlightRange[]>;
  forceAddButtonVisible: boolean;
  onCreateHighlight: (
    verse: number,
    startOffset: number,
    endOffset: number,
    color: string,
  ) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onRecolorHighlight: (highlightId: string, color: string) => void;
  savedVersesForChapter: SavedSpan[] | undefined;
  onToggleSaved: (startVerse: number, endVerse: number) => void;
  /** A tour is running: no selection bar and no heart nudge. */
  tourActive: boolean;
}

export function PassageViewBody({
  book,
  chapter,
  dataCopyright,
  passageKey,
  containerClass,
  topGridClass,
  passageGridClass,
  viewportRef,
  filteredVerses,
  showSectionHeaders,
  passageNotesInteraction,
  effectiveViewMode,
  isFocusMode,
  focusGlowAmount,
  hasFocusRange,
  focusRange,
  reenteringFromGroup,
  highlightsByVerse,
  forceAddButtonVisible,
  onCreateHighlight,
  onDeleteHighlight,
  onRecolorHighlight,
  savedVersesForChapter,
  onToggleSaved,
  tourActive,
}: PassageViewBodyProps) {
  const {
    containerRef,
    selectedVerses,
    passageDraftVerses,
    isDragging,
    isInSelection,
    isPassageSelection,
    verseToPassageAnchor,
    passageNotesByAnchor,
    hoveredPassageBubble,
    hoveredSingleBubble,
    openVerseKeys,
    openPassageKeys,
    currentFocusTarget,
    newDraftsByAnchor,
    editComposersByAnchor,
    savedEditOverrides,
    retargetingEditorKey,
    inPlaceRetargetActive,
    retargetNewDraft,
    retargetEditNote,
    editingNoteIds,
    handleAddNote,
    handleVerseMouseDown,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseUp,
    handleSingleBubbleMouseEnter,
    handleSingleBubbleMouseLeave,
    handlePassageBubbleMouseEnter,
    handlePassageBubbleMouseLeave,
    openVerseNotes,
    closeVerseNotes,
    openPassageNotes,
    closePassageNotes,
    startEditingNote,
    handleDelete,
    handleNoteDeleteCleanup,
    handleSaveEdit,
    handleSaveNew,
    cancelEditor,
    notifyEditorDirty,
    handleEditorFocus,
    startCreatingPassageNote,
    chapterNotesPanel,
    requestClearSelection,
  } = passageNotesInteraction;

  useDragAutoScroll({
    viewportRef,
    isActive: isDragging,
    onPointerOverVerse: handleMouseEnter,
  });

  const savedSpans = useMemo(
    () => savedVersesForChapter ?? [],
    [savedVersesForChapter],
  );

  const now = useLiveNow();

  // Ring and memorizing copy for the exact (lo, hi) span, if it's hearted and
  // in Memory. Read from the same per-chapter saved-verses query (no extra
  // per-verse fetch), so the ring adds zero query round-trips.
  const spanHeartMemory = useCallback(
    (
      startVerse: number,
      endVerse: number,
    ): Pick<PassageHeartControl, "masteryFraction" | "memoryCopy"> => {
      const memory = savedSpans.find(
        (s) => s.startVerse === startVerse && s.endVerse === endVerse,
      )?.memory;
      if (!memory?.inMemory) return { masteryFraction: 0 };
      return {
        masteryFraction: masteryRingFraction(
          memory.status,
          memory.intervalDays,
          memory.learnStage,
          memory.stageReps ?? 0,
          memory.ease,
        ),
        memoryCopy: verseHeartMemoryCopy(memory, now),
      };
    },
    [now, savedSpans],
  );

  const heartNudge = useHeartMemorizeNudge({
    suppressed: isFocusMode || tourActive,
  });
  const { heartClicked, heartedClicked } = heartNudge;

  const spanTitle = useCallback(
    (startVerse: number, endVerse: number) =>
      formatSpanTitle({ book, chapter, startVerse, endVerse }),
    [book, chapter],
  );

  const stopsMemorizingSpan = useCallback(
    (startVerse: number, endVerse: number) =>
      savedSpans.some(
        (s) =>
          s.startVerse === startVerse &&
          s.endVerse === endVerse &&
          s.stopsMemorizing === true,
      ),
    [savedSpans],
  );

  const toggleHeart = useCallback(
    (startVerse: number, endVerse: number, anchor: HTMLElement) => {
      heartClicked({ book, chapter, startVerse, endVerse }, anchor, savedSpans);
      onToggleSaved(startVerse, endVerse);
    },
    [book, chapter, heartClicked, onToggleSaved, savedSpans],
  );

  // A heart already on offers Memorize or Unheart when clicked, unless
  // unhearting stops memorizing (it confirms) or another heart is memorizing
  // the span (it just unhearts).
  const offersChoices = useCallback(
    (startVerse: number, endVerse: number) =>
      !stopsMemorizingSpan(startVerse, endVerse) &&
      !isSpanMemorizing(startVerse, endVerse, savedSpans),
    [savedSpans, stopsMemorizingSpan],
  );

  const offerChoices = useCallback(
    (
      startVerse: number,
      endVerse: number,
      anchor: HTMLElement,
      unheart: () => void,
    ) =>
      heartedClicked({ book, chapter, startVerse, endVerse }, anchor, unheart),
    [book, chapter, heartedClicked],
  );

  const [hoveredSavedPassage, setHoveredSavedPassage] = useState<{
    startVerse: number;
    endVerse: number;
  } | null>(null);

  const handleSavedPassageHoverEnter = useCallback(
    (startVerse: number, endVerse: number) => {
      setHoveredSavedPassage({ startVerse, endVerse });
    },
    [],
  );

  const handleSavedPassageHoverLeave = useCallback(() => {
    setHoveredSavedPassage(null);
  }, []);

  // A memorized passage shows once: its heart level with its first verse and
  // a rail over its verses, instead of a range pill. When passages overlap,
  // the first claims the shared verses; one that claims none keeps its pill.
  const passageRail = useMemo(() => {
    const entries = new Map<number, RailEntry>();
    const drawnSpans = new Set<SavedSpan>();
    for (const span of savedSpans) {
      const { passage } = span;
      if (!passage) continue;
      const segments = passageRailSegments(passage);
      const first = segments[0];
      if (!first || entries.has(first.verse)) continue;
      drawnSpans.add(span);
      const copy = passageHeartCopy(passage, now);
      for (const segment of segments) {
        if (entries.has(segment.verse)) continue;
        entries.set(segment.verse, {
          joinsAbove: segment.joinsAbove,
          mark: {
            stroke: segment.stroke,
            heart: segment.heart
              ? {
                  learnedFraction:
                    passage.totalVerses > 0
                      ? passage.learnedVerses / passage.totalVerses
                      : 0,
                  tooltip: copy.tooltip,
                  ariaLabel: copy.ariaLabel,
                  title: passage.title,
                  onUnheart: () =>
                    onToggleSaved(span.startVerse, span.endVerse),
                  onHoverChange: (hovering) =>
                    hovering
                      ? handleSavedPassageHoverEnter(
                          span.startVerse,
                          span.endVerse,
                        )
                      : handleSavedPassageHoverLeave(),
                }
              : null,
          },
        });
      }
    }
    const marks = new Map<number, PassageRailMark>();
    for (const [verse, entry] of entries) marks.set(verse, entry.mark);
    return { entries, marks, drawnSpans };
  }, [
    handleSavedPassageHoverEnter,
    handleSavedPassageHoverLeave,
    now,
    onToggleSaved,
    savedSpans,
  ]);

  const railPastHeadings = (
    verseNumber: number | undefined,
    hasHeading: boolean,
  ) => {
    if (!hasHeading || verseNumber === undefined) return null;
    const entry = passageRail.entries.get(verseNumber);
    return entry?.joinsAbove ? entry.mark.stroke : null;
  };

  const savedPassagesByAnchor = useMemo(() => {
    const map = new Map<number, SavedPassageAtAnchor[]>();
    for (const span of savedSpans) {
      const { startVerse, endVerse } = span;
      if (startVerse === endVerse) continue;
      if (passageRail.drawnSpans.has(span)) continue;
      const arr = map.get(startVerse) ?? [];
      arr.push({
        startVerse,
        endVerse,
        stopsMemorizing: span.stopsMemorizing === true,
        onOfferChoices: offersChoices(startVerse, endVerse)
          ? (anchor) =>
              offerChoices(startVerse, endVerse, anchor, () =>
                onToggleSaved(startVerse, endVerse),
              )
          : undefined,
      });
      map.set(startVerse, arr);
    }
    return map;
  }, [offerChoices, offersChoices, onToggleSaved, passageRail, savedSpans]);

  const isInHoveredSavedPassage = useCallback(
    (verseNumber: number) =>
      hoveredSavedPassage !== null &&
      verseNumber >= hoveredSavedPassage.startVerse &&
      verseNumber <= hoveredSavedPassage.endVerse,
    [hoveredSavedPassage],
  );

  const hoveredPassageNoteRange = useMemo(() => {
    if (hoveredPassageBubble === null) return null;
    return passageHoverSpanForNotes(
      passageNotesByAnchor.get(hoveredPassageBubble) ?? [],
      savedEditOverrides,
    );
  }, [hoveredPassageBubble, passageNotesByAnchor, savedEditOverrides]);

  const isInHoveredPassageNote = useCallback(
    (verseNumber: number) =>
      hoveredPassageNoteRange !== null &&
      verseNumber >= hoveredPassageNoteRange.startVerse &&
      verseNumber <= hoveredPassageNoteRange.endVerse,
    [hoveredPassageNoteRange],
  );

  const multiVersePassageSelection =
    isPassageSelection && selectedVerses.size > 1;
  const passageSelectLo = multiVersePassageSelection
    ? Math.min(...selectedVerses)
    : null;
  const passageSelectHi = multiVersePassageSelection
    ? Math.max(...selectedVerses)
    : null;

  const passageHeartForSingleVerse = (
    verseNumber: number,
  ): PassageHeartControl | null => {
    if (multiVersePassageSelection) {
      if (
        passageSelectLo === null ||
        passageSelectHi === null ||
        verseNumber !== passageSelectLo
      ) {
        return null;
      }
      return {
        filled: hasExactSavedSpan(savedSpans, passageSelectLo, passageSelectHi),
        onToggle: (anchor) =>
          toggleHeart(passageSelectLo, passageSelectHi, anchor),
        alwaysVisible: true,
        ...spanHeartMemory(passageSelectLo, passageSelectHi),
        stopsMemorizing: stopsMemorizingSpan(passageSelectLo, passageSelectHi),
        reference: spanTitle(passageSelectLo, passageSelectHi),
        onOfferChoices: offersChoices(passageSelectLo, passageSelectHi)
          ? (anchor, unheart) =>
              offerChoices(passageSelectLo, passageSelectHi, anchor, unheart)
          : undefined,
      };
    }
    return {
      filled: hasExactSavedSpan(savedSpans, verseNumber, verseNumber),
      onToggle: (anchor) => toggleHeart(verseNumber, verseNumber, anchor),
      // Inside a memorized passage, progress lives on the passage heart.
      ...(passageRail.entries.has(verseNumber)
        ? { masteryFraction: 0 }
        : spanHeartMemory(verseNumber, verseNumber)),
      stopsMemorizing: stopsMemorizingSpan(verseNumber, verseNumber),
      reference: spanTitle(verseNumber, verseNumber),
      onOfferChoices: offersChoices(verseNumber, verseNumber)
        ? (anchor, unheart) =>
            offerChoices(verseNumber, verseNumber, anchor, unheart)
        : undefined,
    };
  };

  const focusDistanceByKey = useMemo(() => {
    if (!isFocusMode) return EMPTY_FOCUS_MAP;

    const hasAnythingOpen =
      openVerseKeys.size > 0 ||
      openPassageKeys.size > 0 ||
      newDraftsByAnchor.size > 0;
    if (!hasAnythingOpen) return EMPTY_FOCUS_MAP;
    if (!currentFocusTarget) return EMPTY_FOCUS_MAP;

    const focusedIndex = filteredVerses.findIndex((item) => {
      if (currentFocusTarget.kind === "passage") {
        return item.kind === "passageGroup"
          ? item.anchorVerse === currentFocusTarget.anchorVerse
          : item.verseNumber === currentFocusTarget.anchorVerse;
      }
      return (
        item.kind === "single" &&
        item.verseNumber === currentFocusTarget.verseNumber
      );
    });

    if (focusedIndex === -1) return EMPTY_FOCUS_MAP;

    const map = new Map<string, number | null>();
    for (let i = 0; i < filteredVerses.length; i++) {
      const item = filteredVerses[i];
      const key =
        item.kind === "passageGroup"
          ? `passage-group-${item.anchorVerse}`
          : String(item.verseNumber);
      map.set(key, Math.abs(i - focusedIndex));
    }

    return map;
  }, [
    isFocusMode,
    openVerseKeys,
    openPassageKeys,
    currentFocusTarget,
    newDraftsByAnchor,
    filteredVerses,
  ]);

  const reduceMotion = useReducedMotion() === true;
  const listPresenceMode = verseListPresenceMode(inPlaceRetargetActive);
  const openDraftSpans = useMemo((): OpenDraftSpan[] => {
    const spans: OpenDraftSpan[] = [];
    for (const drafts of newDraftsByAnchor.values()) {
      for (const draft of drafts) {
        spans.push({
          startVerse: draft.verseRef.startVerse,
          endVerse: draft.verseRef.endVerse,
        });
      }
    }
    for (const composers of editComposersByAnchor.values()) {
      for (const composer of composers) {
        spans.push({
          startVerse: composer.verseRef.startVerse,
          endVerse: composer.verseRef.endVerse,
        });
      }
    }
    return spans;
  }, [editComposersByAnchor, newDraftsByAnchor]);

  const { darkMode } = useTheme();

  const focusGlowStyle = useMemo(() => {
    if (!isFocusMode || focusGlowAmount <= 0) return undefined;

    // Against a dark canvas the rim needs far less primary mixed in before it
    // registers; at light-mode strength it blooms across the whole viewport.
    const intensity = darkMode ? 0.38 : 1;
    const innerPercent = Math.round((10 + focusGlowAmount * 0.18) * intensity);
    const outerPercent = Math.round((5 + focusGlowAmount * 0.1) * intensity);
    const innerBlur = Math.round(10 + focusGlowAmount * 0.12);
    const outerBlur = Math.round(20 + focusGlowAmount * 0.08);

    return {
      boxShadow: `inset 0 0 ${innerBlur}px color-mix(in oklab, var(--primary) ${innerPercent}%, transparent), inset 0 0 ${outerBlur}px color-mix(in oklab, var(--primary) ${outerPercent}%, transparent)`,
    };
  }, [darkMode, focusGlowAmount, isFocusMode]);

  useEffect(() => {
    if (!passagePresenceDebugEnabled()) return;
    const groupKeys: string[] = [];
    const verseKinds: Array<{ verse: number; kind: string }> = [];
    for (const item of filteredVerses) {
      if (item.kind === "passageGroup") {
        const drafts = newDraftsByAnchor.get(item.anchorVerse) ?? [];
        groupKeys.push(draftGroupPresenceKey(item.anchorVerse, drafts));
      } else {
        verseKinds.push({
          verse: item.verseNumber,
          kind: singleVersePresenceKind({
            hostsOpenDraft:
              (newDraftsByAnchor.get(item.verseNumber) ?? []).length > 0,
            reenteringFromGroup: reenteringFromGroup.has(item.verseNumber),
            verseNumber: item.verseNumber,
            openDrafts: openDraftSpans,
            inPlaceRetarget: inPlaceRetargetActive,
          }),
        });
      }
    }
    const phase = inPlaceRetargetActive
      ? "retarget"
      : newDraftsByAnchor.size > 0
        ? "first-open"
        : reenteringFromGroup.size > 0
          ? "close"
          : "idle";
    logPassagePresence({
      phase,
      listPresenceMode,
      inPlaceRetargetActive,
      retargetingEditorKey,
      groupKeys,
      verseKinds,
    });
  }, [
    filteredVerses,
    inPlaceRetargetActive,
    listPresenceMode,
    newDraftsByAnchor,
    openDraftSpans,
    reenteringFromGroup,
    retargetingEditorKey,
  ]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 transition-[box-shadow] duration-300"
        style={focusGlowStyle}
      />
      <ScrollArea
        className={cn("relative z-10 h-full min-h-0 overflow-hidden")}
        viewportRef={viewportRef}
      >
        <motion.div
          key={passageKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          ref={containerRef}
          className={cn(containerClass, "relative")}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div>
            <AnimatePresence initial={false} mode={listPresenceMode}>
              {filteredVerses.map((item) => {
                if (item.kind === "passageGroup") {
                  const gLo = item.verses[0]?.verseNumber ?? 0;
                  const gHi =
                    item.verses[item.verses.length - 1]?.verseNumber ?? gLo;
                  const groupSelected =
                    item.verses.length > 0 &&
                    item.verses.every((v) => selectedVerses.has(v.verseNumber));
                  const selectionBar: GroupSelectionBar | null =
                    groupSelected && !isFocusMode && !tourActive
                      ? {
                          reference: spanTitle(gLo, gHi),
                          hearted: hasExactSavedSpan(savedSpans, gLo, gHi),
                          stopsMemorizing: stopsMemorizingSpan(gLo, gHi),
                          onToggleHeart: (anchor) =>
                            toggleHeart(gLo, gHi, anchor),
                          onOfferChoices: offersChoices(gLo, gHi)
                            ? (anchor) =>
                                offerChoices(gLo, gHi, anchor, () =>
                                  onToggleSaved(gLo, gHi),
                                )
                            : undefined,
                          onClear: requestClearSelection,
                        }
                      : null;
                  const draftsForAnchor =
                    newDraftsByAnchor.get(item.anchorVerse) ?? [];
                  const editComposersForAnchor =
                    editComposersByAnchor.get(item.anchorVerse) ?? [];
                  const ownsRetarget = groupUsesRetargetMotion(
                    [...draftsForAnchor, ...editComposersForAnchor],
                    retargetingEditorKey,
                    inPlaceRetargetActive,
                  );
                  const groupMotion = groupListPresenceMotion(
                    ownsRetarget,
                    reduceMotion,
                  );
                  const spanLayoutId =
                    ownsRetarget &&
                    (draftsForAnchor[0] || editComposersForAnchor[0])
                      ? draftSpanLayoutId(
                          (draftsForAnchor[0] ?? editComposersForAnchor[0])
                            .editorKey,
                        )
                      : undefined;
                  const groupPresenceKey = draftGroupPresenceKey(
                    item.anchorVerse,
                    [...draftsForAnchor, ...editComposersForAnchor],
                  );
                  return (
                    <motion.div
                      key={groupPresenceKey}
                      data-presence-kind={
                        ownsRetarget ? "draft-group" : "passage-group"
                      }
                      data-list-presence-mode={listPresenceMode}
                      data-presence-phase={
                        inPlaceRetargetActive ? "retarget" : "enter-exit"
                      }
                      data-span-layout-id={spanLayoutId}
                      layout={
                        inPlaceRetargetActive || groupMotion.layout
                          ? true
                          : undefined
                      }
                      layoutId={spanLayoutId}
                      initial={groupMotion.initial}
                      animate={groupMotion.animate}
                      exit={groupMotion.exit}
                      transition={listItemTransition(
                        groupMotion.transition,
                        inPlaceRetargetActive,
                        reduceMotion,
                      )}
                    >
                      <PassageRailPastHeadings
                        stroke={railPastHeadings(
                          item.verses[0]?.verseNumber,
                          Boolean(item.heading || item.subheading),
                        )}
                      >
                        {item.heading ? (
                          <AnimatePresence initial={false}>
                            {showSectionHeaders ? (
                              <SectionHeading
                                key={`heading-group-${item.anchorVerse}`}
                                title={item.heading}
                              />
                            ) : null}
                          </AnimatePresence>
                        ) : null}
                        {item.subheading ? (
                          <SectionHeading
                            key={`subheading-group-${item.anchorVerse}`}
                            title={item.subheading}
                            variant="sub"
                          />
                        ) : null}
                      </PassageRailPastHeadings>
                      <PassageGroupWithNotes
                        verses={item.verses}
                        passageNotes={item.passageNotes}
                        singleNotesByVerse={item.singleNotesByVerse}
                        viewMode={effectiveViewMode}
                        currentChapter={{ book, chapter }}
                        selectionBar={selectionBar}
                        hoveredSavedPassage={hoveredSavedPassage}
                        passageRailByVerse={passageRail.marks}
                        highlightsByVerse={highlightsByVerse}
                        onCreateHighlight={onCreateHighlight}
                        onDeleteHighlight={onDeleteHighlight}
                        onRecolorHighlight={onRecolorHighlight}
                        isPassageOpen={openPassageKeys.has(item.anchorVerse)}
                        editingNoteIds={editingNoteIds}
                        draftsForAnchor={draftsForAnchor}
                        editComposersForAnchor={editComposersForAnchor}
                        onRetargetNewDraft={retargetNewDraft}
                        onRetargetEditNote={retargetEditNote}
                        retargetingEditorKey={retargetingEditorKey}
                        inPlaceRetargetActive={inPlaceRetargetActive}
                        savedEditOverrides={savedEditOverrides}
                        focusDistance={
                          focusDistanceByKey.get(
                            `passage-group-${item.anchorVerse}`,
                          ) ?? null
                        }
                        onOpenPassageNotes={openPassageNotes}
                        onClosePassageNotes={closePassageNotes}
                        onOpenVerseNotes={openVerseNotes}
                        onEditNote={startEditingNote}
                        onDelete={handleDelete}
                        onSaveEdit={handleSaveEdit}
                        onSaveNew={handleSaveNew}
                        onCancelEditor={cancelEditor}
                        onEditorDirtyChange={notifyEditorDirty}
                        onEditorFocus={handleEditorFocus}
                        onStartCreatingPassageNote={startCreatingPassageNote}
                        onNoteDeleteCleanup={handleNoteDeleteCleanup}
                        onPassageBubbleMouseEnter={
                          handlePassageBubbleMouseEnter
                        }
                        onPassageBubbleMouseLeave={
                          handlePassageBubbleMouseLeave
                        }
                        onCollapse={() => closePassageNotes(item.anchorVerse)}
                      />
                    </motion.div>
                  );
                }

                const passageAnchor = verseToPassageAnchor.get(
                  item.verseNumber,
                );
                const isPassageRangeActive = isInHoveredPassageNote(
                  item.verseNumber,
                );
                const isNoteBubbleHovered =
                  hoveredSingleBubble === item.verseNumber;
                const isReentering = reenteringFromGroup.has(item.verseNumber);

                const draftsForVerse =
                  newDraftsByAnchor.get(item.verseNumber) ?? [];
                const editComposersForVerse =
                  editComposersByAnchor.get(item.verseNumber) ?? [];
                const presenceKind = singleVersePresenceKind({
                  hostsOpenDraft:
                    draftsForVerse.length > 0 ||
                    editComposersForVerse.length > 0,
                  reenteringFromGroup: isReentering,
                  verseNumber: item.verseNumber,
                  openDrafts: openDraftSpans,
                  inPlaceRetarget: inPlaceRetargetActive,
                });
                const verseMotion = singleVersePresenceMotion(
                  presenceKind,
                  reduceMotion,
                );
                const spanLayoutId =
                  presenceKind === "draft-host" &&
                  (draftsForVerse[0] || editComposersForVerse[0])
                    ? draftSpanLayoutId(
                        (draftsForVerse[0] ?? editComposersForVerse[0])
                          .editorKey,
                      )
                    : undefined;
                const railStrokePastHeadings = railPastHeadings(
                  item.verseNumber,
                  Boolean(item.heading || item.subheading),
                );
                const railMark =
                  passageRail.entries.get(item.verseNumber)?.mark ?? null;

                return (
                  <motion.div
                    key={item.verseNumber}
                    data-presence-kind={presenceKind}
                    data-list-presence-mode={listPresenceMode}
                    data-span-layout-id={spanLayoutId}
                    layout={
                      inPlaceRetargetActive || verseMotion.layout
                        ? true
                        : undefined
                    }
                    layoutId={spanLayoutId}
                    initial={verseMotion.initial}
                    animate={verseMotion.animate}
                    exit={verseMotion.exit}
                    transition={listItemTransition(
                      verseMotion.transition,
                      inPlaceRetargetActive,
                      reduceMotion,
                    )}
                  >
                    <PassageRailPastHeadings stroke={railStrokePastHeadings}>
                      {item.heading ? (
                        <AnimatePresence initial={false}>
                          {showSectionHeaders ? (
                            <SectionHeading
                              key={`heading-${item.verseNumber}`}
                              title={item.heading}
                            />
                          ) : null}
                        </AnimatePresence>
                      ) : null}
                      {item.subheading ? (
                        <SectionHeading
                          key={`subheading-${item.verseNumber}`}
                          title={item.subheading}
                          variant="sub"
                        />
                      ) : null}
                    </PassageRailPastHeadings>
                    <VerseRowWithNotes
                      verseNumber={item.verseNumber}
                      text={item.text}
                      midHeadings={item.midHeadings}
                      viewMode={effectiveViewMode}
                      currentChapter={{ book, chapter }}
                      selectedVerses={selectedVerses}
                      isInSelectionRange={isInSelection(item.verseNumber)}
                      isPassageSelection={
                        passageDraftVerses.has(item.verseNumber) ||
                        isPassageSelection
                      }
                      singleNotes={item.singleNotes}
                      passageNotes={item.passageNotes}
                      passageAnchor={passageAnchor}
                      isPassageRangeActive={isPassageRangeActive}
                      isNoteBubbleHovered={isNoteBubbleHovered}
                      openVerseKeys={openVerseKeys}
                      openPassageKeys={openPassageKeys}
                      draftsForThisAnchor={draftsForVerse}
                      editComposersForThisAnchor={editComposersForVerse}
                      onRetargetNewDraft={retargetNewDraft}
                      onRetargetEditNote={retargetEditNote}
                      retargetingEditorKey={retargetingEditorKey}
                      savedEditOverrides={savedEditOverrides}
                      editingNoteIds={editingNoteIds}
                      isFocusTarget={
                        hasFocusRange
                          ? item.verseNumber >= focusRange!.startVerse &&
                            item.verseNumber <= focusRange!.endVerse
                          : false
                      }
                      focusDistance={
                        focusDistanceByKey.get(String(item.verseNumber)) ?? null
                      }
                      onAddNote={handleAddNote}
                      onMouseDown={handleVerseMouseDown}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onSingleBubbleMouseEnter={handleSingleBubbleMouseEnter}
                      onSingleBubbleMouseLeave={handleSingleBubbleMouseLeave}
                      onPassageBubbleMouseEnter={handlePassageBubbleMouseEnter}
                      onPassageBubbleMouseLeave={handlePassageBubbleMouseLeave}
                      onOpenVerseNotes={openVerseNotes}
                      onCloseVerseNotes={closeVerseNotes}
                      onOpenPassageNotes={openPassageNotes}
                      onClosePassageNotes={closePassageNotes}
                      onEditNote={startEditingNote}
                      onDelete={handleDelete}
                      onSaveEdit={handleSaveEdit}
                      onSaveNew={handleSaveNew}
                      onCancelEditor={cancelEditor}
                      onEditorDirtyChange={notifyEditorDirty}
                      onEditorFocus={handleEditorFocus}
                      onStartCreatingPassageNote={startCreatingPassageNote}
                      onNoteDeleteCleanup={handleNoteDeleteCleanup}
                      highlights={highlightsByVerse.get(item.verseNumber)}
                      onCreateHighlight={onCreateHighlight}
                      onDeleteHighlight={onDeleteHighlight}
                      onRecolorHighlight={onRecolorHighlight}
                      forceAddButtonVisible={
                        forceAddButtonVisible && item.verseNumber === 1
                      }
                      addNoteTourId={
                        item.verseNumber === 1 ? "passage-add-note" : undefined
                      }
                      rowTourId={
                        item.verseNumber >= FOCUS_MODE_SPOTLIGHT_VERSE_START &&
                        item.verseNumber <= FOCUS_MODE_SPOTLIGHT_VERSE_END
                          ? `passage-verse-${item.verseNumber}`
                          : undefined
                      }
                      passageHeart={passageHeartForSingleVerse(
                        item.verseNumber,
                      )}
                      isInHoveredSavedPassage={isInHoveredSavedPassage(
                        item.verseNumber,
                      )}
                      savedPassagesAtAnchor={savedPassagesByAnchor.get(
                        item.verseNumber,
                      )}
                      onSavedPassageHoverEnter={handleSavedPassageHoverEnter}
                      onSavedPassageHoverLeave={handleSavedPassageHoverLeave}
                      onToggleSavedPassage={onToggleSaved}
                      passageRail={
                        railMark && railStrokePastHeadings
                          ? { ...railMark, flushTop: true }
                          : railMark
                      }
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <div className={topGridClass}>
              <div>
                <ChapterPager book={book} chapter={chapter} />
                <CopyrightNotice text={dataCopyright} />
              </div>
              <div />
            </div>
          </div>

          {/* Sticky solid overlay over the notes column; verse notes stay put */}
          <ChapterNotesChrome
            panel={chapterNotesPanel}
            viewMode={effectiveViewMode}
            notesGridClass={passageGridClass}
          />
        </motion.div>
      </ScrollArea>
      <div className="cl-vignette" aria-hidden />
      <HeartMemorizeNudge {...heartNudge.nudge} />
    </div>
  );
}
