import { MemoryPanelHost } from "@/components/memory/drawer/memory-panel-host";
import { TodayPage } from "@/components/memory/today/today-page";
import { Route } from "@/routes/memory/index";

export function MemoryHomePage() {
  const { panel, from } = Route.useSearch();
  return (
    <>
      <TodayPage />
      <MemoryPanelHost panel={panel} from={from} />
    </>
  );
}
