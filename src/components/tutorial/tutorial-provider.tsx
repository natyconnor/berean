import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { logInteraction } from "@/lib/dev-log";
import { writeSearchWorkspaceParams } from "@/lib/search-workspace-state";
import { api } from "../../../convex/_generated/api";
import { useOptionalStagedOnboarding } from "./staged-onboarding-context";
import {
  TutorialContext,
  type TutorialContextValue,
  type TutorialStep as TourStep,
} from "./tutorial-context";
import {
  FOCUS_MODE_CENTER_VERSE,
  FOCUS_MODE_SPOTLIGHT_VERSE_END,
  FOCUS_MODE_SPOTLIGHT_VERSE_START,
} from "./focus-mode-tour";
import {
  readActiveTutorialTour,
  writeActiveTutorialTour,
  type TutorialTourName,
} from "./tutorial-session";

interface TutorialStatus {
  mainTutorialCompletedAt?: number;
  advancedSearchTutorialCompletedAt?: number;
  focusModeTutorialCompletedAt?: number;
  categoryColors: Record<string, string>;
}

const MAIN_TOUR_STEPS: TourStep[] = [
  {
    id: "add-note",
    title: "Add your first note",
    description:
      "Tap the + beside a verse to start a note. You can have multiple notes per verse, or even select multiple verses.",
    targetIds: ["passage-verse-1"],
    cardAnchorIds: ["passage-add-note"],
  },
  {
    id: "note-body",
    title: "Write what stood out",
    description:
      "Capture observations, questions, or study ideas. We'll point out the rest of the app as it becomes useful.",
    targetIds: ["note-editor-body"],
  },
];

const SEARCH_TOUR_STEPS: TourStep[] = [
  {
    id: "query",
    title: "Text search",
    description: "Search by note text to find matching ideas or phrases.",
    targetIds: ["search-query-input"],
  },
  {
    id: "tags",
    title: "Tag filters",
    description:
      "You can narrow results with one or more tags from your catalog.",
    targetIds: ["search-tag-filter"],
  },
  {
    id: "match-mode",
    title: "Any or all tags",
    description:
      "Use Any to match any selected tag or All to require every selected tag.",
    targetIds: ["search-match-mode"],
  },
  {
    id: "results-and-context",
    title: "Read results in context",
    description:
      "Open the verse in context and read the matching notes alongside the chapter.",
    targetIds: [
      "search-demo-result",
      "search-demo-scripture-context",
      "search-demo-go-to-verse",
    ],
  },
];

const FOCUS_MODE_TOUR_STEPS: TourStep[] = [
  {
    id: "focus-verse",
    title: "Focus on one verse",
    description:
      "Open a verse and other verses blur out. Only one verse or passage group stays fully expanded at a time; click another verse to move your focus.",
    targetIds: Array.from(
      {
        length:
          FOCUS_MODE_SPOTLIGHT_VERSE_END - FOCUS_MODE_SPOTLIGHT_VERSE_START + 1,
      },
      (_, i) => `passage-verse-${i + FOCUS_MODE_SPOTLIGHT_VERSE_START}`,
    ),
    scrollIntoViewTargetId: `passage-verse-${FOCUS_MODE_CENTER_VERSE}`,
  },
];

const TOUR_STEPS: Record<TutorialTourName, TourStep[]> = {
  main: MAIN_TOUR_STEPS,
  search: SEARCH_TOUR_STEPS,
  focusMode: FOCUS_MODE_TOUR_STEPS,
};

const DEFAULT_CARD_WIDTH = 320;
const CARD_MARGIN = 16;
const SPOTLIGHT_PADDING = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getStepList(tour: TutorialTourName | null): TourStep[] {
  return tour ? TOUR_STEPS[tour] : [];
}

function buildTargetSelector(targetIds: string[]): string {
  return targetIds.map((targetId) => `[data-tour-id="${targetId}"]`).join(", ");
}

function getTargetElements(targetIds: string[]): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll<HTMLElement>(buildTargetSelector(targetIds)),
  );
}

function getUnionRect(elements: HTMLElement[]): DOMRect | null {
  if (elements.length === 0) return null;

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;

  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  } satisfies DOMRect;
}

function getCardPosition(rect: DOMRect | null): CSSProperties {
  if (typeof window === "undefined") {
    return { left: CARD_MARGIN, right: CARD_MARGIN, bottom: CARD_MARGIN };
  }

  if (!rect) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: DEFAULT_CARD_WIDTH,
      maxWidth: `calc(100vw - ${CARD_MARGIN * 2}px)`,
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(DEFAULT_CARD_WIDTH, viewportWidth - CARD_MARGIN * 2);
  const left = clamp(
    rect.left,
    CARD_MARGIN,
    viewportWidth - width - CARD_MARGIN,
  );
  const belowTop = rect.bottom + CARD_MARGIN;
  const aboveTop = rect.top - 180 - CARD_MARGIN;
  const top =
    belowTop + 180 <= viewportHeight - CARD_MARGIN
      ? belowTop
      : Math.max(CARD_MARGIN, aboveTop);

  return {
    width,
    left,
    top,
  };
}

