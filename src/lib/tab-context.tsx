import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import {
  TabContext,
  type PassageNavigationSearch,
  loadTabs,
  saveTabs,
} from "./tab-context-internal";
import type { Tab } from "./tab-types";
import {
  activateTab,
  closeTabAndChooseFallback,
  createInitialTabStore,
  ensureRouteTabVisible,
  findActiveTabIdForRoute,
  getRoutePassageId,
  navigateCurrentTab,
  openOrReuseTab,
  reorderTabs,
  syncRoutePassageToCurrentTab,
} from "./tab-state";
import { logInteraction } from "./dev-log";

function TabProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [store, setStore] = useState(() =>
    createInitialTabStore(loadTabs(), location.pathname),
  );
  const navigate = useNavigate();
  const routePassageId = getRoutePassageId(location.pathname);
  const syncedStore = useMemo(
    () => syncRoutePassageToCurrentTab(store, routePassageId),
    [routePassageId, store],
  );

  const tabs = useMemo(
    () => ensureRouteTabVisible(syncedStore.tabs, routePassageId),
    [routePassageId, syncedStore.tabs],
  );
  const activeTabId = useMemo(
    () => findActiveTabIdForRoute(syncedStore.tabs, location.pathname),
    [location.pathname, syncedStore.tabs],
  );
  const searchModeActive = location.pathname === "/search";

  const backPassageId = useMemo(() => {
    for (let i = syncedStore.history.length - 1; i >= 0; i--) {
      const tabId = syncedStore.history[i];
      const tab = syncedStore.tabs.find((t) => t.id === tabId);
      if (tab) return tab.passageId;
    }
    return syncedStore.tabs[0]?.passageId ?? "John-1";
  }, [syncedStore.history, syncedStore.tabs]);

  useEffect(() => {
    saveTabs(syncedStore.tabs);
  }, [syncedStore.tabs]);

  const setSearchModeActive = useCallback((active: boolean) => {
    // Route state is the source of truth for search mode.
    void active;
  }, []);

  const openTab = useCallback(
    (
      passageId: string,
      label: string,
      search: PassageNavigationSearch = {},
    ) => {
      let didReuseExisting = false;
      setStore((currentStore) => {
        const currentSyncedStore = syncRoutePassageToCurrentTab(
          currentStore,
          routePassageId,
        );
        didReuseExisting = currentSyncedStore.tabs.some(
          (tab) => tab.passageId === passageId,
        );
        return openOrReuseTab(currentSyncedStore, {
          passageId,
          label,
          createId: () => crypto.randomUUID(),
        });
      });
      logInteraction("tabs", didReuseExisting ? "reused" : "opened", {
        label,
        passageId,
        source: search.source ?? null,
      });
      startTransition(() => {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId },
          search,
        });
      });
    },
    [navigate, routePassageId],
  );

  const navigateActiveTab = useCallback(
    (
      passageId: string,
      label: string,
      search: PassageNavigationSearch = {},
    ) => {
      logInteraction("tabs", "navigated-active-tab", {
        label,
        passageId,
        source: search.source ?? null,
      });
      setStore((currentStore) =>
        navigateCurrentTab(
          syncRoutePassageToCurrentTab(currentStore, routePassageId),
          {
            activeTabId,
            routePassageId,
            passageId,
            label,
            createId: () => crypto.randomUUID(),
          },
        ),
      );
      startTransition(() => {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId },
          search,
        });
      });
    },
    [activeTabId, navigate, routePassageId],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      let nextPassageId: string | null = null;
      const closingTab = tabs.find((tab) => tab.id === tabId) ?? null;
      setStore((currentStore) => {
        const result = closeTabAndChooseFallback(
          syncRoutePassageToCurrentTab(currentStore, routePassageId),
          {
            tabId,
            activeTabId,
            routePassageId,
            createId: () => crypto.randomUUID(),
          },
        );
        nextPassageId = result.navigationTarget?.passageId ?? null;
        return result.store;
      });

      logInteraction("tabs", "closed", {
        tabId,
        closedPassageId: closingTab?.passageId ?? null,
        closedLabel: closingTab?.label ?? null,
        nextPassageId,
      });
      if (nextPassageId) {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId: nextPassageId },
          search: {},
        });
      }
    },
    [activeTabId, navigate, routePassageId, tabs],
  );

  const handleReorderTabs = useCallback(
    (newTabs: Tab[]) => {
      const previousOrder = tabs.map((tab) => tab.id).join(",");
      const nextOrder = newTabs.map((tab) => tab.id).join(",");
      if (previousOrder !== nextOrder) {
        logInteraction("tabs", "reordered", {
          tabCount: newTabs.length,
        });
      }
      setStore((currentStore) => reorderTabs(currentStore, newTabs));
    },
    [tabs],
  );

  const handleSetActiveTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      logInteraction("tabs", "activated", {
        tabId,
        passageId: tab.passageId,
        label: tab.label,
      });
      setStore((currentStore) =>
        activateTab(
          syncRoutePassageToCurrentTab(currentStore, routePassageId),
          tabId,
        ),
      );
      startTransition(() => {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId: tab.passageId },
          search: {},
        });
      });
    },
    [tabs, navigate, routePassageId],
  );

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        backPassageId,
        searchModeActive,
        openTab,
        navigateActiveTab,
        closeTab,
        reorderTabs: handleReorderTabs,
        setActiveTab: handleSetActiveTab,
        setSearchModeActive,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export { TabProvider };
