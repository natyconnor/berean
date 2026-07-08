import { useEffect, useState } from "react";
import { AnimatePresence, Reorder } from "framer-motion";
import { useTabs } from "@/lib/use-tabs";
import { TabItem } from "./tab-item";
import {
  BookOpen,
  Brain,
  LogOut,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { SearchDialog } from "@/components/notes/search-dialog";
import { ThemeDropdown } from "./theme-dropdown";
import { PassageNavigator } from "@/components/bible/passage-navigator";
import { useAuthActions } from "@convex-dev/auth/react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { readSearchWorkspaceState } from "@/lib/search-workspace-state";
import { logInteraction } from "@/lib/dev-log";
import { cn } from "@/lib/utils";
import { formatCommandOrControlShortcut } from "@/lib/keyboard-shortcuts";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import {
  shouldRevealMemory,
  shouldRevealSearch,
  shouldRevealStudy,
} from "@/lib/staged-onboarding-thresholds";
import { useOptionalStagedOnboarding } from "@/components/tutorial/staged-onboarding-context";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { FeatureCallout } from "@/components/tutorial/feature-callout";

export function TabBar() {
  const {
    tabs,
    activeTabId,
    backPassageId,
    setActiveTab,
    closeTab,
    reorderTabs,
  } = useTabs();
  const { signOut } = useAuthActions();
  const location = useLocation();
  const navigate = useNavigate();
  const [passageNavigatorOpen, setPassageNavigatorOpen] = useState(false);
  const isSearchRoute = location.pathname === "/search";
  const isMemoryRoute = location.pathname.startsWith("/memory");
  const isStudyRoute = location.pathname.startsWith("/study");
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const savedSearchState = readSearchWorkspaceState();
  const stagedOnboarding = useOptionalStagedOnboarding();
  const milestones = stagedOnboarding?.milestones;
  const searchRevealReached = milestones
    ? shouldRevealSearch(milestones)
    : false;
  const searchHint = useFeatureHint(
    FEATURE_HINTS.SEARCH_REVEAL_AFTER_LIBRARY,
    searchRevealReached,
  );
  const memoryRevealReached = milestones
    ? shouldRevealMemory(milestones)
    : false;
  const studyRevealReached = milestones ? shouldRevealStudy(milestones) : false;
  // The Mode Dock owns the Memory/Study reveal *callouts* (and the display
  // queue). The toolbar Memory/Study links are the documented fallbacks, so they
  // opt out of the display queue (`useDisplayQueue: false`) to avoid pinning the
  // queue with no UI, but still complete their reveal when the user opens the
  // mode this way.
  const memoryHint = useFeatureHint(
    FEATURE_HINTS.MEMORY_REVEAL_AFTER_FIRST_HEART,
    memoryRevealReached,
    { useDisplayQueue: false },
  );
  const studyHint = useFeatureHint(
    FEATURE_HINTS.STUDY_REVEAL_AFTER_NOTES,
    studyRevealReached,
    { useDisplayQueue: false },
  );
  // Soft-hide rule: only show a toolbar button once the user has reached the
  // milestone, OR once they've already acknowledged the hint. The global hint
  // queue prevents multiple reveal callouts from stacking. Memory (hearts) and
  // Study (notes) are toolbar fallbacks — the Mode Dock owns their reveals.
  const showSearchButton =
    searchRevealReached || searchHint.completed || searchHint.dismissed;
  const showMemoryButton =
    memoryRevealReached || memoryHint.completed || memoryHint.dismissed;
  const showStudyButton =
    studyRevealReached || studyHint.completed || studyHint.dismissed;
  const searchShortcutLabel = formatCommandOrControlShortcut("K");
  const passageShortcutLabel = formatCommandOrControlShortcut("G");
  const settingsShortcutLabel = formatCommandOrControlShortcut(",");
  const handlePassageNavigatorOpenChange = (nextOpen: boolean) => {
    if (nextOpen !== passageNavigatorOpen) {
      logInteraction(
        "toolbar",
        nextOpen ? "passage-navigator-opened" : "passage-navigator-closed",
      );
    }
    setPassageNavigatorOpen(nextOpen);
  };
  const searchLinkState = {
    q: savedSearchState.params.q,
    tags: savedSearchState.params.tags,
    mode: savedSearchState.params.mode,
    noteId: savedSearchState.params.noteId,
  };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        if (event.key.toLowerCase() === "w") {
          event.preventDefault();
          if (activeTabId) closeTab(activeTabId);
          return;
        }
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        setPassageNavigatorOpen((open) => {
          const nextOpen = !open;
          logInteraction(
            "toolbar",
            nextOpen ? "passage-navigator-opened" : "passage-navigator-closed",
            { trigger: "keyboard" },
          );
          return nextOpen;
        });
        return;
      }

      if (event.key === ",") {
        event.preventDefault();
        if (isSettingsRoute) {
          logInteraction("toolbar", "settings-closed", { trigger: "keyboard" });
          void navigate({
            to: "/passage/$passageId",
            params: { passageId: backPassageId },
          });
        } else {
          logInteraction("toolbar", "settings-opened", { trigger: "keyboard" });
          void navigate({ to: "/settings" });
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, activeTabId, closeTab, isSettingsRoute, backPassageId]);

  return (
    <div
      className="flex items-center border-b bg-muted/30 h-10 shrink-0"
      data-passage-dismiss-exempt
    >
      <ScrollArea className="flex-1">
        <Reorder.Group
          as="div"
          axis="x"
          values={tabs}
          onReorder={reorderTabs}
          className="flex items-center h-10"
        >
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={
                  !isSearchRoute &&
                  !isStudyRoute &&
                  !isSettingsRoute &&
                  tab.id === activeTabId
                }
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
              />
            ))}
          </AnimatePresence>
          <div className="flex h-10 items-center px-1">
            <PassageNavigator
              open={passageNavigatorOpen}
              onOpenChange={handlePassageNavigatorOpenChange}
              trigger={
                <TooltipButton
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  tooltip={`Open a new tab to a Bible chapter (${passageShortcutLabel})`}
                  aria-label="Open a new tab to a Bible chapter"
                  data-tour-id="app-book-selector"
                >
                  <Plus className="h-4 w-4" />
                </TooltipButton>
              }
            />
          </div>
        </Reorder.Group>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div
        className="flex items-center gap-1 mx-1 shrink-0"
        data-tour-id="app-toolbar"
      >
        {showSearchButton ? (
          <FeatureCallout
            state={searchHint}
            title="Search your notes"
            description="Your library is big enough to make searching useful. Open the search workspace to filter by tags or query text."
            primaryActionLabel="Open search"
            onPrimaryAction={() => {
              logInteraction("toolbar", "search-workspace-opened", {
                trigger: "reveal-callout",
              });
              void navigate({ to: "/search", search: searchLinkState });
            }}
            side="bottom"
            align="end"
          >
            <TooltipButton
              asChild
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                isSearchRoute &&
                  "h-10 w-10 rounded-none border-b-2 border-b-primary bg-background text-foreground",
              )}
              tooltip={`Open search workspace (${searchShortcutLabel})`}
              aria-label="Open search workspace"
              data-tour-id="app-search-button"
            >
              <Link
                to="/search"
                search={searchLinkState}
                onClick={() => {
                  logInteraction("toolbar", "search-workspace-opened");
                  // Tapping the revealed button counts as completing the hint,
                  // even if the callout was already shown on an earlier load.
                  if (!searchHint.completed && !searchHint.dismissed) {
                    searchHint.complete();
                  }
                }}
              >
                <Search className="h-4 w-4" />
              </Link>
            </TooltipButton>
          </FeatureCallout>
        ) : null}
        {showMemoryButton ? (
          <TooltipButton
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              isMemoryRoute &&
                "h-10 w-10 rounded-none border-b-2 border-b-primary bg-background text-foreground",
            )}
            tooltip="Open memory"
            aria-label="Open memory"
          >
            <Link
              to="/memory"
              onClick={() => {
                logInteraction("toolbar", "memory-opened");
                // Fallback completion: opening Memory from the toolbar resolves
                // the reveal so the hint queue always progresses, even if the
                // user never saw the dock callout. `complete()` is idempotent,
                // so the dock callout and this path complete it exactly once.
                if (memoryHint.pending) {
                  memoryHint.complete();
                }
              }}
            >
              <Brain className="h-4 w-4" />
            </Link>
          </TooltipButton>
        ) : null}
        {showStudyButton ? (
          <TooltipButton
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              isStudyRoute &&
                "h-10 w-10 rounded-none border-b-2 border-b-primary bg-background text-foreground",
            )}
            tooltip="Open study"
            aria-label="Open study"
          >
            <Link
              to="/study"
              onClick={() => {
                logInteraction("toolbar", "study-opened");
                // Fallback completion: opening Study from the toolbar resolves
                // the reveal so the hint queue always progresses, even if the
                // user never saw the dock callout. `complete()` is idempotent,
                // so the dock callout and this path complete it exactly once.
                if (studyHint.pending) {
                  studyHint.complete();
                }
              }}
            >
              <BookOpen className="h-4 w-4" />
            </Link>
          </TooltipButton>
        ) : null}
        <div className="relative">
          {isSettingsRoute ? (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-none border-b-2 border-b-primary bg-background text-foreground"
              tooltip={`Close settings (${settingsShortcutLabel})`}
              aria-label="Close settings"
              data-tour-id="app-settings-button"
              onClick={() => {
                logInteraction("toolbar", "settings-closed");
                void navigate({
                  to: "/passage/$passageId",
                  params: { passageId: backPassageId },
                });
              }}
            >
              <X className="h-4 w-4" />
            </TooltipButton>
          ) : (
            <TooltipButton
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              tooltip={`Open settings (${settingsShortcutLabel})`}
              aria-label="Open settings"
              data-tour-id="app-settings-button"
            >
              <Link
                to="/settings"
                onClick={() => logInteraction("toolbar", "settings-opened")}
              >
                <Settings className="h-4 w-4" />
              </Link>
            </TooltipButton>
          )}
        </div>
        <ThemeDropdown />
        <TooltipButton
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            logInteraction("toolbar", "sign-out-started");
            void signOut()
              .then(() => {
                logInteraction("toolbar", "sign-out-completed");
                return navigate({ to: "/" });
              })
              .catch((error) => {
                logInteraction("toolbar", "sign-out-failed", {
                  message:
                    error instanceof Error ? error.message : "unknown-error",
                });
              });
          }}
          tooltip="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </TooltipButton>
      </div>
      <SearchDialog showTrigger={false} />
    </div>
  );
}
