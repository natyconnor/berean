import { MemoryPanelPage } from "@/components/memory/drawer/memory-panel-host";
import { Route } from "@/routes/memory/progress";

export function MemoryProgressPage() {
  const { from } = Route.useSearch();
  return <MemoryPanelPage panel={{ kind: "progress" }} from={from} />;
}
