import { MemoryPanelHost } from "@/components/memory/drawer/memory-panel-host";
import { MemoryHome } from "@/components/memory/memory-home";
import { MemoryFirstOpenDialog } from "@/components/memory/memory-first-open-dialog";
import { Route } from "@/routes/memory/index";

export function MemoryHomePage() {
  const { panel, from } = Route.useSearch();
  return (
    <>
      <MemoryHome />
      <MemoryFirstOpenDialog />
      <MemoryPanelHost panel={panel} from={from} />
    </>
  );
}
