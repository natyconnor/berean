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
} from "./tab-state";

function TabProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [store, setStore] = useState(() =>
    createInitialTabStore(loadTabs(), location.pathname),
  );
  const navigate = useNavigate();
  const routePassageId = getRoutePassageId(location.pathname);

  const tabs = useMemo(
    () => ensureRouteTabVisible(store.tabs, routePassageId),
    [routePassageId, store.tabs],
  );
  const activeTabId = useMemo(
    () => findActiveTabIdForRoute(store.tabs, location.pathname),
    [location.pathname, store.tabs],
  );
  const searchModeActive = location.pathname === "/search";

  const backPassageId = useMemo(() => {
    for (let i = store.history.length - 1; i >= 0; i--) {
      const tabId = store.history[i];
      const tab = store.tabs.find((t) => t.id === tabId);
      if (tab) return tab.passageId;
    }
    return store.tabs[0]?.passageId ?? "John-1";
  }, [store.history, store.tabs]);

  useEffect(() => {
    saveTabs(store.tabs);
  }, [store.tabs]);

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
      setStore((currentStore) =>
        openOrReuseTab(currentStore, {
          passageId,
          label,
          createId: () => crypto.randomUUID(),
        }),
      );
      startTransition(() => {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId },
          search,
        });
      });
    },
    [navigate],
  );

  const navigateActiveTab = useCallback(
    (
      passageId: string,
      label: string,
      search: PassageNavigationSearch = {},
    ) => {
      setStore((currentStore) =>
        navigateCurrentTab(currentStore, {
          activeTabId,
          routePassageId,
          passageId,
          label,
          createId: () => crypto.randomUUID(),
        }),
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
      setStore((currentStore) => {
        const result = closeTabAndChooseFallback(currentStore, {
          tabId,
          activeTabId,
          routePassageId,
          createId: () => crypto.randomUUID(),
        });
        nextPassageId = result.navigationTarget?.passageId ?? null;
        return result.store;
      });

      if (nextPassageId) {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId: nextPassageId },
          search: {},
        });
      }
    },
    [activeTabId, navigate, routePassageId],
  );

  const handleReorderTabs = useCallback((newTabs: Tab[]) => {
    setStore((currentStore) => reorderTabs(currentStore, newTabs));
  }, []);

  const handleSetActiveTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      setStore((currentStore) => activateTab(currentStore, tabId));
      startTransition(() => {
        void navigate({
          to: "/passage/$passageId",
          params: { passageId: tab.passageId },
          search: {},
        });
      });
    },
    [tabs, navigate],
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
