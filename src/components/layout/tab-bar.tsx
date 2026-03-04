import { AnimatePresence } from "framer-motion";
import { useTabs } from "@/lib/use-tabs";
import { TabItem } from "./tab-item";
import { LogOut, Plus, Tags } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { SearchDialog } from "@/components/notes/search-dialog";
import { ThemeDropdown } from "./theme-dropdown";
import { PassageNavigator } from "@/components/bible/passage-navigator";
import { useAuthActions } from "@convex-dev/auth/react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Link } from "@tanstack/react-router";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();
  const { signOut } = useAuthActions();

  return (
    <div className="flex items-center border-b bg-muted/30 h-10 shrink-0">
      <ScrollArea className="flex-1">
        <div className="flex items-center h-10">
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
              />
            ))}
          </AnimatePresence>
          <PassageNavigator
            trigger={
              <button className="h-8 w-8 mx-1 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                <Plus className="h-4 w-4" />
              </button>
            }
          />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex items-center gap-1 mx-1 shrink-0">
        <SearchDialog />
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
    </div>
  );
}
