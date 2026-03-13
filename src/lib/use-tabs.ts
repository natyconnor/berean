import { useContext } from "react";

import { TabContext } from "./tab-context-internal";

export function useTabs() {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error("useTabs must be used within TabProvider");
  return ctx;
}
