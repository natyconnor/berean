import type { Tab } from "./tab-types";
import { parsePassageId } from "./verse-ref-utils";

export interface TabStore {
  tabs: Tab[];
  history: string[];
}

export interface CloseTabNavigationTarget {
  passageId: string;
}

export interface CloseTabResult {
  store: TabStore;
  navigationTarget: CloseTabNavigationTarget | null;
}

const DEFAULT_PASSAGE_ID = "John-1";
const ROUTE_TAB_PREFIX = "__route__:";

function updateTabHistory(history: string[], tabId: string): string[] {
  if (history[history.length - 1] === tabId) return history;
  return [...history.filter((id) => id !== tabId), tabId];
}

function buildPassageLabel(passageId: string): string {
  const { book, chapter } = parsePassageId(passageId);
  return `${book} ${chapter}`;
}

export function createTab(
  id: string,
  passageId: string,
  label = buildPassageLabel(passageId),
): Tab {
  return { id, passageId, label };
}

export function getRoutePassageId(pathname: string): string | null {
  const match = pathname.match(/^\/passage\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getRouteTabId(passageId: string): string {
  return `${ROUTE_TAB_PREFIX}${passageId}`;
}

export function ensureRouteTabVisible(
  tabs: Tab[],
  routePassageId: string | null,
): Tab[] {
  if (!routePassageId) return tabs;
  if (tabs.some((tab) => tab.passageId === routePassageId)) return tabs;
  return [...tabs, createTab(getRouteTabId(routePassageId), routePassageId)];
}

export function findActiveTabIdForRoute(
  tabs: Tab[],
  pathname: string,
): string | null {
  const routePassageId = getRoutePassageId(pathname);
  if (!routePassageId) return null;
  return (
    ensureRouteTabVisible(tabs, routePassageId).find(
      (tab) => tab.passageId === routePassageId,
    )?.id ?? null
  );
}

export function createInitialTabStore(tabs: Tab[], pathname: string): TabStore {
  const activeTabId = findActiveTabIdForRoute(tabs, pathname);
  return {
    tabs,
    history: activeTabId ? [activeTabId] : [],
  };
}

export function openOrReuseTab(
  store: TabStore,
  options: {
    passageId: string;
    label: string;
    createId: () => string;
  },
): TabStore {
  const existing = store.tabs.find(
    (tab) => tab.passageId === options.passageId,
  );
  if (existing) {
    return {
      tabs: store.tabs,
      history: updateTabHistory(store.history, existing.id),
    };
  }

  const nextTab = createTab(
    options.createId(),
    options.passageId,
    options.label,
  );
  return {
    tabs: [...store.tabs, nextTab],
    history: updateTabHistory(store.history, nextTab.id),
  };
}

function materializeRouteTab(
  store: TabStore,
  routePassageId: string | null,
  createId: () => string,
): { store: TabStore; activeTabId: string | null } {
  if (!routePassageId) return { store, activeTabId: null };

  const existing = store.tabs.find((tab) => tab.passageId === routePassageId);
  if (existing) {
    return { store, activeTabId: existing.id };
  }

  const nextTab = createTab(createId(), routePassageId);
  return {
    store: {
      tabs: [...store.tabs, nextTab],
      history: updateTabHistory(store.history, nextTab.id),
    },
    activeTabId: nextTab.id,
  };
}

export function navigateCurrentTab(
  store: TabStore,
  options: {
    activeTabId: string | null;
    routePassageId: string | null;
    passageId: string;
    label: string;
    createId: () => string;
  },
): TabStore {
  if (!options.activeTabId) {
    return openOrReuseTab(store, options);
  }

  let nextStore = store;
  let nextActiveTabId: string | null = options.activeTabId;

  if (!store.tabs.some((tab) => tab.id === options.activeTabId)) {
    const materialized = materializeRouteTab(
      store,
      options.routePassageId,
      options.createId,
    );
    nextStore = materialized.store;
    nextActiveTabId = materialized.activeTabId;
  }

  if (!nextActiveTabId) {
    return openOrReuseTab(nextStore, options);
  }
  const materializedActiveTabId = nextActiveTabId;

  return {
    tabs: nextStore.tabs.map((tab) =>
      tab.id === materializedActiveTabId
        ? createTab(materializedActiveTabId, options.passageId, options.label)
        : tab,
    ),
    history: updateTabHistory(nextStore.history, materializedActiveTabId),
  };
}

export function activateTab(store: TabStore, tabId: string): TabStore {
  if (!store.tabs.some((tab) => tab.id === tabId)) {
    return {
      tabs: store.tabs,
      history: updateTabHistory(store.history, tabId),
    };
  }

  return {
    tabs: store.tabs,
    history: updateTabHistory(store.history, tabId),
  };
}

export function reorderTabs(store: TabStore, newTabs: Tab[]): TabStore {
  return { ...store, tabs: newTabs };
}

export function closeTabAndChooseFallback(
  store: TabStore,
  options: {
    tabId: string;
    activeTabId: string | null;
    routePassageId: string | null;
    createId: () => string;
  },
): CloseTabResult {
  const visibleTabs = ensureRouteTabVisible(store.tabs, options.routePassageId);
  const closingIndex = visibleTabs.findIndex((tab) => tab.id === options.tabId);
  if (closingIndex === -1) {
    return { store, navigationTarget: null };
  }

  const nextTabs = store.tabs.filter((tab) => tab.id !== options.tabId);
  const remainingVisibleTabs = visibleTabs.filter(
    (tab) => tab.id !== options.tabId,
  );
  const nextHistory = store.history.filter((id) => id !== options.tabId);

  if (nextTabs.length === 0) {
    const fallbackTab = createTab(
      options.createId(),
      DEFAULT_PASSAGE_ID,
      buildPassageLabel(DEFAULT_PASSAGE_ID),
    );
    return {
      store: {
        tabs: [fallbackTab],
        history: [fallbackTab.id],
      },
      navigationTarget: { passageId: fallbackTab.passageId },
    };
  }

  if (options.activeTabId !== options.tabId) {
    return {
      store: {
        tabs: nextTabs,
        history: nextHistory,
      },
      navigationTarget: null,
    };
  }

  const remainingIds = new Set(remainingVisibleTabs.map((tab) => tab.id));
  const lastUsedId = [...nextHistory]
    .reverse()
    .find((id) => remainingIds.has(id));
  const fallbackTab =
    (lastUsedId
      ? remainingVisibleTabs.find((tab) => tab.id === lastUsedId)
      : remainingVisibleTabs[
          Math.min(closingIndex, remainingVisibleTabs.length - 1)
        ]) ?? null;

  if (!fallbackTab) {
    const defaultTab = createTab(
      options.createId(),
      DEFAULT_PASSAGE_ID,
      buildPassageLabel(DEFAULT_PASSAGE_ID),
    );
    return {
      store: {
        tabs: [defaultTab],
        history: [defaultTab.id],
      },
      navigationTarget: { passageId: defaultTab.passageId },
    };
  }

  return {
    store: {
      tabs: nextTabs,
      history: updateTabHistory(nextHistory, fallbackTab.id),
    },
    navigationTarget: { passageId: fallbackTab.passageId },
  };
}
