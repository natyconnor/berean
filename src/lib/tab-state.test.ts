import { describe, expect, it } from "vitest";
import {
  closeTabAndChooseFallback,
  createInitialTabStore,
  createTab,
  ensureRouteTabVisible,
  findActiveTabIdForRoute,
  getRouteTabId,
  navigateCurrentTab,
  openOrReuseTab,
} from "./tab-state";

describe("tab-state", () => {
  it("shows the deep-linked passage as the active visible tab when it is not persisted", () => {
    const persistedTabs = [createTab("john-1", "John-1", "John 1")];
    const store = createInitialTabStore(persistedTabs, "/passage/Genesis-1");
    const visibleTabs = ensureRouteTabVisible(store.tabs, "Genesis-1");

    expect(visibleTabs.map((tab) => tab.passageId)).toEqual([
      "John-1",
      "Genesis-1",
    ]);
    expect(findActiveTabIdForRoute(store.tabs, "/passage/Genesis-1")).toBe(
      getRouteTabId("Genesis-1"),
    );
  });

  it("reuses an existing tab before creating a new one", () => {
    const store = createInitialTabStore(
      [createTab("john-1", "John-1", "John 1")],
      "/",
    );

    const reused = openOrReuseTab(store, {
      passageId: "John-1",
      label: "John 1",
      createId: () => "new-id",
    });
    expect(reused.tabs).toHaveLength(1);
    expect(reused.history).toEqual(["john-1"]);

    const created = openOrReuseTab(store, {
      passageId: "Genesis-1",
      label: "Genesis 1",
      createId: () => "genesis-1",
    });
    expect(created.tabs.map((tab) => tab.id)).toEqual(["john-1", "genesis-1"]);
    expect(created.history).toEqual(["genesis-1"]);
  });

  it("chooses the most recently used remaining tab when closing the active tab", () => {
    const result = closeTabAndChooseFallback(
      {
        tabs: [
          createTab("john-1", "John-1", "John 1"),
          createTab("mark-1", "Mark-1", "Mark 1"),
          createTab("luke-1", "Luke-1", "Luke 1"),
        ],
        history: ["john-1", "luke-1", "mark-1"],
      },
      {
        tabId: "mark-1",
        activeTabId: "mark-1",
        routePassageId: "Mark-1",
        createId: () => "fallback",
      },
    );

    expect(result.navigationTarget).toEqual({ passageId: "Luke-1" });
    expect(result.store.tabs.map((tab) => tab.id)).toEqual([
      "john-1",
      "luke-1",
    ]);
    expect(result.store.history[result.store.history.length - 1]).toBe(
      "luke-1",
    );
  });

  it("materializes a synthetic route tab before navigating the current tab", () => {
    const result = navigateCurrentTab(
      createInitialTabStore(
        [createTab("john-1", "John-1", "John 1")],
        "/passage/Genesis-1",
      ),
      {
        activeTabId: getRouteTabId("Genesis-1"),
        routePassageId: "Genesis-1",
        passageId: "Exodus-1",
        label: "Exodus 1",
        createId: () => "materialized",
      },
    );

    expect(result.tabs.map((tab) => [tab.id, tab.passageId])).toEqual([
      ["john-1", "John-1"],
      ["materialized", "Exodus-1"],
    ]);
    expect(result.history[result.history.length - 1]).toBe("materialized");
  });
});
