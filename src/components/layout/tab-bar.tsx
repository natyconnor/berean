import { useEffect, useState } from "react";
import { AnimatePresence, Reorder } from "framer-motion";
import { useTabs } from "@/lib/use-tabs";
import { TabItem } from "./tab-item";
import {
  BookOpen,
  LogOut,
  Plus,
  Search,
  Settings,
  TableOfContents,
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
import { useOptionalTutorial } from "@/components/tutorial/tutorial-context";

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
  const isStudyRoute = location.pathname.startsWith("/study");
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const savedSearchState = readSearchWorkspaceState();
  const tutorial = useOptionalTutorial();
  const isToolbarStep = tutorial?.isStepActive("main", "toolbar") ?? false;
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
          <div className="flex h-10 items-center border-r px-1">
            <PassageNavigator
              trigger={
                <TooltipButton
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  tooltip="Open a new tab to a Bible chapter"
                  aria-label="Open a new tab to a Bible chapter"
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
            onClick={() => logInteraction("toolbar", "search-workspace-opened")}
          >
            <Search className="h-4 w-4" />
          </Link>
        </TooltipButton>
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
            onClick={() => logInteraction("toolbar", "study-opened")}
          >
            <BookOpen className="h-4 w-4" />
          </Link>
        </TooltipButton>
        <PassageNavigator
          open={passageNavigatorOpen}
          onOpenChange={handlePassageNavigatorOpenChange}
          trigger={
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              tooltip={`Go to passage (${passageShortcutLabel})`}
              aria-label="Go to passage"
              data-tour-id="app-book-selector"
            >
              <TableOfContents className="h-4 w-4" />
            </TooltipButton>
          }
        />
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
          {isToolbarStep && (
            <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full ring-2 ring-sky-400" />
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
