import { MemoryPanelPage } from "@/components/memory/drawer/memory-panel-host";

export function MemoryVersesPage() {
  return <MemoryPanelPage panel={{ kind: "verses" }} from={undefined} />;
}