export function TutorialProvider({
  children,
  tutorialStatus,
}: {
  children: ReactNode;
  tutorialStatus: TutorialStatus;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const stagedOnboarding = useOptionalStagedOnboarding();
  const completeMainTutorial = useMutation(
    api.userSettings.completeMainTutorial,
  );
  const completeAdvancedSearchTutorial = useMutation(
    api.userSettings.completeAdvancedSearchTutorial,
  );
  const completeFocusModeTutorial = useMutation(
    api.userSettings.completeFocusModeTutorial,
  );
  const [activeTour, setActiveTour] = useState<TutorialTourName | null>(() =>
    readActiveTutorialTour(),
  );
  const [pendingTour, setPendingTour] = useState<TutorialTourName | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [locallyCompletedTours, setLocallyCompletedTours] = useState<
    Partial<Record<TutorialTourName, true>>
  >({});
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardAnchorRect, setCardAnchorRect] = useState<DOMRect | null>(null);
  const finishingTourRef = useRef<TutorialTourName | null>(null);

  const isMainComplete =
    locallyCompletedTours.main === true ||
    tutorialStatus.mainTutorialCompletedAt !== undefined;
  const isSearchComplete =
    locallyCompletedTours.search === true ||
    tutorialStatus.advancedSearchTutorialCompletedAt !== undefined;
  const isFocusModeTutorialComplete =
    locallyCompletedTours.focusMode === true ||
    tutorialStatus.focusModeTutorialCompletedAt !== undefined;
  const activeSteps = getStepList(activeTour);
  const activeStep = activeSteps[stepIndex] ?? null;
  const isPassageRoute = location.pathname.startsWith("/passage/");
  const isSearchRoute = location.pathname === "/search";

  useEffect(() => {
    writeActiveTutorialTour(activeTour);
  }, [activeTour]);

  useEffect(() => {
    if (!activeStep) {
      setTargetRect(null);
      setCardAnchorRect(null);
      return;
    }

    const { targetIds, cardAnchorIds, scrollIntoViewTargetId } = activeStep;
    const scrollIntoViewTargets: string[] | null =
      scrollIntoViewTargetId !== undefined ? [scrollIntoViewTargetId] : null;

    let frameId = 0;
    let hasScrolled = false;
    const updateRect = () => {
      const elements = getTargetElements(targetIds);
      const rect = getUnionRect(elements);
      setTargetRect(rect);

      if (cardAnchorIds) {
        const anchorElements = getTargetElements(cardAnchorIds);
        setCardAnchorRect(getUnionRect(anchorElements));
      } else {
        setCardAnchorRect(null);
      }

      if (!hasScrolled && rect) {
        hasScrolled = true;
        if (scrollIntoViewTargets) {
          const preferred = getTargetElements(scrollIntoViewTargets)[0];
          if (preferred) {
            preferred.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else {
          const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
          if (!inViewport) {
            elements[0].scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }

      frameId = window.requestAnimationFrame(updateRect);
    };

    updateRect();
    return () => window.cancelAnimationFrame(frameId);
  }, [activeStep, location.pathname]);

  useEffect(() => {
    if (activeTour || pendingTour) return;

    if (!isMainComplete) {
      writeActiveTutorialTour("main");
      if (isPassageRoute) {
        setActiveTour("main");
        setStepIndex(0);
      } else {
        setPendingTour("main");
        void navigate({
          to: "/passage/$passageId",
          params: { passageId: "John-1" },
          search: {},
          replace: true,
        });
      }
      return;
    }

    // The Search walkthrough is part of Wave 4: it should only auto-start
    // after the user has been shown (and acted on) the Search reveal callout.
    // Users who land on /search before reaching the threshold (e.g. via
    // direct URL) get the basic search workspace without a forced tour.
    const searchRevealActed =
      stagedOnboarding === null ||
      stagedOnboarding.isHintCompleted(
        FEATURE_HINTS.SEARCH_REVEAL_AFTER_LIBRARY,
      );
    if (!isSearchComplete && isSearchRoute && searchRevealActed) {
      writeActiveTutorialTour("search");
      setActiveTour("search");
      setStepIndex(0);
    }
  }, [
    activeTour,
    isMainComplete,
    isPassageRoute,
    isSearchComplete,
    isSearchRoute,
    navigate,
    pendingTour,
    stagedOnboarding,
  ]);

  useEffect(() => {
    if (!pendingTour) return;

    if (pendingTour === "main" && isPassageRoute) {
      setActiveTour("main");
      if (activeTour !== "main") {
        setStepIndex(0);
      }
      setPendingTour(null);
      return;
    }

    if (pendingTour === "search" && isSearchRoute) {
      setActiveTour("search");
      setStepIndex(0);
      setPendingTour(null);
    }
  }, [activeTour, isPassageRoute, isSearchRoute, pendingTour]);

  const finalizeTour = useCallback(
    async (
      tour: TutorialTourName,
      options?: {
        skipped?: boolean;
      },
    ) => {
      if (finishingTourRef.current === tour) return;

      const skipped = options?.skipped === true;
      logInteraction("tutorial", "finished", { tour, skipped });
      finishingTourRef.current = tour;
      setLocallyCompletedTours((current) => ({
        ...current,
        [tour]: true,
      }));
      setActiveTour(null);
      setPendingTour(null);
      setStepIndex(0);
      writeActiveTutorialTour(null);

      if (tour === "search") {
        writeSearchWorkspaceParams({});
        if (location.pathname === "/search") {
          void navigate({ to: "/search", search: {}, replace: true });
        }
      }

      try {
        if (tour === "main") {
          await completeMainTutorial({});
        } else if (tour === "search") {
          await completeAdvancedSearchTutorial({});
        } else if (tour === "focusMode") {
          await completeFocusModeTutorial({});
        }
      } finally {
        finishingTourRef.current = null;
      }
    },
    [
      completeAdvancedSearchTutorial,
      completeFocusModeTutorial,
      completeMainTutorial,
      location.pathname,
      navigate,
    ],
  );

  const startTour = useCallback(
    (tour: TutorialTourName) => {
      logInteraction("tutorial", "started", { tour });
      setStepIndex(0);
      setPendingTour(null);
      writeActiveTutorialTour(tour);

      if (tour === "main") {
        setActiveTour(null);
        if (isPassageRoute) {
          setActiveTour("main");
        } else {
          setPendingTour("main");
          void navigate({
            to: "/passage/$passageId",
            params: { passageId: "John-1" },
            search: {},
          });
        }
        return;
      }

      if (tour === "focusMode") {
        setActiveTour("focusMode");
        return;
      }

      setActiveTour(null);
      if (isSearchRoute) {
        setActiveTour("search");
      } else {
        setPendingTour("search");
        void navigate({ to: "/search", search: {} });
      }
    },
    [isPassageRoute, isSearchRoute, navigate],
  );

  const handleNext = () => {
    if (!activeTour || !activeStep) return;

    const nextIndex = stepIndex + 1;
    if (nextIndex >= activeSteps.length) {
      void finalizeTour(activeTour);
      return;
    }

    const nextStep = activeSteps[nextIndex];
    logInteraction("tutorial", "advanced", {
      fromStepId: activeStep.id,
      toStepId: nextStep.id,
      tour: activeTour,
    });
    setStepIndex(nextIndex);
  };

  const handleBack = () => {
    if (!activeTour || !activeStep) return;

    const nextIndex = Math.max(stepIndex - 1, 0);
    logInteraction("tutorial", "went-back", {
      fromStepId: activeStep.id,
      toStepId: activeSteps[nextIndex]?.id ?? activeStep.id,
      tour: activeTour,
    });
    setStepIndex(nextIndex);
  };

  const contextValue = useMemo<TutorialContextValue>(
    () => ({
      activeTour,
      activeStep,
      stepIndex,
      stepCount: activeSteps.length,
      startTour,
      isTourActive: (tour) => activeTour === tour,
      isStepActive: (tour, stepId) =>
        activeTour === tour && activeStep?.id === stepId,
      isFocusModeTutorialComplete,
    }),
    [
      activeStep,
      activeSteps.length,
      activeTour,
      isFocusModeTutorialComplete,
      startTour,
      stepIndex,
    ],
  );

  const spotlightStyle: CSSProperties | undefined = targetRect
    ? {
        left: Math.max(0, targetRect.left - SPOTLIGHT_PADDING),
        top: Math.max(0, targetRect.top - SPOTLIGHT_PADDING),
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
        boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.58)",
      }
    : undefined;

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      {activeTour && activeStep ? (
        <>
          <div className="pointer-events-auto fixed inset-0 z-140 bg-transparent" />
          {spotlightStyle ? (
            <div
              className="pointer-events-none fixed z-141 rounded-xl border-2 border-sky-400/90 bg-transparent transition-all duration-200"
              style={spotlightStyle}
            />
          ) : (
            <div className="pointer-events-auto fixed inset-0 z-141 bg-slate-950/55" />
          )}
          <section
            className="fixed z-142 rounded-xl border bg-card p-4 shadow-2xl"
            style={getCardPosition(cardAnchorRect ?? targetRect)}
          >
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {activeTour === "main"
                    ? "App Tour"
                    : activeTour === "focusMode"
                      ? "Focus mode"
                      : "Advanced Search"}
                </p>
                <h2 className="text-base font-semibold">{activeStep.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {activeStep.description}
                </p>
              </div>

              {targetRect === null ? (
                <p className="text-xs text-muted-foreground">
                  Preparing this step...
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {stepIndex + 1} / {activeSteps.length}
                </span>
                <div className="flex items-center gap-2">
                  {activeSteps.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void finalizeTour(activeTour, { skipped: true })
                      }
                    >
                      Skip
                    </Button>
                  ) : null}
                  {activeSteps.length > 1 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBack}
                      disabled={stepIndex === 0}
                    >
                      Back
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={handleNext}
                    disabled={targetRect === null}
                  >
                    {stepIndex === activeSteps.length - 1 ? "Done" : "Next"}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </TutorialContext.Provider>
  );
}
