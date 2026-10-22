import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Brain, BookOpen, NotebookPen } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { useEnsureInMemoryBackfill } from "@/hooks/use-ensure-in-memory-backfill";
import { useLiveNow } from "@/hooks/use-live-now";
import { cn } from "@/lib/utils";
import { logInteraction } from "@/lib/dev-log";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";
import {
  rememberModeLocation,
  resolveModeHref,
  readModeLastLocations,
  modeNavigateTargetFromHref,
  type AppMode,
} from "@/lib/mode-last-location";
import { isMemorySessionPath } from "@/lib/memory-session-path";
import { shouldHideModeDock } from "@/lib/mode-dock-hidden-path";
import { useTabs } from "@/lib/use-tabs";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { isStudyFeatureAccessible } from "@/lib/study-feature-access";
import { useOptionalStagedOnboarding } from "@/components/tutorial/staged-onboarding-context";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { FeatureCallout } from "@/components/tutorial/feature-callout";

/** The three navigable modes, in dock order. */
type Mode = AppMode;

function shouldHandleSpaClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  );
}

/**
 * The Mode Dock: a floating bottom-center pill with up to three segments (Notes
 * / Memory / Study) and a due-count badge on Memory. It's `position: fixed`
 * so it never affects layout flow, and it stays visible wherever it is shown.
 * Notes and Memory are always available; Study unlocks once enough notes exist.
 *
 * Dock switches restore the last href visited inside that mode (pack, review,
 * passage with search) instead of always jumping to the mode's home.
 */
