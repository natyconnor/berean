import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, NotebookPen } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { logInteraction } from "@/lib/dev-log";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";
import { useLiveNow } from "@/hooks/use-live-now";
import { useTabs } from "@/lib/use-tabs";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { shouldRevealStudy } from "@/lib/staged-onboarding-thresholds";
import { useOptionalStagedOnboarding } from "@/components/tutorial/staged-onboarding-context";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { FeatureCallout } from "@/components/tutorial/feature-callout";

/** How the Mode Dock behaves. Mirrors the `modeDock` userSettings field. */
export type ModeDockPreference = "auto-hide" | "always" | "off";

/** Downward scroll (px) before the dock auto-hides. */
const SCROLL_HIDE_THRESHOLD = 24;
/** Idle time (ms) after scrolling stops before the dock returns. */
const SCROLL_IDLE_MS = 500;

function isEditorElement(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === "TEXTAREA" ||
    tag === "INPUT" ||
    (element as HTMLElement).isContentEditable
  );
}

/**
 * The Mode Dock: a floating bottom-center pill with two segments (Notes /
 * Study) and a live due-count badge. It's `position: fixed` so it never affects
 * layout flow, and it's engineered to slide out of the way while you work.
 */
export function ModeDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { backPassageId } = useTabs();

  const now = useLiveNow();
  const dueCount = useQuery(api.verseMemory.dueCount, { now });
  const preference =
    useQuery(api.userSettings.getModeDockPreference) ?? "auto-hide";

  const isStudyRoute = location.pathname.startsWith("/study");
  const isNotesRoute = location.pathname.startsWith("/passage");

  // Local-only visibility state (never persisted): scroll + editor focus.
  const [scrollHidden, setScrollHidden] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);

  const dockEnabled = preference !== "off";
  const autoHide = preference === "auto-hide";

  // One-time reveal after the first heart, reusing the shared hint system.
  // Only claim the hint while the dock can actually render its callout — when
  // the dock is off, the toolbar Study link is the fallback that completes the
  // reveal (see tab-bar.tsx), so the global hint queue is never pinned by an
  // eligible-but-unrendered callout.
  const stagedOnboarding = useOptionalStagedOnboarding();
  const milestones = stagedOnboarding?.milestones;
  const studyRevealReached = milestones ? shouldRevealStudy(milestones) : false;
  const studyHint = useFeatureHint(
    FEATURE_HINTS.STUDY_REVEAL_AFTER_FIRST_HEART,
    studyRevealReached && dockEnabled,
  );

  useEffect(() => {
    if (!autoHide) return;

    // App content scrolls inside nested containers rather than the window, so
    // capture scroll events at the document level to observe every scroller.
    const lastPositions = new WeakMap<EventTarget, number>();
    let idleTimer: number | undefined;
    // Accumulate downward movement so trackpad/smooth scrolls (many tiny
    // deltas) still hide the dock once the total passes the threshold. Reset on
    // any upward movement so a direction change re-arms the return-on-up rule.
    let accumulatedDown = 0;

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!target) return;
      const y =
        target === document
          ? window.scrollY
          : target instanceof HTMLElement
            ? target.scrollTop
            : 0;
      const previous = lastPositions.get(target) ?? y;
      const delta = y - previous;
      lastPositions.set(target, y);

      if (delta > 0) {
        accumulatedDown += delta;
        if (
          accumulatedDown >= SCROLL_HIDE_THRESHOLD &&
          y > SCROLL_HIDE_THRESHOLD
        ) {
          setScrollHidden(true);
        }
      } else if (delta < 0) {
        accumulatedDown = 0;
        setScrollHidden(false);
      }

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        accumulatedDown = 0;
        setScrollHidden(false);
      }, SCROLL_IDLE_MS);
    };

    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      window.clearTimeout(idleTimer);
      // Reset when auto-hide is disabled so the dock returns cleanly.
      setScrollHidden(false);
    };
  }, [autoHide]);

  useEffect(() => {
    if (!autoHide) return;

    // A global Focus mode toggle exists only as passage-local React state
    // (`useFocusMode`), so it isn't observable from the app shell yet — full
    // Focus-mode integration is deferred. Hiding while a note editor/textarea
    // is focused covers the "disappear while you work" intent in the meantime.
    const syncFocus = () =>
      setEditorFocused(isEditorElement(document.activeElement));
    document.addEventListener("focusin", syncFocus);
    document.addEventListener("focusout", syncFocus);
    return () => {
      document.removeEventListener("focusin", syncFocus);
      document.removeEventListener("focusout", syncFocus);
      setEditorFocused(false);
    };
  }, [autoHide]);

  const revealPending = studyHint.pending;
  // Keep the dock on screen while the one-time reveal callout is showing so its
  // anchor stays visible.
  const hidden = autoHide && !revealPending && (scrollHidden || editorFocused);

  useEffect(() => {
    if (!dockEnabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key.toLowerCase() !== "j") return;

      event.preventDefault();
      const goingToStudy = !location.pathname.startsWith("/study");
      logInteraction(
        "mode-dock",
        goingToStudy ? "study-opened" : "notes-opened",
        {
          trigger: "keyboard",
        },
      );
      if (goingToStudy) {
        void navigate({ to: "/study" });
      } else {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId: backPassageId },
        });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dockEnabled, location.pathname, navigate, backPassageId]);

  if (!dockEnabled) {
    return null;
  }

  const toggleShortcutLabel = formatCommandOrControlShortcut("J");
  const showBadge = typeof dueCount === "number" && dueCount > 0;
  const badgeLabel = showBadge
    ? `${dueCount} ${dueCount === 1 ? "verse" : "verses"} due for review`
    : undefined;

  const motionProps = reducedMotion
    ? { animate: { opacity: hidden ? 0 : 1 } }
    : { animate: { y: hidden ? 24 : 0, opacity: hidden ? 0 : 1 } };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
      <FeatureCallout
        state={studyHint}
        title="Study lives here now"
        description="You've hearted a verse. Use this dock to jump into Study and review your verses — a badge appears when reviews are due."
        primaryActionLabel="Open Study"
        onPrimaryAction={() => {
          logInteraction("mode-dock", "study-opened", {
            trigger: "reveal-callout",
          });
          void navigate({ to: "/study" });
        }}
        side="top"
        align="center"
      >
        <motion.nav
          aria-label="Mode"
          initial={false}
          {...motionProps}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur",
            hidden && "pointer-events-none",
          )}
        >
          <Link
            to="/passage/$passageId"
            params={{ passageId: backPassageId }}
            title={`Notes (${toggleShortcutLabel} toggles)`}
            aria-label="Notes"
            aria-current={isNotesRoute ? "page" : undefined}
            onClick={() =>
              logInteraction("mode-dock", "notes-opened", { trigger: "click" })
            }
            className={segmentClassName(isNotesRoute)}
          >
            <NotebookPen className="h-4 w-4" />
            <span>Notes</span>
          </Link>
          <Link
            to="/study"
            title={`Study (${toggleShortcutLabel} toggles)`}
            aria-label="Study"
            aria-current={isStudyRoute ? "page" : undefined}
            onClick={() => {
              logInteraction("mode-dock", "study-opened", { trigger: "click" });
              if (!studyHint.completed && !studyHint.dismissed) {
                studyHint.complete();
              }
            }}
            className={segmentClassName(isStudyRoute)}
          >
            <BookOpen className="h-4 w-4" />
            <span>Study</span>
            {showBadge ? (
              <span
                aria-label={badgeLabel}
                className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-destructive-foreground"
              >
                {dueCount}
              </span>
            ) : null}
          </Link>
        </motion.nav>
      </FeatureCallout>
    </div>
  );
}

function segmentClassName(active: boolean): string {
  return cn(
    "relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
