import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Brain, BookOpen, NotebookPen } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { logInteraction } from "@/lib/dev-log";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";
import { useLiveNow } from "@/hooks/use-live-now";
import { useTabs } from "@/lib/use-tabs";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { isStudyFeatureAccessible } from "@/lib/study-feature-access";
import { shouldRevealMemory } from "@/lib/staged-onboarding-thresholds";
import { useOptionalStagedOnboarding } from "@/components/tutorial/staged-onboarding-context";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { FeatureCallout } from "@/components/tutorial/feature-callout";

/** How the Mode Dock behaves. Mirrors the `modeDock` userSettings field. */
export type ModeDockPreference = "auto-hide" | "always" | "off";

/** Downward scroll (px) before the dock auto-hides. */
const SCROLL_HIDE_THRESHOLD = 24;
/** Idle time (ms) after scrolling stops before the dock returns. */
const SCROLL_IDLE_MS = 500;

/** The three navigable modes, in dock order. */
type Mode = "notes" | "memory" | "study";

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
 * The Mode Dock: a floating bottom-center pill with up to three segments (Notes
 * / Memory / Study) and a live due-count badge on Memory. It's `position: fixed`
 * so it never affects layout flow, and it's engineered to slide out of the way
 * while you work. Each mode beyond Notes is revealed progressively, and the dock
 * stays hidden until at least two modes are unlocked.
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

  const isNotesRoute = location.pathname.startsWith("/passage");
  const isMemoryRoute = location.pathname.startsWith("/memory");
  const isStudyRoute = location.pathname.startsWith("/study");

  // Local-only visibility state (never persisted): scroll + editor focus.
  const [scrollHidden, setScrollHidden] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);

  const dockEnabled = preference !== "off";
  const autoHide = preference === "auto-hide";

  // Progressive reveal. Notes is always unlocked; Memory unlocks on the first
  // heart, Study once enough notes exist. The dock only renders once a *second*
  // mode is unlocked (a single Notes segment isn't worth the chrome).
  const stagedOnboarding = useOptionalStagedOnboarding();
  const milestones = stagedOnboarding?.milestones;
  const memoryUnlocked = milestones ? shouldRevealMemory(milestones) : false;
  const studyUnlocked = isStudyFeatureAccessible(milestones);
  const unlockedModes = useMemo<Mode[]>(() => {
    const modes: Mode[] = ["notes"];
    if (memoryUnlocked) modes.push("memory");
    if (studyUnlocked) modes.push("study");
    return modes;
  }, [memoryUnlocked, studyUnlocked]);

  // One-time reveal callouts, reusing the shared hint system. Only claim a hint
  // while the dock can actually render its callout — when the dock is off, the
  // toolbar links are the fallbacks that complete the reveals (see tab-bar.tsx),
  // so the global hint queue is never pinned by an eligible-but-unrendered
  // callout.
  const memoryHint = useFeatureHint(
    FEATURE_HINTS.MEMORY_REVEAL_AFTER_FIRST_HEART,
    memoryUnlocked && dockEnabled,
  );
  const studyHint = useFeatureHint(
    FEATURE_HINTS.STUDY_REVEAL_AFTER_NOTES,
    studyUnlocked && dockEnabled,
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

  const goToMode = useCallback(
    (mode: Mode, trigger: string) => {
      if (mode === "notes") {
        logInteraction("mode-dock", "notes-opened", { trigger });
        void navigate({
          to: "/passage/$passageId",
          params: { passageId: backPassageId },
        });
        return;
      }
      if (mode === "memory") {
        logInteraction("mode-dock", "memory-opened", { trigger });
        void navigate({ to: "/memory" });
        return;
      }
      logInteraction("mode-dock", "study-opened", { trigger });
      void navigate({ to: "/study" });
    },
    [navigate, backPassageId],
  );

  const activeMode: Mode = isStudyRoute
    ? "study"
    : isMemoryRoute
      ? "memory"
      : "notes";

  const revealPending = memoryHint.pending || studyHint.pending;
  // Keep the dock on screen while a one-time reveal callout is showing so its
  // anchor stays visible.
  const hidden = autoHide && !revealPending && (scrollHidden || editorFocused);

  useEffect(() => {
    if (!dockEnabled) return;
    if (unlockedModes.length < 2) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key.toLowerCase() !== "j") return;

      event.preventDefault();
      // Cycle only through the modes the user has unlocked. When the current
      // route maps to a mode that isn't unlocked (indexOf === -1), jump to the
      // first unlocked mode rather than skipping past it.
      const currentIndex = unlockedModes.indexOf(activeMode);
      const nextMode =
        currentIndex === -1
          ? unlockedModes[0]
          : unlockedModes[(currentIndex + 1) % unlockedModes.length];
      goToMode(nextMode, "keyboard");
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dockEnabled, unlockedModes, activeMode, goToMode]);

  // A lone Notes segment isn't worth the chrome — wait for a second mode.
  if (!dockEnabled || unlockedModes.length < 2) {
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
          title={`Notes (${toggleShortcutLabel} cycles)`}
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
        {memoryUnlocked ? (
          <FeatureCallout
            state={memoryHint}
            title="Memory lives here now"
            description="You've hearted a verse — it's now in Memory. Use this dock to review and grow your verses. A badge appears when reviews are due."
            primaryActionLabel="Open Memory"
            onPrimaryAction={() => {
              logInteraction("mode-dock", "memory-opened", {
                trigger: "reveal-callout",
              });
              void navigate({ to: "/memory" });
            }}
            side="top"
            align="center"
          >
            <Link
              to="/memory"
              title={`Memory (${toggleShortcutLabel} cycles)`}
              aria-label="Memory"
              aria-current={isMemoryRoute ? "page" : undefined}
              onClick={() => {
                logInteraction("mode-dock", "memory-opened", {
                  trigger: "click",
                });
                if (!memoryHint.completed && !memoryHint.dismissed) {
                  memoryHint.complete();
                }
              }}
              className={segmentClassName(isMemoryRoute)}
            >
              <Brain className="h-4 w-4" />
              <span>Memory</span>
              {showBadge ? (
                <span
                  aria-label={badgeLabel}
                  className={cn(
                    "ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums",
                    // Theme primary on the card; invert against the selected
                    // primary pill so the count stays readable in every theme.
                    isMemoryRoute
                      ? "bg-primary-foreground text-primary"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {dueCount}
                </span>
              ) : null}
            </Link>
          </FeatureCallout>
        ) : null}
        {studyUnlocked ? (
          <FeatureCallout
            state={studyHint}
            title="Study lives here now"
            description="You've written enough notes to start studying. Jump into Study to review and teach what you've captured."
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
            <Link
              to="/study"
              title={`Study (${toggleShortcutLabel} cycles)`}
              aria-label="Study"
              aria-current={isStudyRoute ? "page" : undefined}
              onClick={() => {
                logInteraction("mode-dock", "study-opened", {
                  trigger: "click",
                });
                if (!studyHint.completed && !studyHint.dismissed) {
                  studyHint.complete();
                }
              }}
              className={segmentClassName(isStudyRoute)}
            >
              <BookOpen className="h-4 w-4" />
              <span>Study</span>
            </Link>
          </FeatureCallout>
        ) : null}
      </motion.nav>
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