export function ModeDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const { backPassageId } = useTabs();

  // Shared session clock (same snapshot as the Memory dashboard). Completing a
  // review or learn still updates the count (same args, reactive data). The
  // clock catches up on a new local day so overnight locks can expire.
  const now = useLiveNow();
  useEnsureInMemoryBackfill(now);
  const skipDueCount = isMemorySessionPath(location.pathname);
  const dueCountResult = useQuery(
    api.verseMemory.dueCount,
    skipDueCount
      ? "skip"
      : { now, tzOffsetMinutes: new Date(now).getTimezoneOffset() },
  );
  // Keep the last loaded count so a reconnect or loading gap after a long-lived
  // tab doesn't blank the badge (which looks like the number "disappeared").
  const [dueCount, setDueCount] = useState<number | undefined>(undefined);
  if (typeof dueCountResult === "number" && dueCountResult !== dueCount) {
    setDueCount(dueCountResult);
  }

  const isNotesRoute = location.pathname.startsWith("/passage");
  const isMemoryRoute = location.pathname.startsWith("/memory");
  const isStudyRoute = location.pathname.startsWith("/study");

  const [lastLocations, setLastLocations] = useState(readModeLastLocations);
  // Derive during render when the route changes so dock hrefs update before
  // paint. Session storage is written inside `rememberModeLocation`.
  const nextLocations = rememberModeLocation(
    location.pathname,
    location.href,
    lastLocations,
  );
  if (nextLocations) {
    setLastLocations(nextLocations);
  }
  const storedLocations = nextLocations ?? lastLocations;

  const notesHref = resolveModeHref(
    "notes",
    storedLocations,
    `/passage/${backPassageId}`,
  );
  const memoryHref = resolveModeHref("memory", storedLocations);
  const memoryClickGoesHome =
    isMemoryRoute && !isPlainMemoryHome(location.pathname, location.href);
  const memoryTabHref = memoryClickGoesHome ? "/memory" : memoryHref;
  const studyHref = resolveModeHref("study", storedLocations);

  const hideForRoute = shouldHideModeDock(location.pathname);
  const dockEnabled = !hideForRoute;

  // Notes + Memory are always unlocked so the dock is discoverable without
  // waiting on a first heart. Study still unlocks once enough notes exist.
  const stagedOnboarding = useOptionalStagedOnboarding();
  const milestones = stagedOnboarding?.milestones;
  const studyUnlocked = isStudyFeatureAccessible(milestones);
  const unlockedModes = useMemo<Mode[]>(() => {
    const modes: Mode[] = ["notes", "memory"];
    if (studyUnlocked) modes.push("study");
    return modes;
  }, [studyUnlocked]);

  // Only claim a hint while the dock can render it. Settings and legal pages
  // hide the dock, and an eligible-but-unrendered callout would pin the queue.
  const studyHint = useFeatureHint(
    FEATURE_HINTS.STUDY_REVEAL_AFTER_NOTES,
    studyUnlocked && dockEnabled,
  );

  const goToMode = useCallback(
    (mode: Mode, trigger: string) => {
      if (mode === "memory" && trigger === "click" && isMemoryRoute) {
        if (!memoryClickGoesHome) return;
        logInteraction("mode-dock", "memory-opened", { trigger });
        void navigate({ to: "/memory", search: {} });
        return;
      }
      const href =
        mode === "notes"
          ? notesHref
          : mode === "memory"
            ? memoryHref
            : studyHref;
      logInteraction("mode-dock", `${mode}-opened`, { trigger });
      const target = modeNavigateTargetFromHref(href);
      if (target) {
        void navigate(target);
        return;
      }
      void navigate({ href });
    },
    [
      isMemoryRoute,
      memoryClickGoesHome,
      memoryHref,
      navigate,
      notesHref,
      studyHref,
    ],
  );

  const activeMode: Mode = isStudyRoute
    ? "study"
    : isMemoryRoute
      ? "memory"
      : "notes";

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

  if (!dockEnabled) {
    return null;
  }

  const toggleShortcutLabel = formatCommandOrControlShortcut("J");
  const showBadge = typeof dueCount === "number" && dueCount > 0;
  const badgeLabel = showBadge
    ? `${dueCount} ${dueCount === 1 ? "verse" : "verses"} due today`
    : undefined;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
      <nav
        aria-label="Mode"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
      >
        <a
          href={notesHref}
          title={`Notes (${toggleShortcutLabel} cycles)`}
          aria-label="Notes"
          aria-current={isNotesRoute ? "page" : undefined}
          onClick={(event) => {
            if (!shouldHandleSpaClick(event)) return;
            event.preventDefault();
            goToMode("notes", "click");
          }}
          className={segmentClassName(isNotesRoute)}
        >
          <NotebookPen className="h-4 w-4" />
          <span>Notes</span>
        </a>
        <a
          href={memoryTabHref}
          title={`Memory (${toggleShortcutLabel} cycles)`}
          aria-label="Memory"
          aria-current={isMemoryRoute ? "page" : undefined}
          onClick={(event) => {
            if (!shouldHandleSpaClick(event)) return;
            event.preventDefault();
            goToMode("memory", "click");
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
                isMemoryRoute
                  ? "bg-primary-foreground text-primary"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {dueCount}
            </span>
          ) : null}
        </a>
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
            <a
              href={studyHref}
              title={`Study (${toggleShortcutLabel} cycles)`}
              aria-label="Study"
              aria-current={isStudyRoute ? "page" : undefined}
              onClick={(event) => {
                if (!shouldHandleSpaClick(event)) return;
                event.preventDefault();
                if (!studyHint.completed && !studyHint.dismissed) {
                  studyHint.complete();
                }
                goToMode("study", "click");
              }}
              className={segmentClassName(isStudyRoute)}
            >
              <BookOpen className="h-4 w-4" />
              <span>Study</span>
            </a>
          </FeatureCallout>
        ) : null}
      </nav>
    </div>
  );
}

function isPlainMemoryHome(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path !== "/memory") return false;
  const queryStart = href.indexOf("?");
  if (queryStart === -1) return true;
  return !new URLSearchParams(href.slice(queryStart + 1)).has("panel");
}

function segmentClassName(active: boolean): string {
  return cn(
    "relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
