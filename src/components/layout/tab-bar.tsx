import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTabs } from "@/lib/use-tabs";
import { TabItem } from "./tab-item";
import { LogOut, Search, TableOfContents, Tags } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { SearchDialog } from "@/components/notes/search-dialog";
import { ThemeDropdown } from "./theme-dropdown";
import { PassageNavigator } from "@/components/bible/passage-navigator";
import { useAuthActions } from "@convex-dev/auth/react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Link, useLocation } from "@tanstack/react-router";
import { readSearchWorkspaceState } from "@/lib/search-workspace-state";
import { cn } from "@/lib/utils";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();
  const { signOut } = useAuthActions();
  const location = useLocation();
  const [passageNavigatorOpen, setPassageNavigatorOpen] = useState(false);
  const isSearchRoute = location.pathname === "/search";
  const savedSearchState = readSearchWorkspaceState();
  const searchLinkState = {
    q: savedSearchState.params.q,
    tags: savedSearchState.params.tags,
    mode: savedSearchState.params.mode,
    noteId: savedSearchState.params.noteId,
  };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setPassageNavigatorOpen((open) => !open);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex items-center border-b bg-muted/30 h-10 shrink-0">
      <ScrollArea className="flex-1">
        <div className="flex items-center h-10">
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={!isSearchRoute && tab.id === activeTabId}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
              />
            ))}
          </AnimatePresence>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex items-center gap-1 mx-1 shrink-0">
        <TooltipButton
          asChild
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            isSearchRoute &&
              "h-10 w-10 rounded-none border-b-2 border-b-primary bg-background text-foreground"
          )}
          tooltip="Open search workspace"
          aria-label="Open search workspace"
        >
          <Link to="/search" search={searchLinkState}>
            <Search className="h-4 w-4" />
          </Link>
        </TooltipButton>
        <PassageNavigator
          open={passageNavigatorOpen}
          onOpenChange={setPassageNavigatorOpen}
          trigger={
            <TooltipButton
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              tooltip="Go to passage"
              aria-label="Go to passage"
            >
              <TableOfContents className="h-4 w-4" />
            </TooltipButton>
          }
        />
        <TooltipButton
          asChild
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          tooltip="Starter tags settings"
          aria-label="Starter tags settings"
        >
          <Link to="/settings/tags">
            <Tags className="h-4 w-4" />
          </Link>
        </TooltipButton>
        <ThemeDropdown />
        <TooltipButton
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => void signOut()}
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
