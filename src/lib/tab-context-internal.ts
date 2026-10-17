import { createContext } from "react";

import { createTab } from "./tab-state";
import type { Tab } from "./tab-types";

export interface PassageNavigationSearch {
  startVerse?: number;
  endVerse?: number;
  mode?: "compose" | "read";
  source?: "search";
}

export interface TabContextValue {
  tabs: Tab[];
  activeTabId: string | null;
  backPassageId: string;
  searchModeActive: boolean;
  openTab: (
    passageId: string,
    label: string,
    search?: PassageNavigationSearch,
  ) => void;
  navigateActiveTab: (
    passageId: string,
    label: string,
    search?: PassageNavigationSearch,
  ) => void;
  closeTab: (tabId: string) => void;
  reorderTabs: (tabs: Tab[]) => void;
  setActiveTab: (tabId: string) => void;
  setSearchModeActive: (active: boolean) => void;
}

export const TabContext = createContext<TabContextValue | null>(null);

export const STORAGE_KEY = "bible_tabs";

function parseStoredJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function toTab(raw: unknown, index: number): Tab | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  if (entry.type === "search") return null;

  const passageId =
    typeof entry.passageId === "string" && entry.passageId.trim().length > 0
      ? entry.passageId
      : null;
  if (!passageId) return null;

  return createTab(
    typeof entry.id === "string" && entry.id.trim().length > 0
      ? entry.id
      : `legacy-tab-${index}`,
    passageId,
  );
}

export function loadTabs(): Tab[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseStoredJson(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed
          .map((entry, index) => toTab(entry, index))
          .filter((entry): entry is Tab => !!entry);
        if (normalized.length > 0) return normalized;
      }
    }
  } catch {
    // ignore
  }
  return [{ id: "default", passageId: "John-1", label: "John 1" }];
}

export function saveTabs(tabs: Tab[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // ignore
  }
}
