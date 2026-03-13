import type { ReactNode } from "react";
import { TabBar } from "./tab-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <TabBar />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
